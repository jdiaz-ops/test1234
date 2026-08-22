import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyWooCommerceWebhookSignature,
  type WooCommerceOrderWebhookPayload,
} from "@/server/integrations/woocommerce-client";
import { recordOrderFromWebhook, recordRefundFromWebhook } from "@/server/services/attribution-service";

/// Estados de WooCommerce que cuentan como venta real (pagada) — un pedido
/// "pending"/"on-hold"/"cancelled"/"failed" todavía no es una venta
/// atribuible.
const PAID_STATUSES = new Set(["processing", "completed"]);

/// WooCommerce avisa qué evento es en el header `X-WC-Webhook-Topic`
/// (ej. "order.created", "order.updated"). No existe un topic dedicado de
/// reembolso en el core — un reembolso total se detecta porque el pedido
/// pasa a status "refunded" en un `order.updated`.
export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;

  const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
  if (!brand || !brand.webhookSecret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-wc-webhook-signature");
  if (!verifyWooCommerceWebhookSignature(rawBody, signature, brand.webhookSecret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  const topic = req.headers.get("x-wc-webhook-topic");
  if (topic !== "order.created" && topic !== "order.updated") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const order = JSON.parse(rawBody) as WooCommerceOrderWebhookPayload;

  if (order.status === "refunded") {
    const result = await recordRefundFromWebhook({
      brandId,
      source: "WOOCOMMERCE",
      externalOrderId: String(order.id),
      refundedAt: new Date(order.date_modified),
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (!PAID_STATUSES.has(order.status)) {
    return NextResponse.json({ ok: true, ignored: true, reason: "ESTADO_NO_PAGADO" });
  }

  const code = order.coupon_lines?.[0]?.code ?? null;
  const gross = Number(order.total) + Number(order.discount_total);
  const discount = Number(order.discount_total);

  const result = await recordOrderFromWebhook({
    brandId,
    source: "WOOCOMMERCE",
    externalOrderId: String(order.id),
    discountCode: code,
    grossAmount: gross,
    discountAmount: discount,
    netAmount: Number(order.total),
    occurredAt: new Date(order.date_created),
  });

  return NextResponse.json({ ok: true, ...result });
}
