import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatewayForOrder } from "@/server/payments/credentials";
import { mapPayuState, payuConfirmationSignature, type PayuValues } from "@/server/payments/providers/payu";
import { readWebhookParams } from "@/server/payments/webhook-params";
import { applyPaymentResult } from "@/server/services/store-order-service";

/// Página de confirmación de PayU (aviso servidor a servidor): la URL va
/// dentro de cada cobro (confirmationUrl), así que es única para todas las
/// marcas. Se identifica el pedido por reference_sale y recién ahí se
/// verifica la firma "sign" con el API Key de esa marca.
async function handle(req: Request) {
  const p = await readWebhookParams(req);
  const referenceSale = p.reference_sale;
  const statePol = p.state_pol;
  const sign = p.sign;
  const value = p.value;
  const currency = p.currency;
  if (!referenceSale || !statePol || !sign || !value || !currency) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const order = await prisma.storeOrder.findUnique({ where: { reference: referenceSale }, include: { brand: true } });
  if (!order || order.paymentProvider !== "PAYU") return NextResponse.json({ ok: true });

  const gateway = gatewayForOrder(order.brand, order);
  if (!gateway) return NextResponse.json({ error: "Marca sin llaves activas" }, { status: 400 });
  const values = gateway.values as PayuValues;
  if (p.merchant_id && p.merchant_id !== values.merchantId) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  const expected = payuConfirmationSignature({
    apiKey: values.apiKey,
    merchantId: values.merchantId,
    referenceSale,
    value,
    currency,
    statePol,
  });
  if (expected !== sign.trim().toLowerCase()) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }
  await applyPaymentResult({
    reference: order.reference,
    transactionId: p.transaction_id || null,
    rawStatus: p.response_message_pol ? `${statePol}:${p.response_message_pol}` : statePol,
    outcome: mapPayuState(statePol),
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
