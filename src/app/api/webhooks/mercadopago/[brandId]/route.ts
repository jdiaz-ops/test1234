import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PaymentModeId } from "@/lib/payment-providers";
import { credentialsFor } from "@/server/payments/credentials";
import {
  fetchMercadoPagoPayment,
  mapMercadoPagoStatus,
  verifyMercadoPagoSignature,
  type MercadoPagoValues,
} from "@/server/payments/providers/mercado-pago";
import { PaymentGatewayError } from "@/server/payments/types";
import { applyPaymentResult } from "@/server/services/store-order-service";

/// Avisos de Mercado Pago para una marca: llegan a esta URL por la
/// notification_url de cada cobro y/o porque la marca la pegó en Webhooks
/// de su aplicación. El aviso solo trae el id del pago: el estado real se
/// consulta en la API de Mercado Pago con el Access Token de la marca —
/// por eso la firma (x-signature) se exige únicamente si la marca guardó
/// la clave secreta. Se responde 200 rápido en todo lo que no sea nuestro
/// para que Mercado Pago no reintente.
export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const url = new URL(req.url);
  const body = await req.json().catch(() => null);
  const dataId = url.searchParams.get("data.id") ?? (body?.data?.id != null ? String(body.data.id) : null);
  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body?.type ?? null;
  if (!dataId || (topic && topic !== "payment")) return NextResponse.json({ ok: true });

  const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
  if (!brand) return NextResponse.json({ ok: true });

  // Qué llaves usar: lo dice el aviso (live_mode); si no viene, primero el
  // modo actual de la marca y después el otro.
  const preferred: PaymentModeId =
    body?.live_mode === true ? "PRODUCTION" : body?.live_mode === false ? "TEST" : brand.paymentMode === "PRODUCTION" ? "PRODUCTION" : "TEST";
  const modes: PaymentModeId[] = preferred === "PRODUCTION" ? ["PRODUCTION", "TEST"] : ["TEST", "PRODUCTION"];

  for (const mode of modes) {
    const values = credentialsFor(brand, "MERCADO_PAGO", mode) as MercadoPagoValues | null;
    if (!values) continue;
    if (values.webhookSecret) {
      const valid = verifyMercadoPagoSignature({
        xSignature: req.headers.get("x-signature"),
        xRequestId: req.headers.get("x-request-id"),
        dataId,
        secret: values.webhookSecret,
      });
      if (!valid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }
    try {
      const payment = await fetchMercadoPagoPayment(values, dataId);
      if (!payment.external_reference) return NextResponse.json({ ok: true });
      const order = await prisma.storeOrder.findUnique({ where: { reference: payment.external_reference } });
      if (!order || order.brandId !== brand.id || order.paymentProvider !== "MERCADO_PAGO") {
        return NextResponse.json({ ok: true });
      }
      await applyPaymentResult({
        reference: order.reference,
        transactionId: String(payment.id),
        rawStatus: payment.status,
        outcome: mapMercadoPagoStatus(payment.status),
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      if (!(err instanceof PaymentGatewayError)) throw err;
      // Con las llaves del otro modo puede responder; si ninguna sirve,
      // Mercado Pago reintenta y la conciliación lo recoge después.
    }
  }
  return NextResponse.json({ error: "No se pudo consultar el pago" }, { status: 503 });
}
