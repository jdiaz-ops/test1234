import { NextResponse } from "next/server";
import { verifyOAuthState, verifyCredentials, registerWebhooks, WooCommerceOAuthError } from "@/server/integrations/woocommerce-oauth";
import { connectWooCommerceViaOAuth } from "@/server/services/brand-profile-service";

/// A diferencia del callback de Shopify, WooCommerce llama a esto
/// servidor-a-servidor apenas la marca aprueba el acceso en su wp-admin —
/// no hay navegador ni sesión de por medio (por eso no se usa
/// requireBrandProfile aquí). La única prueba de que esto pertenece a la
/// marca correcta es `user_id`: es nuestro propio token firmado (ver
/// createOAuthState en woocommerce-oauth.ts) que le pasamos a WooCommerce
/// en el paso 1 y nos devuelve intacto — sin conocer nuestro AUTH_SECRET,
/// nadie puede fabricar un callback creíble para otra marca.
export async function POST(req: Request) {
  let body: { user_id?: string; consumer_key?: string; consumer_secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const { user_id: state, consumer_key: consumerKey, consumer_secret: consumerSecret } = body;
  if (!state || !consumerKey || !consumerSecret) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  let brandId: string;
  let storeUrl: string;
  try {
    ({ brandId, storeUrl } = verifyOAuthState(state));
  } catch (err) {
    const message = err instanceof WooCommerceOAuthError ? err.message : "Enlace de conexión inválido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const credentialsWork = await verifyCredentials(storeUrl, consumerKey, consumerSecret);
  if (!credentialsWork) {
    return NextResponse.json({ error: "Las credenciales no funcionaron contra la tienda." }, { status: 400 });
  }

  const brand = await connectWooCommerceViaOAuth(brandId, { storeUrl, consumerKey, consumerSecret });

  // Si esto falla, la tienda ya quedó conectada — solo no se detectarían
  // ventas automáticamente hasta que se reintente (no bloqueamos por esto).
  if (brand.webhookSecret) {
    await registerWebhooks(storeUrl, consumerKey, consumerSecret, brandId, brand.webhookSecret);
  }

  return NextResponse.json({ ok: true });
}
