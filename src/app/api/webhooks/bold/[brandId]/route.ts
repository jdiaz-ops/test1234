import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gatewayForOrder } from "@/server/payments/credentials";
import {
  fetchBoldLink,
  mapBoldEvent,
  mapBoldLinkStatus,
  verifyBoldSignature,
  type BoldValues,
} from "@/server/payments/providers/bold";
import { PaymentGatewayError } from "@/server/payments/types";
import { applyPaymentResult } from "@/server/services/store-order-service";

/// Avisos de Bold para una marca (la URL que pega en Integraciones →
/// Webhook). El aviso identifica el link de pago (data.metadata.reference,
/// LNK_…); el estado real se confirma consultando el link con la llave de
/// identidad de la marca. La firma (x-bold-signature) se exige si la marca
/// guardó su llave secreta. Bold espera respuesta rápida: todo lo que no
/// es nuestro responde 200 de una.
export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const rawBody = await req.text();
  let body: { type?: string; data?: { payment_id?: string; metadata?: { reference?: string | null } } } | null = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const outcomeHint = body?.type ? mapBoldEvent(body.type) : null;
  const linkId = body?.data?.metadata?.reference;
  if (!outcomeHint || !linkId) return NextResponse.json({ ok: true });

  const order = await prisma.storeOrder.findFirst({
    where: { brandId, gatewayReference: linkId, paymentProvider: "BOLD" },
    include: { brand: true },
  });
  if (!order) return NextResponse.json({ ok: true });

  const gateway = gatewayForOrder(order.brand, order);
  if (!gateway) return NextResponse.json({ error: "Marca sin llaves activas" }, { status: 400 });
  const values = gateway.values as BoldValues;
  const signed = values.secretKey
    ? verifyBoldSignature({ rawBody, signature: req.headers.get("x-bold-signature"), secretKey: values.secretKey })
    : false;
  if (values.secretKey && !signed) return NextResponse.json({ error: "Firma inválida" }, { status: 401 });

  try {
    const link = await fetchBoldLink(values, linkId);
    await applyPaymentResult({
      reference: order.reference,
      transactionId: link.transactionId ?? body?.data?.payment_id ?? null,
      rawStatus: link.status,
      outcome: mapBoldLinkStatus(link.status),
    });
  } catch (err) {
    if (!(err instanceof PaymentGatewayError)) throw err;
    // Bold no respondió la consulta: si el aviso venía firmado, vale lo
    // que dice; si no, que reintente (o lo recoge la conciliación).
    if (!signed) return NextResponse.json({ error: "No se pudo consultar el link" }, { status: 503 });
    await applyPaymentResult({
      reference: order.reference,
      transactionId: body?.data?.payment_id ?? null,
      rawStatus: body!.type!,
      outcome: outcomeHint,
    });
  }
  return NextResponse.json({ ok: true });
}
