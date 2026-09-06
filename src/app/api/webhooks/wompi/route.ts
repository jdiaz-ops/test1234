import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getActiveWompiKeys,
  verifyWompiEventChecksum,
} from "@/server/integrations/wompi-client";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";

/// Wompi manda TODOS sus eventos (de cualquier comercio) a la misma URL que
/// cada marca configura en su propio panel de Wompi — por eso este endpoint
/// es único (no por marca): identificamos de quién es el evento por el
/// `reference` del pedido, y ahí sí verificamos la firma con las llaves de
/// esa marca puntual (nunca antes, para no filtrar si un reference existe
/// o no antes de comprobar nada).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || body.event !== "transaction.updated") {
    // Cualquier otro evento (o payload inválido) — respondemos 200 igual
    // para que Wompi no reintente algo que no nos interesa procesar.
    return NextResponse.json({ ok: true });
  }

  const transactionData = body?.data?.transaction;
  const reference: string | undefined = transactionData?.reference;
  const signature = body?.signature;
  const timestamp = body?.timestamp;

  if (
    !reference ||
    !signature?.checksum ||
    !Array.isArray(signature?.properties) ||
    typeof timestamp !== "number"
  ) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const order = await prisma.storeOrder.findUnique({
    where: { reference },
    include: { brand: true },
  });
  if (!order) {
    // No es nuestro — puede ser un evento de otra integración de la misma
    // marca en Wompi que no pasa por "Mi tienda". No es un error.
    return NextResponse.json({ ok: true });
  }

  const keys = getActiveWompiKeys(order.brand);
  if (!keys) {
    return NextResponse.json(
      { error: "Marca sin llaves activas" },
      { status: 400 },
    );
  }

  const valid = verifyWompiEventChecksum({
    data: body.data,
    properties: signature.properties,
    timestamp,
    checksum: signature.checksum,
    eventsKey: keys.eventsKey,
  });
  if (!valid) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  await applyWompiTransactionStatus({
    reference,
    wompiTransactionId: transactionData.id,
    wompiStatus: transactionData.status,
  });

  return NextResponse.json({ ok: true });
}
