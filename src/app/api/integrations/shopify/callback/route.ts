import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  isValidShopDomain,
  verifyCallbackSignature,
  verifyOAuthState,
  exchangeCodeForToken,
  registerWebhooks,
  ShopifyOAuthError,
} from "@/server/integrations/shopify-oauth";
import {
  connectShopifyViaOAuth,
  fillBrandWebsiteUrlIfMissing,
} from "@/server/services/brand-profile-service";
import { syncProductsForBrand } from "@/server/services/product-sync-service";
import { fetchShopifyShopDomain } from "@/server/integrations/shopify-client";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

function failureRedirect(returnTo: string, message: string) {
  const url = new URL(
    returnTo.startsWith("/") ? returnTo : "/marca/cuenta?tab=tienda",
    APP_URL,
  );
  url.searchParams.set("shopify", "error");
  url.searchParams.set("shopifyMessage", message);
  return NextResponse.redirect(url);
}

/// Paso 2 de la conexión automática: Shopify regresa aquí después de que la
/// marca autorizó el acceso, con un código de un solo uso que cambiamos por
/// el token real — la marca nunca lo ve ni lo copia.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = (searchParams.get("shop") ?? "").trim().toLowerCase();
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const fallbackReturnTo = "/marca/cuenta?tab=tienda";

  if (!shop || !isValidShopDomain(shop) || !code || !state) {
    return failureRedirect(
      fallbackReturnTo,
      "La respuesta de Shopify llegó incompleta. Intenta de nuevo.",
    );
  }

  let brandId: string;
  let returnTo: string;
  try {
    ({ brandId, returnTo } = verifyOAuthState(state));
  } catch (err) {
    return failureRedirect(
      fallbackReturnTo,
      err instanceof Error ? err.message : "Enlace de conexión inválido.",
    );
  }

  if (!verifyCallbackSignature(searchParams)) {
    return failureRedirect(
      returnTo,
      "No se pudo verificar que la respuesta viniera de Shopify.",
    );
  }

  const profile = await requireBrandProfile();
  if (!profile || profile.id !== brandId) {
    return failureRedirect(
      returnTo,
      "Tu sesión cambió durante la conexión — inicia el proceso de nuevo.",
    );
  }

  try {
    const accessToken = await exchangeCodeForToken(shop, code);
    await connectShopifyViaOAuth(profile.id, {
      storeUrl: `https://${shop}`,
      accessToken,
    });
    // Si esto falla, la tienda ya quedó conectada — solo no se detectarían
    // ventas automáticamente hasta que se reintente (no bloqueamos por esto).
    await registerWebhooks(shop, accessToken, profile.id);
    // Primer traído del catálogo, ya — la marca sigue al siguiente paso del
    // onboarding sin tener que esperar ni pedirlo aparte. Si falla, no
    // interrumpe la conexión: los webhooks de producto y el cron diario lo
    // vuelven a intentar solos.
    try {
      await syncProductsForBrand(profile.id);
    } catch (syncErr) {
      console.error(
        `[onboarding] No se pudo sincronizar el catálogo inicial de ${profile.id}:`,
        syncErr,
      );
    }
    // Si "Página web" todavía está vacío, se llena solo con el dominio
    // real de la tienda (no el técnico .myshopify.com que se usó para
    // autorizar) — así la marca no tiene que escribirlo a mano y
    // arriesgarse a un typo. Nunca pisa un valor que ya haya puesto.
    try {
      const domain = await fetchShopifyShopDomain({
        storeUrl: `https://${shop}`,
        accessToken,
      });
      if (domain)
        await fillBrandWebsiteUrlIfMissing(profile.id, `https://${domain}`);
    } catch (domainErr) {
      console.error(
        `[onboarding] No se pudo traer el dominio de la tienda de ${profile.id}:`,
        domainErr,
      );
    }
  } catch (err) {
    const message =
      err instanceof ShopifyOAuthError
        ? err.message
        : "No se pudo completar la conexión con Shopify.";
    return failureRedirect(returnTo, message);
  }

  const successUrl = new URL(
    returnTo.startsWith("/") ? returnTo : fallbackReturnTo,
    APP_URL,
  );
  successUrl.searchParams.set("shopify", "connected");
  return NextResponse.redirect(successUrl);
}
