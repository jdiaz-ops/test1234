import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { isValidStoreUrl, createOAuthState, buildAuthorizeUrl } from "@/server/integrations/woocommerce-oauth";

/// Paso 1 de la conexión automática: la marca ya escribió la URL de su
/// tienda y dio clic en "Conectar con WooCommerce" — la mandamos a la
/// pantalla de autorización de su propio wp-admin. Ver
/// /api/integrations/woocommerce/callback (donde WooCommerce nos manda las
/// credenciales) y /woocommerce/return (a donde vuelve el navegador de la
/// marca).
export async function GET(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const storeUrl = (searchParams.get("storeUrl") ?? "").trim().replace(/\/$/, "");
  const returnTo = searchParams.get("returnTo") ?? "/marca/cuenta?tab=tienda";

  if (!isValidStoreUrl(storeUrl)) {
    return NextResponse.json({ error: "Escribe la URL completa de tu tienda, empezando por https://" }, { status: 400 });
  }

  const state = createOAuthState(profile.id, storeUrl, returnTo);
  const authorizeUrl = buildAuthorizeUrl(storeUrl, state);
  return NextResponse.redirect(authorizeUrl);
}
