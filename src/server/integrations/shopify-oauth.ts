import crypto from "crypto";
import { API_VERSION } from "@/server/integrations/shopify-client";

/// Conexión automática de Shopify vía OAuth — la marca nunca ve ni copia un
/// token: da clic en "Conectar", autoriza en la pantalla de Shopify, y
/// Shopify nos devuelve el acceso directamente a nuestro servidor.
/// Documentación: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant

export class ShopifyOAuthError extends Error {}

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const SCOPES = "write_price_rules,read_orders";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function requireCredentials() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new ShopifyOAuthError(
      "La conexión automática con Shopify no está configurada todavía (falta SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET). Avísale a soporte."
    );
  }
  return { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };
}

/// Shopify exige validar que el dominio sea realmente una tienda suya antes
/// de redirigir — si no, cualquiera podría usar este flujo para mandar a la
/// gente a un sitio distinto.
export function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

/// El "state" viaja de ida (a Shopify) y de vuelta (a nuestro callback) por
/// la URL. En vez de guardarlo en base de datos, lo firmamos: adentro va a
/// qué marca pertenece, a dónde regresar, y cuándo expira — la firma
/// garantiza que nadie lo pudo alterar en el camino.
export function createOAuthState(brandId: string, returnTo: string): string {
  const { clientSecret } = requireCredentials();
  const payload = JSON.stringify({ brandId, returnTo, exp: Date.now() + 10 * 60 * 1000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", clientSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): { brandId: string; returnTo: string } {
  const { clientSecret } = requireCredentials();
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new ShopifyOAuthError("Enlace de conexión inválido.");

  const expected = crypto.createHmac("sha256", clientSecret).update(encoded).digest("base64url");
  let validSignature = false;
  try {
    validSignature = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    validSignature = false;
  }
  if (!validSignature) throw new ShopifyOAuthError("Enlace de conexión inválido.");

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  if (typeof payload.brandId !== "string" || typeof payload.exp !== "number") {
    throw new ShopifyOAuthError("Enlace de conexión inválido.");
  }
  if (Date.now() > payload.exp) {
    throw new ShopifyOAuthError("El enlace de conexión expiró — intenta de nuevo.");
  }
  return { brandId: payload.brandId, returnTo: typeof payload.returnTo === "string" ? payload.returnTo : "/marca/cuenta" };
}

export function buildAuthorizeUrl(shop: string, state: string): string {
  const { clientId } = requireCredentials();
  const redirectUri = `${APP_URL}/api/integrations/shopify/callback`;
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/// Shopify firma también la URL de regreso (parámetro `hmac`) — se valida
/// igual que un webhook, para estar seguros de que la respuesta viene
/// realmente de Shopify y no de alguien que armó la URL a mano.
export function verifyCallbackSignature(searchParams: URLSearchParams): boolean {
  const { clientSecret } = requireCredentials();
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  for (const [key, value] of searchParams.entries()) {
    if (key === "hmac" || key === "signature") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const message = pairs.join("&");
  const digest = crypto.createHmac("sha256", clientSecret).update(message).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string> {
  const { clientId, clientSecret } = requireCredentials();
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) {
    throw new ShopifyOAuthError(`Shopify no autorizó la conexión (${res.status}).`);
  }
  const body = await res.json();
  if (!body.access_token) {
    throw new ShopifyOAuthError("Shopify no devolvió un token de acceso.");
  }
  return body.access_token as string;
}

/// Registra los webhooks de ventas/reembolsos automáticamente, con el token
/// recién obtenido — la marca tampoco tiene que pegar la URL del webhook a
/// mano. Si algún registro falla, no se interrumpe la conexión (el token ya
/// quedó guardado) — simplemente esa venta no se detectaría sola.
export async function registerWebhooks(shop: string, accessToken: string, brandId: string) {
  const address = `${APP_URL}/api/webhooks/shopify/${brandId}`;
  const topics = ["orders/create", "orders/updated", "refunds/create"];

  const results = await Promise.allSettled(
    topics.map((topic) =>
      fetch(`https://${shop}/admin/api/${API_VERSION}/webhooks.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
      })
    )
  );

  return results.every((r) => r.status === "fulfilled" && r.value.ok);
}
