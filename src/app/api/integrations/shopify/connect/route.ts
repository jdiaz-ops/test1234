import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { isValidShopDomain, createOAuthState, buildAuthorizeUrl, ShopifyOAuthError } from "@/server/integrations/shopify-oauth";

/// Paso 1 de la conexión automática: la marca ya escribió el dominio de su
/// tienda y dio clic en "Conectar con Shopify" — la mandamos a la pantalla
/// de autorización de Shopify. Ver /api/integrations/shopify/callback para
/// el paso 2 (cuando Shopify nos regresa a la marca).
export async function GET(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shop = (searchParams.get("shop") ?? "").trim().toLowerCase();
  const returnTo = searchParams.get("returnTo") ?? "/marca/cuenta?tab=tienda";

  if (!isValidShopDomain(shop)) {
    return NextResponse.json(
      { error: "El dominio debe ser el de tu tienda Shopify, terminado en .myshopify.com" },
      { status: 400 }
    );
  }

  try {
    const state = createOAuthState(profile.id, returnTo);
    const authorizeUrl = buildAuthorizeUrl(shop, state);
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    if (err instanceof ShopifyOAuthError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }
}
