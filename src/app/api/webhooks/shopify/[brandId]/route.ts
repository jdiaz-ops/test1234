import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyShopifyWebhookSignature,
  type ShopifyOrderWebhookPayload,
  type ShopifyRefundWebhookPayload,
} from "@/server/integrations/shopify-client";
import { recordOrderFromWebhook, recordRefundFromWebhook } from "@/server/services/attribution-service";

/// Shopify avisa qué evento es en el header `X-Shopify-Topic`
/// (ej. "orders/create", "refunds/create").
export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;

  const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
  if (!brand) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rawBody = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  // Una tienda conectada por OAuth firma sus webhooks con el Client Secret
  // de nuestra app (así los registramos automáticamente); una conectada a
  // mano (flujo viejo) firma con el secreto propio que le mostramos en su
  // momento. Se acepta cualquiera de los dos que esté configurado.
  const validShopifySecret = process.env.SHOPIFY_CLIENT_SECRET
    ? verifyShopifyWebhookSignature(rawBody, hmac, process.env.SHOPIFY_CLIENT_SECRET)
    : false;
  const validLegacySecret = brand.webhookSecret
    ? verifyShopifyWebhookSignature(rawBody, hmac, brand.webhookSecret)
    : false;
  if (!validShopifySecret && !validLegacySecret) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic");
  const payload = JSON.parse(rawBody);

  if (topic === "orders/create" || topic === "orders/updated") {
    const order = payload as ShopifyOrderWebhookPayload;
    const code = order.discount_codes?.[0]?.code ?? null;
    const gross = Number(order.total_line_items_price);
    const discount = Number(order.total_discounts);

    const result = await recordOrderFromWebhook({
      brandId,
      source: "SHOPIFY",
      externalOrderId: String(order.id),
      discountCode: code,
      grossAmount: gross,
      discountAmount: discount,
      netAmount: gross - discount,
      occurredAt: new Date(order.created_at),
    });

    return NextResponse.json({ ok: true, ...result });
  }

  if (topic === "refunds/create") {
    const refund = payload as ShopifyRefundWebhookPayload;
    const result = await recordRefundFromWebhook({
      brandId,
      source: "SHOPIFY",
      externalOrderId: String(refund.order_id),
      refundedAt: new Date(),
    });
    return NextResponse.json({ ok: true, ...result });
  }

  // Otros topics (ej. app/uninstalled) — los reconocemos pero no hacemos nada.
  return NextResponse.json({ ok: true, ignored: true });
}
