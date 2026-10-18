import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatewayForOrder } from "@/server/payments/credentials";
import {
  mapEpaycoCode,
  readEpaycoTransaction,
  verifyEpaycoSignature,
  type EpaycoValues,
} from "@/server/payments/providers/epayco";
import { readWebhookParams } from "@/server/payments/webhook-params";
import { applyPaymentResult } from "@/server/services/store-order-service";

/// URL de confirmación de ePayco: va dentro de cada cobro (confirmation),
/// así que es única para todas las marcas. Se identifica el pedido por
/// x_id_invoice (nuestra referencia) y recién ahí se verifica x_signature
/// con P_CUST_ID_CLIENTE y P_KEY de esa marca; el monto también tiene que
/// cuadrar con el pedido, como pide ePayco.
async function handle(req: Request) {
  const p = await readWebhookParams(req);
  const tx = readEpaycoTransaction(p);
  const signature = p.x_signature;
  if (!tx || !tx.x_id_invoice || !signature) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const order = await prisma.storeOrder.findUnique({ where: { reference: tx.x_id_invoice }, include: { brand: true } });
  if (!order || order.paymentProvider !== "EPAYCO") return NextResponse.json({ ok: true });

  const gateway = gatewayForOrder(order.brand, order);
  if (!gateway) return NextResponse.json({ error: "Marca sin llaves activas" }, { status: 400 });
  const values = gateway.values as EpaycoValues;
  const valid = verifyEpaycoSignature({
    custId: values.custId,
    pKey: values.pKey,
    refPayco: tx.x_ref_payco,
    transactionId: tx.x_transaction_id ?? "",
    amount: tx.x_amount ?? "",
    currency: tx.x_currency_code ?? "",
    signature,
  });
  if (!valid) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  const amount = Number(tx.x_amount);
  if (Number.isFinite(amount) && Math.abs(amount - order.totalCents / 100) > 1) {
    return NextResponse.json({ error: "El monto no corresponde al pedido" }, { status: 400 });
  }
  await applyPaymentResult({
    reference: order.reference,
    transactionId: tx.x_transaction_id ?? tx.x_ref_payco,
    rawStatus: tx.x_response ? `${tx.x_cod_response}:${tx.x_response}` : tx.x_cod_response,
    outcome: mapEpaycoCode(tx.x_cod_response),
    gatewayReference: tx.x_ref_payco,
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
