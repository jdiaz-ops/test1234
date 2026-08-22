import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tokenizeAndSaveCard, chargeBrandCard, payoutToCreatorBank } from "@/server/integrations/epayco-client";
import { createNotification } from "@/server/services/notification-service";

export class PaymentError extends Error {}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/// Guarda la tarjeta de la marca — tokeniza con ePayco (los datos crudos de
/// la tarjeta nunca tocan nuestra base) y guarda solo la referencia del
/// cliente recurrente resultante.
export async function saveBrandCard(
  brandId: string,
  card: { cardNumber: string; expMonth: string; expYear: string; cvc: string; holderName: string; holderEmail: string }
) {
  const { customerId } = await tokenizeAndSaveCard(card);
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: { cardTokenRef: customerId },
  });
}

/// Cobro del día 1: junta todo lo que esa marca debe (comisiones de
/// creadores + tarifa Marcolini + IVA) que todavía no se le haya cobrado, y
/// lo carga a su tarjeta guardada de una sola vez. Las comisiones incluidas
/// quedan enlazadas a este BrandCharge — solo esas podrán pagarse después a
/// sus creadores (nunca se le paga a un creador con plata que la marca
/// todavía no puso).
export async function chargeBrandForPeriod(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });

  const [pending, pendingRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { brandChargeId: null, status: { in: ["PENDING", "APPROVED"] }, transaction: { brandId } },
      include: { transaction: true },
    }),
    // Premios de retos de esa marca ya aprobados por ella (o automáticos) y
    // todavía no cobrados — el bono lo financia la marca, no Marcolini.
    prisma.challengeReward.findMany({
      where: {
        brandChargeId: null,
        status: { in: ["PENDING", "APPROVED"] },
        challenge: { offer: { brandId } },
      },
    }),
  ]);

  if (pending.length === 0 && pendingRewards.length === 0) return null;

  if (!brand.cardTokenRef) {
    console.warn(`[pagos] La marca ${brand.companyName} tiene comisiones/premios por cobrar pero no tiene tarjeta guardada — se omite.`);
    return null;
  }

  const commissionsTotal = pending.reduce(
    (sum, c) => sum + Number(c.creatorCommissionAmount) + Number(c.platformFeeAmount) + Number(c.platformFeeVatAmount),
    0
  );
  const rewardsTotal = pendingRewards.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalAmount = round2(commissionsTotal + rewardsTotal);

  const occurredDates = [
    ...pending.map((c) => c.transaction.occurredAt.getTime()),
    ...pendingRewards.map((r) => r.createdAt.getTime()),
  ];
  const periodStart = new Date(Math.min(...occurredDates));
  const periodEnd = new Date(Math.max(...occurredDates));

  const charge = await prisma.brandCharge.create({
    data: { brandId, periodStart, periodEnd, totalAmount: new Prisma.Decimal(totalAmount), status: "PENDING" },
  });

  const itemCount = pending.length + pendingRewards.length;

  try {
    const { transactionRef } = await chargeBrandCard({
      customerId: brand.cardTokenRef,
      amount: totalAmount,
      description: `Marcolini — comisiones, tarifa y premios de retos (${itemCount} ítem(s))`,
    });

    await prisma.$transaction([
      prisma.brandCharge.update({
        where: { id: charge.id },
        data: { status: "CHARGED", chargedAt: new Date(), epaycoTransactionRef: transactionRef },
      }),
      prisma.commission.updateMany({
        where: { id: { in: pending.map((c) => c.id) } },
        data: { brandChargeId: charge.id },
      }),
      prisma.challengeReward.updateMany({
        where: { id: { in: pendingRewards.map((r) => r.id) } },
        data: { brandChargeId: charge.id },
      }),
    ]);

    await createNotification(
      brand.userId,
      "BRAND_CHARGE",
      `Se cobraron ${formatCOP(totalAmount)} a tu tarjeta por comisiones, tarifa de Marcolini y premios de retos.`
    );

    return { charge, totalAmount, commissionCount: itemCount, status: "CHARGED" as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    await prisma.brandCharge.update({
      where: { id: charge.id },
      data: { status: "FAILED", failureReason: message },
    });
    await createNotification(
      brand.userId,
      "BRAND_CHARGE_FAILED",
      `No se pudo cobrar ${formatCOP(totalAmount)} a tu tarjeta — revisa tu método de pago.`
    );
    return { charge, totalAmount, commissionCount: itemCount, status: "FAILED" as const };
  }
}

/// Corre el cobro del día 1 para todas las marcas con algo pendiente
/// (comisiones de ventas o premios de retos).
export async function runBrandCharges() {
  const brandIds = await prisma.brandProfile.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { transactions: { some: { commission: { brandChargeId: null, status: { in: ["PENDING", "APPROVED"] } } } } },
        { offers: { some: { challenges: { some: { rewards: { some: { brandChargeId: null, status: { in: ["PENDING", "APPROVED"] } } } } } } } },
      ],
    },
    select: { id: true },
  });

  const results = [];
  for (const { id } of brandIds) {
    const result = await chargeBrandForPeriod(id);
    if (result) results.push({ brandId: id, ...result });
  }
  return results;
}

/// Pago del día 15: junta las comisiones APPROVED de un creador que ya
/// fueron cobradas a su marca (brandChargeId no nulo) y todavía no se
/// pagaron, y hace la transferencia bancaria de una sola vez.
export async function payoutCreator(creatorId: string) {
  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } });

  const [eligible, eligibleRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null, transaction: { creatorId } },
      include: { transaction: true },
    }),
    prisma.challengeReward.findMany({
      where: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null, creatorId },
    }),
  ]);

  if (eligible.length === 0 && eligibleRewards.length === 0) return null;

  if (!creator.bankAccountNumber || !creator.bankName || !creator.bankAccountType || !creator.paymentHolderName) {
    console.warn(`[pagos] ${creator.displayName} tiene comisiones listas para pagar pero no registró cuenta bancaria — se omite.`);
    return null;
  }

  const commissionsTotal = eligible.reduce((sum, c) => sum + Number(c.creatorCommissionAmount), 0);
  const rewardsTotal = eligibleRewards.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalAmount = round2(commissionsTotal + rewardsTotal);

  const occurredDates = [
    ...eligible.map((c) => c.transaction.occurredAt.getTime()),
    ...eligibleRewards.map((r) => r.createdAt.getTime()),
  ];
  const periodStart = new Date(Math.min(...occurredDates));
  const periodEnd = new Date(Math.max(...occurredDates));

  const itemCount = eligible.length + eligibleRewards.length;

  const payout = await prisma.payout.create({
    data: { creatorId, periodStart, periodEnd, totalAmount: new Prisma.Decimal(totalAmount), status: "PROCESSING" },
  });

  try {
    const { transactionRef } = await payoutToCreatorBank({
      bankName: creator.bankName,
      bankAccountType: creator.bankAccountType,
      bankAccountNumber: creator.bankAccountNumber,
      holderName: creator.paymentHolderName,
      amount: totalAmount,
      description: `Marcolini — comisiones y premios de retos (${itemCount} ítem(s))`,
    });

    await prisma.$transaction([
      prisma.payout.update({
        where: { id: payout.id },
        data: { status: "PAID", paidAt: new Date(), epaycoTransactionRef: transactionRef },
      }),
      prisma.commission.updateMany({
        where: { id: { in: eligible.map((c) => c.id) } },
        data: { status: "PAID", payoutId: payout.id },
      }),
      prisma.challengeReward.updateMany({
        where: { id: { in: eligibleRewards.map((r) => r.id) } },
        data: { status: "PAID", payoutId: payout.id },
      }),
    ]);

    await createNotification(creator.userId, "PAYOUT_PAID", `Te pagamos ${formatCOP(totalAmount)} — ya deberían verse en tu cuenta.`);

    return { payout, totalAmount, commissionCount: itemCount, status: "PAID" as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    await prisma.payout.update({ where: { id: payout.id }, data: { status: "FAILED" } });
    await createNotification(creator.userId, "PAYOUT_FAILED", `No pudimos procesar tu pago de ${formatCOP(totalAmount)} — revisa tus datos bancarios.`);
    return { payout, totalAmount, commissionCount: itemCount, status: "FAILED" as const, error: message };
  }
}

/// Corre el pago del día 15 para todos los creadores con algo listo.
export async function runCreatorPayouts() {
  const creatorIds = await prisma.creatorProfile.findMany({
    where: {
      OR: [
        { commissions: { some: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null } } },
        { challengeRewards: { some: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null } } },
      ],
    },
    select: { id: true },
  });

  const results = [];
  for (const { id } of creatorIds) {
    const result = await payoutCreator(id);
    if (result) results.push({ creatorId: id, ...result });
  }
  return results;
}

/// Cobro anticipado: el creador adelanta TODO lo que ya tiene APPROVED y
/// cobrado a la marca, sin esperar al día 15, pagando el fee configurado
/// (por defecto 5%) — ese fee es ingreso de Marcolini.
export async function requestInstantPayout(creatorId: string) {
  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } });

  if (!creator.bankAccountNumber || !creator.bankName || !creator.bankAccountType || !creator.paymentHolderName) {
    throw new PaymentError("Registra tu cuenta bancaria antes de pedir un pago anticipado.");
  }

  const [eligible, eligibleRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null, transaction: { creatorId } },
    }),
    prisma.challengeReward.findMany({
      where: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null, creatorId },
    }),
  ]);

  if (eligible.length === 0 && eligibleRewards.length === 0) {
    throw new PaymentError("No tienes comisiones aprobadas disponibles para adelantar.");
  }

  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const feePercent = Number(config.instantPayoutFeePercent);

  const commissionsTotal = eligible.reduce((sum, c) => sum + Number(c.creatorCommissionAmount), 0);
  const rewardsTotal = eligibleRewards.reduce((sum, r) => sum + Number(r.amount), 0);
  const amountRequested = round2(commissionsTotal + rewardsTotal);
  const feeAmount = round2(amountRequested * (feePercent / 100));
  const netAmount = round2(amountRequested - feeAmount);

  const request = await prisma.instantPayoutRequest.create({
    data: {
      creatorId,
      amountRequested: new Prisma.Decimal(amountRequested),
      feeAmount: new Prisma.Decimal(feeAmount),
      status: "REQUESTED",
    },
  });

  try {
    const { transactionRef } = await payoutToCreatorBank({
      bankName: creator.bankName,
      bankAccountType: creator.bankAccountType,
      bankAccountNumber: creator.bankAccountNumber,
      holderName: creator.paymentHolderName,
      amount: netAmount,
      description: `Marcolini — pago anticipado (fee ${feePercent}%)`,
    });

    await prisma.$transaction([
      prisma.instantPayoutRequest.update({
        where: { id: request.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      }),
      prisma.commission.updateMany({
        where: { id: { in: eligible.map((c) => c.id) } },
        data: { status: "PAID", instantPayoutRequestId: request.id },
      }),
      prisma.challengeReward.updateMany({
        where: { id: { in: eligibleRewards.map((r) => r.id) } },
        data: { status: "PAID", instantPayoutRequestId: request.id },
      }),
    ]);

    await createNotification(
      creator.userId,
      "INSTANT_PAYOUT_PAID",
      `Pago anticipado procesado: ${formatCOP(netAmount)} (se descontó ${formatCOP(feeAmount)} de fee por adelanto).`
    );

    void transactionRef; // referencia ya guardada implícitamente en el log del cliente ePayco
    return { request, amountRequested, feeAmount, netAmount, status: "PROCESSED" as const };
  } catch (err) {
    await prisma.instantPayoutRequest.update({ where: { id: request.id }, data: { status: "FAILED" } });
    const message = err instanceof Error ? err.message : "Error desconocido";
    throw new PaymentError(`No se pudo procesar el pago anticipado: ${message}`);
  }
}

/// Cuánto podría cobrar YA un creador si pide el pago anticipado — solo
/// cuenta lo que ya está APPROVED (pasó su hold de 15 días) y ya se le
/// cobró a la marca (brandChargeId no nulo); lo que todavía está PENDING no
/// se puede adelantar, apenas está en la ventana de reembolsos.
export async function getInstantPayoutEligibility(creatorId: string) {
  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const feePercent = Number(config.instantPayoutFeePercent);

  const [eligible, eligibleRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null, transaction: { creatorId } },
    }),
    prisma.challengeReward.findMany({
      where: { status: "APPROVED", brandChargeId: { not: null }, payoutId: null, instantPayoutRequestId: null, creatorId },
    }),
  ]);

  const commissionsTotal = eligible.reduce((sum, c) => sum + Number(c.creatorCommissionAmount), 0);
  const rewardsTotal = eligibleRewards.reduce((sum, r) => sum + Number(r.amount), 0);
  const amountAvailable = round2(commissionsTotal + rewardsTotal);
  const feeAmount = round2(amountAvailable * (feePercent / 100));

  return {
    amountAvailable,
    feePercent,
    feeAmount,
    netAmount: round2(amountAvailable - feeAmount),
    commissionCount: eligible.length + eligibleRewards.length,
  };
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}
