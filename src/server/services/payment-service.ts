import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { payoutToCreatorBank } from "@/server/integrations/epayco-client";
import { createNotification } from "@/server/services/notification-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";
import { generateBrandChargeDoc } from "@/lib/billing-pdf";
import { uploadFile } from "@/lib/file-upload";
import { sendBrandChargeEmail, sendBrandPaymentVerifiedEmail, sendBrandChargeReminderEmail } from "@/lib/email";
import { businessDeadline, atDeadlineHour } from "@/lib/colombian-business-days";

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
  // verificar (vencido, inhabilitado o desactivado), lo pendiente del mes
  // siguiente se junta con el mismo corte hasta que se regularice.
  const openCharge = await prisma.brandCharge.findFirst({
    where: { brandId, status: { in: ["PENDING", "PROOF_SUBMITTED", "OVERDUE", "DEACTIVATED"] } },
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
  const dueAt = businessDeadline(new Date(), config.paymentGraceHours);

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
  const dueAtLabel = dueAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

  await createNotification(
    brand.userId,
    "BRAND_CHARGE",
    { monto: formatCOP(totalAmount), fecha: dueAtLabel },
    () =>
      sendBrandChargeEmail(brand.user.email, {
        companyName: brand.companyName,
        totalAmount: formatCOP(totalAmount),
        dueAt: dueAtLabel,
        paymentInstructions: config.paymentInstructions,
      })
  );

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
  const charge = await prisma.brandCharge.findFirst({ where: { id: chargeId, brandId }, include: { brand: true } });
  if (!charge) throw new PaymentError("No se encontró ese corte.");
  if (charge.status === "PAID") throw new PaymentError("Este corte ya está pagado.");

  const updated = await prisma.brandCharge.update({
    where: { id: chargeId },
    data: { status: "PROOF_SUBMITTED", proofUrl, proofSubmittedAt: new Date(), proofRejectedAt: null, proofRejectedReason: null },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", adminRole: { in: ["OWNER", "FINANCE"] } },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) =>
      createNotification(admin.id, "BRAND_PROOF_SUBMITTED_ADMIN", {
        marca: charge.brand.companyName,
        monto: formatCOP(Number(charge.totalAmount)),
      })
    )
  );

  return updated;
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

  await createNotification(charge.brand.userId, "BRAND_PAYMENT_VERIFIED", {}, () =>
    sendBrandPaymentVerifiedEmail(charge.brand.user.email, charge.brand.companyName)
  );
}

/// El admin rechaza el comprobante (no corresponde, monto distinto, etc.)
/// — el corte vuelve a PENDING, o queda/vuelve a OVERDUE o DEACTIVATED
/// según qué plazo ya haya pasado, para que la marca suba uno correcto.
export async function rejectPaymentProof(chargeId: string, adminUserId: string, reason: string) {
  const charge = await prisma.brandCharge.findUniqueOrThrow({
    where: { id: chargeId },
    include: { brand: true },
  });

  const now = new Date();
  const status =
    charge.deactivationDueAt && charge.deactivationDueAt < now
      ? "DEACTIVATED"
      : charge.dueAt < now
        ? "OVERDUE"
        : "PENDING";

  await prisma.brandCharge.update({
    where: { id: chargeId },
    data: { status, proofRejectedAt: new Date(), proofRejectedReason: reason },
  });

  await createNotification(charge.brand.userId, "BRAND_PAYMENT_REJECTED", { razon: reason });
  void adminUserId; // no se guarda por ahora — el registro relevante es el de la marca notificada
}

/// Corre a diario: manda un recordatorio (correo + notificación) a las
/// marcas con un corte abierto cuyo plazo está por vencer — una vez quedan
/// dentro de las 48h, y otra vez dentro de las 24h. Cada aviso se manda
/// una sola vez por corte (marcado en reminder48SentAt/reminder24SentAt),
/// aunque el cron corra varias veces mientras el corte siga abierto. Al
/// correr una vez al día, el momento exacto en que se manda cada aviso cae
/// dentro de esa ventana, no exactamente a las 48h/24h.
export async function sendUpcomingDueReminders() {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const upcoming = await prisma.brandCharge.findMany({
    where: {
      status: { in: ["PENDING", "PROOF_SUBMITTED"] },
      dueAt: { gt: now, lte: in48h },
      OR: [{ reminder48SentAt: null }, { reminder24SentAt: null }],
    },
    include: { brand: { include: { user: true } } },
  });

  let sentCount = 0;
  for (const charge of upcoming) {
    const hoursRemaining = (charge.dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
    const window = hoursRemaining <= 24 ? "24" : "48";
    if (window === "24" && charge.reminder24SentAt) continue;
    if (window === "48" && charge.reminder48SentAt) continue;

    const totalAmount = formatCOP(Number(charge.totalAmount));
    const dueAtLabel = charge.dueAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
    const hoursLabel = window === "24" ? "24 horas" : "48 horas";

    await createNotification(
      charge.brand.userId,
      "BRAND_CHARGE_REMINDER",
      { horas: hoursLabel, monto: totalAmount, fecha: dueAtLabel },
      () =>
        sendBrandChargeReminderEmail(charge.brand.user.email, {
          companyName: charge.brand.companyName,
          totalAmount,
          dueAt: dueAtLabel,
          hoursLabel,
        })
    );

    await prisma.brandCharge.update({
      where: { id: charge.id },
      data: window === "24" ? { reminder24SentAt: now } : { reminder48SentAt: now },
    });
    sentCount++;
  }

  return { sentCount };
}

/// Corre a diario: los cortes cuyo plazo ya venció sin comprobante
/// verificado pasan a OVERDUE (Nivel 2) — panel bloqueado (ver
/// isBrandPaymentLocked), pero el marketplace y los códigos de los
/// creadores siguen funcionando. De una vez se calcula deactivationDueAt
/// (Nivel 2 → 3, en horas hábiles colombianas) para que
/// deactivateOverdueBrands sepa cuándo desactivar el servicio del todo si
/// tampoco se regulariza a tiempo.
export async function markOverdueCharges() {
  const config = await getPlatformConfig();
  const now = new Date();

  const overdue = await prisma.brandCharge.findMany({
    where: { status: { in: ["PENDING", "PROOF_SUBMITTED"] }, dueAt: { lt: now } },
    include: { brand: true },
  });

  for (const charge of overdue) {
    const deactivationDueAt = businessDeadline(now, config.deactivationGraceHours);
    await prisma.brandCharge.update({ where: { id: charge.id }, data: { status: "OVERDUE", deactivationDueAt } });
    await createNotification(charge.brand.userId, "BRAND_LOCKED", {
      fecha: deactivationDueAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }),
    });
  }

  return { lockedCount: overdue.length };
}

/// Corre a diario: manda un solo aviso (correo + notificación) a las marcas
/// OVERDUE cuya fecha de desactivación está a menos de 24h — mismo patrón
/// que sendUpcomingDueReminders, marcado en deactivationReminderSentAt para
/// no repetirlo cada corrida del cron.
export async function sendDeactivationReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = await prisma.brandCharge.findMany({
    where: {
      status: "OVERDUE",
      deactivationDueAt: { not: null, gt: now, lte: in24h },
      deactivationReminderSentAt: null,
    },
    include: { brand: { include: { user: true } } },
  });

  for (const charge of upcoming) {
    const fecha = charge.deactivationDueAt!.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
    await createNotification(charge.brand.userId, "BRAND_DEACTIVATION_REMINDER", { fecha });
    await prisma.brandCharge.update({ where: { id: charge.id }, data: { deactivationReminderSentAt: now } });
  }

  return { sentCount: upcoming.length };
}

/// Corre a diario: los cortes OVERDUE cuya deactivationDueAt ya pasó sin
/// comprobante verificado quedan DEACTIVATED (Nivel 3) — desde ahí,
/// listActiveOffers (marketplace-service.ts) deja de mostrar la marca y
/// recordOrderFromWebhook (attribution-service.ts) deja de atribuir ventas
/// a sus códigos. La deuda acumulada se queda tal cual, no se perdona.
export async function deactivateOverdueBrands() {
  const now = new Date();

  const toDeactivate = await prisma.brandCharge.findMany({
    where: { status: "OVERDUE", deactivationDueAt: { lt: now } },
    include: { brand: { include: { user: true } } },
  });

  for (const charge of toDeactivate) {
    await prisma.brandCharge.update({ where: { id: charge.id }, data: { status: "DEACTIVATED", deactivatedAt: now } });

    await createNotification(charge.brand.userId, "BRAND_DEACTIVATED", {
      monto: formatCOP(Number(charge.totalAmount)),
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", adminRole: { in: ["OWNER", "FINANCE"] } },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        createNotification(admin.id, "BRAND_DEACTIVATED_ADMIN", {
          marca: charge.brand.companyName,
          monto: formatCOP(Number(charge.totalAmount)),
        })
      )
    );
  }

  return { deactivatedCount: toDeactivate.length };
}

/// Si el servicio de la marca está desactivado del todo (Nivel 3) — lo mira
/// recordOrderFromWebhook (attribution-service.ts) para dejar de atribuir
/// ventas a sus códigos. Apenas se verifique el pago (verifyBrandPayment
/// pone el corte en PAID), esto vuelve a dar false solo.
export async function isBrandServiceDeactivated(brandId: string) {
  const charge = await prisma.brandCharge.findFirst({ where: { brandId, status: "DEACTIVATED" } });
  return Boolean(charge);
}

/// SOLO PARA PRUEBAS — igual que chargeBrandForPeriod pero sin depender de
/// que la marca tenga ventas/premios pendientes de facturar: crea de una
/// vez un corte recién generado (PENDING, con el mismo plazo real —
/// paymentGraceHours en horas hábiles) para que el Propietario vea en vivo
/// el aviso de Nivel 1 (dashboard con instrucciones de pago, sin ningún
/// bloqueo) sin esperar al día de cobro. Nunca se llama desde el flujo real
/// de cobro. Respeta la misma regla de "un corte abierto a la vez".
export async function createTestPendingCharge(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId }, include: { user: true } });

  const openCharge = await prisma.brandCharge.findFirst({
    where: { brandId, status: { in: ["PENDING", "PROOF_SUBMITTED", "OVERDUE", "DEACTIVATED"] } },
  });
  if (openCharge) return openCharge;

  const config = await getPlatformConfig();
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dueAt = businessDeadline(new Date(), config.paymentGraceHours);
  const commissionsTotal = 200_000;
  const platformFeeTotal = 37_800;
  const vatTotal = 7_200;
  const totalAmount = commissionsTotal + platformFeeTotal + vatTotal;

  const charge = await prisma.brandCharge.create({
    data: { brandId, periodStart, periodEnd, totalAmount: new Prisma.Decimal(totalAmount), status: "PENDING", dueAt },
  });

  try {
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

  const dueAtLabel = dueAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });
  await createNotification(
    brand.userId,
    "BRAND_CHARGE",
    { monto: formatCOP(totalAmount), fecha: dueAtLabel },
    () =>
      sendBrandChargeEmail(brand.user.email, {
        companyName: brand.companyName,
        totalAmount: formatCOP(totalAmount),
        dueAt: dueAtLabel,
        paymentInstructions: config.paymentInstructions,
      })
  );

  return charge;
}

/// SOLO PARA PRUEBAS — crea de una vez un corte ya vencido (OVERDUE) para
/// que el Propietario pueda ver el aviso de bloqueo en vivo sin esperar un
/// ciclo real de 72h. Nunca se llama desde el flujo real de cobro (ver
/// chargeBrandForPeriod). Respeta la misma regla de "un corte abierto a la
/// vez" — si ya hay uno, lo devuelve tal cual en vez de duplicar.
export async function createTestOverdueCharge(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });

  const openCharge = await prisma.brandCharge.findFirst({
    where: { brandId, status: { in: ["PENDING", "PROOF_SUBMITTED", "OVERDUE", "DEACTIVATED"] } },
  });
  if (openCharge) return openCharge;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dueAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // vencido hace 2 horas
  // Nivel 3 en 72h de reloj (sin lógica de días hábiles, es solo para la
  // demo), pero igual aterrizado a las 3pm — así se ve tal cual como en el
  // flujo real, no a una hora "rara" que dependa de cuándo se dio el click.
  const deactivationDueAt = atDeadlineHour(new Date(Date.now() + 72 * 60 * 60 * 1000));
  const commissionsTotal = 200_000;
  const platformFeeTotal = 37_800;
  const vatTotal = 7_200;
  const totalAmount = commissionsTotal + platformFeeTotal + vatTotal;

  const charge = await prisma.brandCharge.create({
    data: {
      brandId,
      periodStart,
      periodEnd,
      totalAmount: new Prisma.Decimal(totalAmount),
      status: "OVERDUE",
      dueAt,
      deactivationDueAt,
    },
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

  await createNotification(brand.userId, "BRAND_LOCKED", {
    fecha: deactivationDueAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }),
  });

  return charge;
}

/// SOLO PARA PRUEBAS — igual que createTestOverdueCharge pero directo en
/// Nivel 3 (DEACTIVATED), para ver la desaparición del marketplace y el
/// corte de códigos sin esperar los dos ciclos reales de 72h hábiles.
export async function createTestDeactivatedCharge(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });

  const openCharge = await prisma.brandCharge.findFirst({
    where: { brandId, status: { in: ["PENDING", "PROOF_SUBMITTED", "OVERDUE", "DEACTIVATED"] } },
  });
  if (openCharge) return openCharge;

  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dueAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // vencido hace 8 días
  const deactivationDueAt = atDeadlineHour(new Date(Date.now() - 2 * 60 * 60 * 1000)); // el plazo (redondeado a 3pm) que ya se venció
  const deactivatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // el momento exacto en que "pasó" a Nivel 3, sin redondear
  const commissionsTotal = 200_000;
  const platformFeeTotal = 37_800;
  const vatTotal = 7_200;
  const totalAmount = commissionsTotal + platformFeeTotal + vatTotal;

  const charge = await prisma.brandCharge.create({
    data: {
      brandId,
      periodStart,
      periodEnd,
      totalAmount: new Prisma.Decimal(totalAmount),
      status: "DEACTIVATED",
      dueAt,
      deactivationDueAt,
      deactivatedAt,
    },
  });

  await createNotification(brand.userId, "BRAND_DEACTIVATED", { monto: formatCOP(totalAmount) });

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

/// Cuántos comprobantes están esperando revisión — para el contador en
/// Admin → Cobros (misma condición que la cola que se ve ahí: ver
/// AdminFacturacionPage).
export async function countPendingBillingVerifications() {
  return prisma.brandCharge.count({
    where: { proofSubmittedAt: { not: null }, proofRejectedAt: null, status: { not: "PAID" } },
  });
}

/// La marca tiene el panel bloqueado (Nivel 2 o Nivel 3) si tiene un corte
/// sin pagar cuyo plazo ya pasó — se calcula directo contra `dueAt`, no
/// contra el status OVERDUE/DEACTIVATED (que solo los pone el cron una vez
/// al día, para el panel admin y las notificaciones). Así, si la marca sube
/// un comprobante después de vencido el plazo, sigue bloqueada hasta que un
/// admin lo verifique (status PAID) — subir el comprobante no la destraba
/// por sí solo. No distingue Nivel 2 de Nivel 3 a propósito: el panel se ve
/// igual de bloqueado en los dos — lo que sí cambia entre niveles es la
/// visibilidad en marketplace y los códigos (ver marketplace-service.ts y
/// attribution-service.ts, que sí miran status === "DEACTIVATED").
export async function isBrandPaymentLocked(brandId: string) {
  return prisma.brandCharge.findFirst({
    where: { brandId, status: { not: "PAID" }, dueAt: { lt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

/// El corte abierto de la marca, sin importar el nivel — el mismo criterio
/// que usa chargeBrandForPeriod para saber si ya hay uno en curso. A
/// diferencia de isBrandPaymentLocked, esto SÍ incluye Nivel 1 (PENDING,
/// todavía sin vencer, panel sin bloquear) — se usa para mostrar el aviso
/// de cobro con instrucciones de pago en el Dashboard y en Cuenta → Pago
/// (ver ChargePaymentBox), no para bloquear nada.
export async function getOpenBrandCharge(brandId: string) {
  return prisma.brandCharge.findFirst({
    where: { brandId, status: { in: ["PENDING", "PROOF_SUBMITTED", "OVERDUE", "DEACTIVATED"] } },
    orderBy: { createdAt: "desc" },
  });
}

/// Pago del día 15: junta las comisiones APPROVED de un creador (ya pasó
/// su hold de reembolsos) y todavía no se pagaron, en un Payout. El pago en
/// sí ya NO es automático (nunca hubo credenciales reales de ePayco para
/// esto) — queda PENDING hasta que un admin lo transfiera a mano (banco o
/// Bre-B, según lo que eligió el creador) y lo marque pagado (ver
/// markPayoutPaid). No depende de si la marca ya pagó su corte — Marcolini
/// le paga al creador en su fecha normal así la marca esté atrasada o
/// bloqueada; ese riesgo lo asume la plataforma, nunca el creador (ver
/// isBrandPaymentLocked para el lado de la marca).
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

  const payoutReady =
    creator.payoutMethod === "BRE_B"
      ? Boolean(creator.breBKey)
      : creator.payoutMethod === "BANK"
        ? Boolean(creator.bankAccountNumber && creator.bankName && creator.bankAccountType && creator.paymentHolderName)
        : false;

  if (!payoutReady) {
    console.warn(`[pagos] ${creator.displayName} tiene comisiones listas para pagar pero no configuró cómo cobrar — se omite.`);
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
    data: { creatorId, periodStart, periodEnd, totalAmount: new Prisma.Decimal(totalAmount), status: "PENDING" },
  });

  // Se enlazan de una (para que el cron de mañana no los vuelva a agarrar),
  // pero el status de cada comisión/premio sigue APPROVED — solo pasa a
  // PAID cuando el admin confirma la transferencia real en markPayoutPaid.
  await prisma.$transaction([
    prisma.commission.updateMany({
      where: { id: { in: eligible.map((c) => c.id) } },
      data: { payoutId: payout.id },
    }),
    prisma.challengeReward.updateMany({
      where: { id: { in: eligibleRewards.map((r) => r.id) } },
      data: { payoutId: payout.id },
    }),
  ]);

  await createNotification(creator.userId, "PAYOUT_PENDING", { monto: formatCOP(totalAmount) });

  return { payout, totalAmount, commissionCount: itemCount, status: "PENDING" as const };
}

/// El admin ya hizo la transferencia real (banco o Bre-B) y lo confirma —
/// recién aquí las comisiones/premios de ese Payout pasan a PAID.
export async function markPayoutPaid(payoutId: string) {
  const payout = await prisma.payout.findUniqueOrThrow({
    where: { id: payoutId },
    include: { creator: true },
  });

  await prisma.$transaction([
    prisma.payout.update({ where: { id: payoutId }, data: { status: "PAID", paidAt: new Date() } }),
    prisma.commission.updateMany({ where: { payoutId }, data: { status: "PAID" } }),
    prisma.challengeReward.updateMany({ where: { payoutId }, data: { status: "PAID" } }),
  ]);

  await createNotification(payout.creator.userId, "PAYOUT_PAID", { monto: formatCOP(Number(payout.totalAmount)) });
}

/// Los pagos que el admin todavía tiene que transferir a mano — para la
/// cola de Admin → Pagos y el resumen descargable (ver payout-pdf.ts).
export async function listPendingPayouts() {
  return prisma.payout.findMany({
    where: { status: "PENDING" },
    include: { creator: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function countPendingPayouts() {
  return prisma.payout.count({ where: { status: "PENDING" } });
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

    await createNotification(creator.userId, "INSTANT_PAYOUT_PAID", {
      neto: formatCOP(netAmount),
      fee: formatCOP(feeAmount),
    });

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
