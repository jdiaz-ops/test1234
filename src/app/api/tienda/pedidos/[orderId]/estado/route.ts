import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getActiveWompiKeys,
  fetchWompiTransaction,
  WompiApiError,
} from "@/server/integrations/wompi-client";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";

/// Respaldo de la página "gracias por tu compra": Wompi redirige al
/// comprador con `?id={transactionId}` en la URL apenas termina de pagar,
/// que suele llegar antes que el webhook. Si el pedido sigue PENDING,
/// consultamos ese id directo contra la API de Wompi para no dejar al
/// comprador esperando si el webhook se demora o no está configurado.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const wompiId = new URL(req.url).searchParams.get("id");

  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: { brand: true },
  });
  if (!order) {
    return NextResponse.json(
      { error: "Pedido no encontrado" },
      { status: 404 },
    );
  }

  if (order.status !== "PENDING" || !wompiId) {
    return NextResponse.json({ status: order.status });
  }

  const keys = getActiveWompiKeys(order.brand);
  if (!keys) {
    return NextResponse.json({ status: order.status });
  }

  try {
    const txn = await fetchWompiTransaction(keys.mode, keys.publicKey, wompiId);
    if (txn && txn.reference === order.reference) {
      const { order: updated } = await applyWompiTransactionStatus({
        reference: order.reference,
        wompiTransactionId: txn.id,
        wompiStatus: txn.status,
      });
      return NextResponse.json({ status: updated?.status ?? order.status });
    }
  } catch (err) {
    if (!(err instanceof WompiApiError)) throw err;
    // Wompi no respondió — el webhook todavía puede llegar después, no es
    // un error fatal para el comprador.
  }

  return NextResponse.json({ status: order.status });
}
