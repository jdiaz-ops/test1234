import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/// Tarifa de Marcolini sobre las ventas de Mi tienda que NO llevan código de
/// creadora. Desde el 2026-10-17 (decisión de Juan) la tarifa — el % de
/// PlatformConfig.defaultPlatformFeePercent, o el propio de la marca
/// (platformFeePercentOverride) — se cobra sobre TODA venta pagada en la
/// tienda, tenga o no código: una marca que use solo la tienda paga lo
/// mismo por cada venta. Con código, la tarifa va dentro de la Commission
/// (platformFeeAmount, junto con la comisión de la creadora); sin código
/// queda acá. Las dos entran al corte del día 1 (ver chargeBrandForPeriod).
///
/// La base es la misma que Transaction.netAmount: los productos ya con
/// descuento, sin el envío.

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/// Se llama cuando un pedido queda PAID y no quedó atribuido a una creadora
/// (sin código, o con un código que no se reconoció). Idempotente: si ya
/// tiene tarifa, no crea otra.
export async function createStoreSaleFeeForOrder(orderId: string) {
  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    include: { brand: { select: { platformFeePercentOverride: true } }, saleFee: { select: { id: true } } },
  });
  if (!order || order.saleFee) return null;
  // Solo ventas reales y pagadas sin creadora; nunca una compra de prueba de
  // Wompi ni una muestra ($0).
  if (order.kind !== "PURCHASE" || order.status !== "PAID" || order.transactionId || order.paymentMode === "TEST") {
    return null;
  }
  const baseCents = order.subtotalCents - order.discountCents;
  if (baseCents <= 0) return null;

  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const feePercent = Number(order.brand.platformFeePercentOverride ?? config.defaultPlatformFeePercent);
  const baseAmount = baseCents / 100;
  const feeAmount = round2(baseAmount * (feePercent / 100));
  const vatAmount = round2(feeAmount * (Number(config.vatPercent) / 100));

  try {
    return await prisma.storeSaleFee.create({
      data: {
        orderId: order.id,
        brandId: order.brandId,
        baseAmount: new Prisma.Decimal(baseAmount),
        feePercent: new Prisma.Decimal(feePercent),
        feeAmount: new Prisma.Decimal(feeAmount),
        vatAmount: new Prisma.Decimal(vatAmount),
      },
    });
  } catch (err) {
    // El webhook de Wompi y la consulta directa pueden llegar a la vez: la
    // restricción única dice que el otro ya la creó.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return prisma.storeSaleFee.findUnique({ where: { orderId: order.id } });
    }
    throw err;
  }
}

/// La venta se devolvió (ver refundStoreOrder): si la tarifa todavía no
/// entró a un corte, se anula. Si ya se cobró, queda para ajuste manual —
/// igual que una comisión ya pagada (ver reverseCommissionForTransaction).
export async function reverseStoreSaleFee(orderId: string) {
  const fee = await prisma.storeSaleFee.findUnique({ where: { orderId } });
  if (!fee || fee.status === "REVERSED") return fee;
  if (fee.brandChargeId) {
    console.error(
      `[tarifa] El pedido ${orderId} se devolvió pero su tarifa ya entró al corte ${fee.brandChargeId} — requiere ajuste manual.`,
    );
    return fee;
  }
  return prisma.storeSaleFee.update({
    where: { id: fee.id },
    data: { status: "REVERSED", reversedAt: new Date() },
  });
}
