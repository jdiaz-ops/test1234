import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveCommissionBoost } from "@/server/services/challenge-service";

export class CommissionError extends Error {}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/// Motor de Comisiones: toma una Transaction ya creada por el Motor de
/// Atribución y calcula el reparto exacto — el mismo cálculo que ya se le
/// muestra a las marcas en la calculadora de costos al crear su oferta (ver
/// CostCalculator en offers-panel.tsx), para que lo que la marca vio antes
/// de publicar la oferta sea exactamente lo que se le cobra:
///
///   netAmount            = lo que pagó el cliente (ya con su descuento)
///   creatorCommissionAmount = netAmount * % comisión del creador (100% suyo)
///   platformFeeAmount       = netAmount * % tarifa Marcolini
///   platformFeeVatAmount    = platformFeeAmount * % IVA
///
/// La comisión nace PENDING con un `holdUntil` (hoy + días de espera por
/// reembolsos configurados en PlatformConfig) — el Motor de Pagos (tarea
/// siguiente) es quien agrupa las APPROVED en un Payout real.
export async function createCommissionForTransaction(transactionId: string) {
  const existing = await prisma.commission.findUnique({ where: { transactionId } });
  if (existing) return existing; // idempotente — nunca se duplica una comisión

  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { enrollment: true, offer: true, brand: true },
  });

  if (transaction.status !== "COMPLETED") {
    // Llegó ya reembolsada (o algo cambió entre que se creó la Transaction y
    // se llamó a esta función) — no se genera comisión de una venta que no
    // está en pie.
    return null;
  }

  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });

  // Un TEMP_COMMISSION_BOOST activo en la fecha de la venta es la prioridad
  // máxima: sobrescribe absolutamente todo — el % normal de la oferta Y
  // cualquier override individual que tenga negociado un creador — porque
  // es una campaña temporal pareja para todos los embajadores vinculados a
  // esta oferta mientras dure, sin excepciones.
  const boostPercent = await getActiveCommissionBoost(transaction.offerId, transaction.occurredAt);
  const commissionPercent = Number(
    boostPercent ?? transaction.enrollment.commissionPercentOverride ?? transaction.offer.defaultCommissionPercent
  );
  const platformFeePercent = transaction.brand.platformFeePercentOverride
    ? Number(transaction.brand.platformFeePercentOverride)
    : Number(config.defaultPlatformFeePercent);
  const vatPercent = Number(config.vatPercent);

  const netAmount = Number(transaction.netAmount);
  const creatorCommissionAmount = round2(netAmount * (commissionPercent / 100));
  const platformFeeAmount = round2(netAmount * (platformFeePercent / 100));
  const platformFeeVatAmount = round2(platformFeeAmount * (vatPercent / 100));

  return prisma.commission.create({
    data: {
      transactionId: transaction.id,
      creatorProfileId: transaction.creatorId,
      creatorCommissionAmount: new Prisma.Decimal(creatorCommissionAmount),
      platformFeeAmount: new Prisma.Decimal(platformFeeAmount),
      platformFeeVatAmount: new Prisma.Decimal(platformFeeVatAmount),
      status: "PENDING",
      holdUntil: addDays(transaction.occurredAt, config.refundHoldDays),
    },
  });
}

/// Se llama cuando el Motor de Atribución marca una Transaction como
/// REFUNDED. Una comisión ya PAID no se puede revertir sola aquí — eso
/// implica reclamar plata ya desembolsada, y requiere intervención manual
/// de finanzas (queda visible en Antifraude/Finanzas para ese seguimiento).
export async function reverseCommissionForTransaction(transactionId: string) {
  const commission = await prisma.commission.findUnique({ where: { transactionId } });
  if (!commission) return null;
  if (commission.status === "REVERSED") return commission;

  if (commission.status === "PAID") {
    console.error(
      `[comisiones] Transaction ${transactionId} se reembolsó pero su comisión ya estaba PAID — requiere reclamo manual.`
    );
    return commission;
  }

  return prisma.commission.update({
    where: { id: commission.id },
    data: { status: "REVERSED", reversedAt: new Date() },
  });
}

/// Levanta la espera de 15 días: toda comisión PENDING cuyo holdUntil ya
/// pasó, y cuya venta sigue en pie (no se reembolsó mientras tanto), pasa a
/// APPROVED — lista para el próximo Payout del Motor de Pagos. Se ejecuta a
/// diario (la tarea del Motor de Pagos programará esto); mientras tanto el
/// Panel Admin también lo puede disparar a mano.
export async function approveEligibleCommissions() {
  const eligible = await prisma.commission.findMany({
    where: {
      status: "PENDING",
      holdUntil: { lte: new Date() },
      transaction: { status: "COMPLETED" },
    },
  });

  if (eligible.length === 0) return { approvedCount: 0 };

  await prisma.commission.updateMany({
    where: { id: { in: eligible.map((c) => c.id) } },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  return { approvedCount: eligible.length };
}
