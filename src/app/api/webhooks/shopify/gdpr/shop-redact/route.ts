import { NextResponse } from "next/server";
import { verifyShopifyWebhookSignature } from "@/server/integrations/shopify-client";
import { prisma } from "@/lib/prisma";

/// Webhook de cumplimiento obligatorio — se dispara 48 horas después de que
/// una tienda desinstala la app, y espera que borremos los datos que
/// guardamos de esa tienda. Lo único que guardamos es la conexión misma
/// (token de acceso y URL) — se limpia, sin tocar el resto del perfil de
/// la marca (ofertas, creadores, transacciones ya generadas no son "datos
/// de la tienda de Shopify", son el historial del negocio en Marcolini).
export async function POST(req: Request) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!secret || !verifyShopifyWebhookSignature(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const shopDomain = payload.shop_domain as string | undefined;

  if (shopDomain) {
    await prisma.brandProfile.updateMany({
      where: { storeUrl: `https://${shopDomain}` },
      data: {
        shopifyAccessToken: null,
        storeConnectionStatus: "NOT_CONNECTED",
        webhookSecret: null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
