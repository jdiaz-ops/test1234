import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { payoutToCreatorBank } from "@/server/integrations/epayco-client";
import { createNotification } from "@/server/services/notification-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";
import { generateBrandChargeDoc } from "@/lib/billing-pdf";
import { uploadFile } from "@/lib/file-upload";
import { sendBrandChargeEmail, sendBrandPaymentVerifiedEmail } from "@/lib/email";

export class PaymentError extends Error {}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/// Corte del día 1: junta todo lo que esa marca debe (comisiones de
/// creadores + tarifa Marcolini + IVA) que todavía no se le haya
/// facturado, genera el aviso de cobro (PDF con el desglose, instrucciones
/// de pago por transferencia — QR/Bre-B — y fecha límite) y lo notifica por
/// dashboard y correo. No hay cobro automático ni procesador de pagos de
/// por medio — la marca paga por transferencia directa y sube su
/// comprobante (ver submitPaymentProof) para que un admin lo verifique
/// (ver verifyBrandPayment). Las comisiones incluidas quedan enlazadas a
/// este BrandCharge, solo para el desglose — el pago al creador no depende
/// de que este corte se verifique, ver payoutCreator más abajo.
export async function chargeBrandForPeriod(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId }, include: { user: true } });

  // Nunca se generan dos cortes abiertos a la vez — mientras uno esté sin
  // verificar (o vencido), lo pendiente del mes siguiente se junta con el
  // mismo corte hasta que se regularice.
  const openCharge = await prisma.brandCharge.findFirst({
    where: { brandId, status: { in: ["PENDING", "PROOF_SUBMITTED", "OVERDUE"] } },
  });
  if (openCharge) return null;

  const [pending, pendingRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { brandChargeId: null, status: { in: ["PENDING", "APPROVED"] }, transaction: { brandId } },
      include: { transaction: true },
    }),
    // Premios de retos de esa marca ya aprobados por ella (o automáticos) y
    // todavía no facturados — el bono lo financia la marca, no Marcolini.
    prisma.challengeReward.findMany({
      where: {
        brandChargeId: null,
        status: { in: ["PENDING", "APPROVED"] },
        challenge: { offer: { brandId } },
      },
    }),
  ]);

  if (pending.length === 0 && pendingRewards.length === 0) return null;

  const commissionsTotal = pending.reduce((sum, c) => sum + Number(c.creatorCommissionAmount), 0);
  const platformFeeTotal = pending.reduce((sum, c) => sum + Number(c.platformFeeAmount), 0);
  const vatTotal = pending.reduce((sum, c) => sum + Number(c.platformFeeVatAmount), 0);
  const rewardsTotal = pendingRewards.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalAmount = round2(commissionsTotal + platformFeeTotal + vatTotal + rewardsTotal);

  const occurredDates = [
    ...pending.map((c) => c.transaction.occurredAt.getTime()),
    ...pendingRewards.map((r) => r.createdAt.getTime()),
  ];
  const periodStart = new Date(Math.min(...occurredDates));
  const periodEnd = new Date(Math.max(...occurredDates));

  const config = await getPlatformConfig();
  const dueAt = new Date(Date.now() + config.paymentGraceHours * 60 * 60 * 1000);

  const charge = await prisma.brandCharge.create({
    data: { brandId, periodStart, periodEnd, totalAmount: new Prisma.Decimal(totalAmount), status: "PENDING", dueAt },
  });

  await prisma.$transaction([
    prisma.commission.updateMany({
      where: { id: { in: pending.map((c) => c.id) } },
      data: { brandChargeId: charge.id },
    }),
    prisma.challengeReward.updateMany({
      where: { id: { in: pendingRewards.map((r) => r.id) } },
      data: { brandChargeId: charge.id },
    }),
  ]);

  try {
    const pdfBytes = await generateBrandChargeDoc({
      brandName: brand.companyName,
      periodStart,
      periodEnd,
      commissionsTotal,
      platformFeeTotal,
      vatTotal,
      rewardsTotal,
      totalAmount,
      dueAt,
      paymentInstructions: config.paymentInstructions,
      paymentQrImageUrl: config.paymentQrImageUrl,
    });
    const pdfFile = new File([new Uint8Array(pdfBytes)], "aviso-de-cobro.pdf", { type: "application/pdf" });
    const pdfUrl = await uploadFile(pdfFile, `cortes/${brandId}`);
    await prisma.brandCharge.update({ where: { id: charge.id }, data: { pdfUrl } });
  } catch (err) {
    // El corte ya existe y ya bloquea/factura igual sin el PDF — no vale la
    // pena tumbar todo el proceso por esto, se deja registrado.
    console.error(`[pagos] no se pudo generar el aviso de cobro de ${brand.companyName}:`, err);
  }

  const itemCount = pending.length + pendingRewards.length;
  const dueAtLabel = dueAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  await createNotification(
    brand.userId,
    "BRAND_CHARGE",
    `Nuevo corte: debes ${formatCOP(totalAmount)} (comisiones, tarifa y premios de retos). Fecha límite: ${dueAtLabel}.`
  );
  await sendBrandChargeEmail(brand.user.email, {
    companyName: brand.companyName,
    totalAmount: formatCOP(totalAmount),
    dueAt: dueAtLabel,
    paymentInstructions: config.paymentInstructions,
  });

  return { charge, totalAmount, commissionCount: itemCount, status: "PENDING" as const };
}

/// Corre el corte del día 1 para todas las marcas con algo pendiente de
/// facturar (ventas de creadores o premios de retos).
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

/// La marca sube su comprobante de transferencia — queda pendiente de
/// verificación del admin (ver verifyBrandPayment/rejectPaymentProof). Se
/// puede subir incluso si el corte ya venció (OVERDUE) — un pago tarde
/// sigue destrabando la marca apenas se verifique.
export async function submitPaymentProof(brandId: string, chargeId: string, proofUrl: string) {
  const charge = await prisma.brandCharge.findFirst({ where: { id: chargeId, brandId } });
  if (!charge) throw new PaymentError("No se encontró ese corte.");
  if (charge.status === "PAID") throw new PaymentError("Este corte ya está pagado.");

  return prisma.brandCharge.update({
    where: { id: chargeId },
    data: { status: "PROOF_SUBMITTED", proofUrl, proofSubmittedAt: new Date(), proofRejectedAt: null, proofRejectedReason: null },
  });
}

/// El admin confirma que el comprobante corresponde al pago — reactiva a
/// la marca de inmediato (ver isBrandPaymentLocked, que solo mira
/// OVERDUE).
export async function verifyBrandPayment(chargeId: string, adminUserId: string) {
  const charge = await prisma.brandCharge.findUniqueOrThrow({
    where: { id: chargeId },
    include: { brand: { include: { user: true } } },
  });

  await prisma.brandCharge.update({
    where: { id: chargeId },
    data: { status: "PAID", paidAt: new Date(), verifiedByUserId: adminUserId },
  });

  await createNotification(charge.brand.userId, "BRAND_PAYMENT_VERIFIED", "Verificamos tu pago — tu marca está activa de nuevo.");
  await sendBrandPaymentVerifiedEmail(charge.brand.user.email, charge.brand.companyName);
}

/// El admin rechaza el comprobante (no corresponde, monto distinto, etc.)
/// — el corte vuelve a PENDING (o queda/vuelve a OVERDUE si ya pasó la
/// fecha límite) para que la marca suba uno correcto.
export async function rejectPaymentProof(chargeId: string, adminUserId: string, reason: string) {
  const charge = await prisma.brandCharge.findUniqueOrThrow({
    where: { id: chargeId },
    include: { brand: true },
  });

  const status = charge.dueAt < new Date() ? "OVERDUE" : "PENDING";

  await prisma.brandCharge.update({
    where: { id: chargeId },
    data: { status, proofRejectedAt: new Date(), proofRejectedReason: reason },
  });

  await createNotification(
    charge.brand.userId,
    "BRAND_PAYMENT_REJECTED",
    `Tu comprobante no se pudo verificar: ${reason}. Sube uno nuevo desde Cuenta → Pago.`
  );
  void adminUserId; // no se guarda por ahora — el registro relevante es el de la marca notificada
}

/// Corre a diario: los cortes cuyo plazo ya venció sin comprobante
/// verificado quedan OVERDUE — eso es lo único que isBrandPaymentLocked
/// mira para bloquear la plataforma.
export async function markOverdueCharges() {
  const overdue = await prisma.brandCharge.findMany({
    where: { status: { in: ["PENDING", "PROOF_SUBMITTED"] }, dueAt: { lt: new Date() } },
    include: { brand: true },
  });

  for (const charge of overdue) {
    await prisma.brandCharge.update({ where: { id: charge.id }, data: { status: "OVERDUE" } });
    await createNotification(
      charge.brand.userId,
      "BRAND_LOCKED",
      "Tu marca quedó oculta del marketplace por falta de pago verificado — sube tu comprobante en Cuenta → Pago para reactivarla."
    );
  }

  return { lockedCount: overdue.length };
}

/// SOLO PARA PRUEBAS — crea de una vez un corte ya vencido (OVERDUE) para
/// que el Propietario pueda ver el aviso de bloqueo en vivo sin esperar un
/// ciclo real de 72h. Nunca se llama desde el flujo real de cobro (ver
/// chargeBrandForPeriod). Respeta la misma regla de "un corte abierto a la
/// vez" — si ya hay uno, lo devuelve tal cual en vez de duplicar.
export async function createTestOverdueCharge(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });

  const openCharge = await prisma.brandCharge.findFirst({
    where: { brandId, status: { in: ["PENDING", "PROOF_SUBMITTED", "OVERDUE"] } },
  });
  if (openCharge) return openCharge;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dueAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // vencido hace 2 horas
  const commissionsTotal = 200_000;
  const platformFeeTotal = 37_800;
  const vatTotal = 7_200;
  const totalAmount = commissionsTotal + platformFeeTotal + vatTotal;

  const charge = await prisma.brandCharge.create({
    data: { brandId, periodStart, periodEnd, totalAmount: new Prisma.Decimal(totalAmount), status: "OVERDUE", dueAt },
  });

  try {
    const config = await getPlatformConfig();
    const pdfBytes = await generateBrandChargeDoc({
      brandName: brand.companyName,
      periodStart,
      periodEnd,
      commissionsTotal,
      platformFeeTotal,
      vatTotal,
      rewardsTotal: 0,
      totalAmount,
      dueAt,
      paymentInstructions: config.paymentInstructions,
      paymentQrImageUrl: config.paymentQrImageUrl,
    });
    const pdfFile = new File([new Uint8Array(pdfBytes)], "aviso-de-cobro.pdf", { type: "application/pdf" });
    const pdfUrl = await uploadFile(pdfFile, `cortes/${brandId}`);
    await prisma.brandCharge.update({ where: { id: charge.id }, data: { pdfUrl } });
  } catch (err) {
    console.error(`[pagos] no se pudo generar el aviso de cobro de prueba de ${brand.companyName}:`, err);
  }

  await createNotification(
    brand.userId,
    "BRAND_LOCKED",
    "[Prueba] Tu marca quedó oculta del marketplace por falta de pago verificado — sube tu comprobante en Cuenta → Pago para reactivarla."
  );

  return charge;
}

/// SOLO PARA PRUEBAS — quita un corte para poder repetir la demostración
/// las veces que haga falta. Nunca borra uno con comisiones o premios
/// reales enlazados (eso sí sería perder plata real de la contabilidad).
export async function removeTestCharge(chargeId: string) {
  const charge = await prisma.brandCharge.findUniqueOrThrow({
    where: { id: chargeId },
    include: { commissions: true, challengeRewards: true },
  });
  if (charge.commissions.length > 0 || charge.challengeRewards.length > 0) {
    throw new PaymentError("Este corte tiene comisiones o premios reales enlazados — no se puede borrar.");
  }
  await prisma.brandCharge.delete({ where: { id: chargeId } });
}

/// La marca está bloqueada si tiene un corte sin pagar cuyo plazo ya pasó
/// — se calcula directo contra `dueAt`, no contra el status OVERDUE (que
/// solo lo pone markOverdueCharges una vez al día, para el panel admin y
/// las notificaciones). Así, si la marca sube un comprobante después de
/// vencido el plazo, sigue bloqueada hasta que un admin lo verifique
/// (status PAID) — subir el comprobante no la destraba por sí solo.
export async function isBrandPaymentLocked(brandId: string) {
  return prisma.brandCharge.findFirst({
    where: { brandId, status: { not: "PAID" }, dueAt: { lt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

/// Pago del día 15: junta las comisiones APPROVED de un creador (ya pasó
/// su hold de reembolsos) y todavía no se pagaron, y hace la transferencia
/// bancaria de una sola vez. No depende de si la marca ya pagó su corte —
/// Marcolini le paga al creador en su fecha normal así la marca esté
/// atrasada o bloqueada; ese riesgo lo asume la plataforma, nunca el
/// creador (ver isBrandPaymentLocked para el lado de la marca).
export async function payoutCreator(creatorId: string) {
  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } });

  const [eligible, eligibleRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null, transaction: { creatorId } },
      include: { transaction: true },
    }),
    prisma.challengeReward.findMany({
      where: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null, creatorId },
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
        { commissions: { some: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null } } },
        { challengeRewards: { some: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null } } },
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

/// Cobro anticipado: el creador adelanta TODO lo que ya tiene APPROVED,
/// sin esperar al día 15, pagando el fee configurado (por defecto 5%) —
/// ese fee es ingreso de Marcolini.
export async function requestInstantPayout(creatorId: string) {
  const creator = await prisma.creatorProfile.findUniqueOrThrow({ where: { id: creatorId } });

  if (!creator.bankAccountNumber || !creator.bankName || !creator.bankAccountType || !creator.paymentHolderName) {
    throw new PaymentError("Registra tu cuenta bancaria antes de pedir un pago anticipado.");
  }

  const [eligible, eligibleRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null, transaction: { creatorId } },
    }),
    prisma.challengeReward.findMany({
      where: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null, creatorId },
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
/// cuenta lo que ya está APPROVED (pasó su hold de 15 días); lo que
/// todavía está PENDING no se puede adelantar, apenas está en la ventana
/// de reembolsos.
export async function getInstantPayoutEligibility(creatorId: string) {
  const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
  const feePercent = Number(config.instantPayoutFeePercent);

  const [eligible, eligibleRewards] = await Promise.all([
    prisma.commission.findMany({
      where: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null, transaction: { creatorId } },
    }),
    prisma.challengeReward.findMany({
      where: { status: "APPROVED", payoutId: null, instantPayoutRequestId: null, creatorId },
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
