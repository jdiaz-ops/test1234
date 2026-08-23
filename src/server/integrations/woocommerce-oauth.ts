import crypto from "crypto";

/// Conexión automática de WooCommerce — igual de "sin copiar y pegar nada"
/// que Shopify, pero con el mecanismo propio de WooCommerce: REST API App
/// Authentication (https://woocommerce.github.io/woocommerce-rest-api-docs/#rest-api-keys).
/// A diferencia de Shopify, no hace falta que WooCommerce revise ni
/// apruebe nuestra app — cualquier tienda con WooCommerce 3.5+ soporta este
/// endpoint tal cual, sin registrarla en ningún panel de desarrolladores.
///
/// El flujo tiene dos canales separados (no es un solo redirect como en
/// Shopify):
///  1. La marca autoriza en su propio wp-admin → su navegador vuelve a
///     `return_url` (solo para avisarle "ya terminaste").
///  2. En paralelo, el servidor de WooCommerce le hace un POST directo a
///     nuestro `callback_url` con las credenciales reales (consumer
///     key/secret) — eso es lo que efectivamente guardamos.
/// WooCommerce no firma ese POST, así que la seguridad depende de que
/// `user_id` sea un token firmado por nosotros (igual que el `state` de
/// Shopify) — sin conocer nuestro AUTH_SECRET, nadie puede fabricar un
/// callback creíble para otra marca.

export class WooCommerceOAuthError extends Error {}

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const SIGNING_KEY = process.env.AUTH_SECRET;

function requireSigningKey() {
  if (!SIGNING_KEY) {
    throw new WooCommerceOAuthError("Falta AUTH_SECRET en el servidor — no se puede firmar la conexión.");
  }
  return SIGNING_KEY;
}

/// Solo tiendas https:// reales — evita que alguien use este flujo para
/// mandar a un usuario a un sitio arbitrario.
export function isValidStoreUrl(storeUrl: string): boolean {
  try {
    const url = new URL(storeUrl);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/// El `user_id` que WooCommerce nos devuelve tal cual en el callback —
/// aquí va firmado el mismo trío que en el `state` de Shopify, más la URL
/// de la tienda (la necesitamos en el callback para probar las
/// credenciales y registrar los webhooks, y el callback de WooCommerce no
/// la incluye).
export function createOAuthState(brandId: string, storeUrl: string, returnTo: string): string {
  const key = requireSigningKey();
  const payload = JSON.stringify({ brandId, storeUrl, returnTo, exp: Date.now() + 10 * 60 * 1000 });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = crypto.createHmac("sha256", key).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): { brandId: string; storeUrl: string; returnTo: string } {
  const key = requireSigningKey();
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new WooCommerceOAuthError("Enlace de conexión inválido.");

  const expected = crypto.createHmac("sha256", key).update(encoded).digest("base64url");
  let validSignature = false;
  try {
    validSignature = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    validSignature = false;
  }
  if (!validSignature) throw new WooCommerceOAuthError("Enlace de conexión inválido.");

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  if (typeof payload.brandId !== "string" || typeof payload.storeUrl !== "string" || typeof payload.exp !== "number") {
    throw new WooCommerceOAuthError("Enlace de conexión inválido.");
  }
  if (Date.now() > payload.exp) {
    throw new WooCommerceOAuthError("El enlace de conexión expiró — intenta de nuevo.");
  }
  return {
    brandId: payload.brandId,
    storeUrl: payload.storeUrl,
    returnTo: typeof payload.returnTo === "string" ? payload.returnTo : "/marca/cuenta",
  };
}

export function buildAuthorizeUrl(storeUrl: string, state: string): string {
  const url = new URL(`${storeUrl.replace(/\/$/, "")}/wc-auth/v1/authorize`);
  url.searchParams.set("app_name", "Marcolini");
  url.searchParams.set("scope", "read_write");
  url.searchParams.set("user_id", state);
  url.searchParams.set("return_url", `${APP_URL}/api/integrations/woocommerce/return?state=${encodeURIComponent(state)}`);
  url.searchParams.set("callback_url", `${APP_URL}/api/integrations/woocommerce/callback`);
  return url.toString();
}

/// Confirma que las credenciales realmente sirven antes de darlas por
/// buenas — una llamada de lectura simple (listar 1 producto) es
/// suficiente y no modifica nada en la tienda.
export async function verifyCredentials(storeUrl: string, consumerKey: string, consumerSecret: string): Promise<boolean> {
  const auth = "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  try {
    const res = await fetch(`${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/products?per_page=1`, {
      headers: { Authorization: auth },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/// Registra los webhooks de ventas automáticamente, con el mismo
/// webhookSecret que ya usa la marca para la entrada manual — si algún
/// registro falla, no se interrumpe la conexión (las credenciales ya
/// quedaron guardadas), esa venta puntual simplemente no se detectaría
/// sola.
export async function registerWebhooks(storeUrl: string, consumerKey: string, consumerSecret: string, brandId: string, webhookSecret: string) {
  const auth = "Basic " + Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const deliveryUrl = `${APP_URL}/api/webhooks/woocommerce/${brandId}`;
  const topics = ["order.created", "order.updated"];

  const results = await Promise.allSettled(
    topics.map((topic) =>
      fetch(`${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/webhooks`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Marcolini — ${topic}`,
          topic,
          delivery_url: deliveryUrl,
          secret: webhookSecret,
          status: "active",
        }),
      })
    )
  );

  return results.every((r) => r.status === "fulfilled" && r.value.ok);
}
