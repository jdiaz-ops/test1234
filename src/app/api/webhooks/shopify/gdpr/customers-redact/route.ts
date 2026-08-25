import { NextResponse } from "next/server";
import { verifyShopifyWebhookSignature } from "@/server/integrations/shopify-client";
import { prisma } from "@/lib/prisma";

/// Webhook de cumplimiento obligatorio — se dispara 10 días después de que
/// un comprador le pide a la tienda que borre sus datos. Sí guardamos un
/// dato personal del comprador: Transaction.customerEmail (solo se usa para
/// el detector de fraude "comprador = creador" — nunca se muestra en
/// ningún panel). Acá se borra ese dato de todas las ventas de esa tienda
/// que coincidan con el correo del comprador — el resto de la Transaction
/// (montos, fechas, código usado) se conserva, porque es el historial de
/// negocio de la marca, no un dato del comprador.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!secret || !verifyShopifyWebhookSignature(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as { shop_domain?: string; customer?: { email?: string } };
  const shopDomain = payload.shop_domain;
  const customerEmail = payload.customer?.email?.trim().toLowerCase();

  if (shopDomain && customerEmail) {
    const brand = await prisma.brandProfile.findFirst({
      where: { storeUrl: `https://${shopDomain}` },
      select: { id: true },
    });
    if (brand) {
      await prisma.transaction.updateMany({
        where: { brandId: brand.id, customerEmail },
        data: { customerEmail: null },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
