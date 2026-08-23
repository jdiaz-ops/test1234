import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOAuthState } from "@/server/integrations/woocommerce-oauth";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const FALLBACK_RETURN_TO = "/marca/cuenta?tab=tienda";

/// A donde vuelve el navegador de la marca después de aprobar el acceso en
/// su wp-admin — el trabajo real (guardar credenciales) ya lo hizo el
/// callback servidor-a-servidor (ver /woocommerce/callback), que en la
/// gran mayoría de los casos ya terminó para cuando el navegador aterriza
/// aquí. Esta ruta solo confirma el resultado y redirige con el aviso
/// correspondiente.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state");

  if (!state) {
    return NextResponse.redirect(new URL(FALLBACK_RETURN_TO, APP_URL));
  }

  let brandId: string;
  let returnTo: string;
  try {
    ({ brandId, returnTo } = verifyOAuthState(state));
  } catch (err) {
    const url = new URL(FALLBACK_RETURN_TO, APP_URL);
    url.searchParams.set("woocommerce", "error");
    url.searchParams.set("woocommerceMessage", err instanceof Error ? err.message : "Enlace de conexión inválido.");
    return NextResponse.redirect(url);
  }

  const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
  const connected = brand?.storeType === "WOOCOMMERCE" && brand.storeConnectionStatus === "CONNECTED";

  const url = new URL(returnTo.startsWith("/") ? returnTo : FALLBACK_RETURN_TO, APP_URL);
  url.searchParams.set("woocommerce", connected ? "connected" : "error");
  if (!connected) {
    url.searchParams.set("woocommerceMessage", "No pudimos confirmar la conexión todavía — espera unos segundos y vuelve a intentar.");
  }
  return NextResponse.redirect(url);
}
