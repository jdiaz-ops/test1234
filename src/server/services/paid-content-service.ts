import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";

/// Contenido pagado ENCARGADO (no uno ya publicado — ver
/// content-license-service.ts para eso) — inspirado en "Creator
/// Connections" de Amazon. La marca le pide a un creador ya vinculado que
/// haga algo nuevo por un fee fijo; el creador acepta o rechaza. El fee
/// solo se factura/paga cuando el creador entrega de verdad (ver
/// deliverPaidContent) — no hay pago por adelantado, porque acá sí hay
/// riesgo real de que el contenido nunca llegue.

export class PaidContentError extends Error {}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

// ----------------------------------------------------------------- MARCA

export async function requestPaidContent(
  brandId: string,
  data: { creatorId: string; briefing: string; feeAmount: number; deadlineDays?: number | null },
) {
  const linked = await prisma.creatorOfferEnrollment.findFirst({
    where: { status: "ACTIVE", creatorId: data.creatorId, offer: { brandId } },
    include: { creator: true },
  });
  if (!linked) {
    throw new PaidContentError(
      "Solo puedes encargar contenido a creadores ya vinculados a tu programa.",
    );
  }

  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });

  const request = await prisma.paidContentRequest.create({
    data: {
      brandId,
      creatorId: data.creatorId,
      briefing: data.briefing,
      feeAmount: data.feeAmount,
      deadlineDays: data.deadlineDays ?? null,
    },
  });

  await createNotification(linked.creator.userId, "PAID_CONTENT_REQUESTED", {
    marca: brand.companyName,
    monto: formatCOP(data.feeAmount),
  });

  return request;
}

export async function listBrandPaidContentRequests(brandId: string) {
  return prisma.paidContentRequest.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { displayName: true, photoUrl: true } } },
  });
}

/// La marca puede retirar un encargo mientras el creador no haya
/// respondido — una vez aceptado, ya quedó comprometido y no se cancela
/// desde acá (si hay un problema real, lo resuelve un admin a mano).
export async function cancelPaidContentRequest(brandId: string, requestId: string) {
  const request = await prisma.paidContentRequest.findFirst({
    where: { id: requestId, brandId, status: "REQUESTED" },
  });
  if (!request) throw new PaidContentError("Ese encargo no se puede cancelar.");
  return prisma.paidContentRequest.update({
    where: { id: request.id },
    data: { status: "CANCELLED" },
  });
}

// ---------------------------------------------------------------- CREADOR

export async function listCreatorPaidContentRequests(creatorId: string) {
  return prisma.paidContentRequest.findMany({
    where: { creatorId },
    orderBy: { createdAt: "desc" },
    include: { brand: { select: { companyName: true, logoUrl: true } } },
  });
}

export async function respondToPaidContentRequest(
  creatorId: string,
  requestId: string,
  decision: "ACCEPT" | "DECLINE",
) {
  const request = await prisma.paidContentRequest.findFirst({
    where: { id: requestId, creatorId, status: "REQUESTED" },
    include: { brand: true, creator: true },
  });
  if (!request) throw new PaidContentError("Ese encargo no está disponible.");

  const updated = await prisma.paidContentRequest.update({
    where: { id: request.id },
    data: {
      status: decision === "ACCEPT" ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
    },
  });

  await createNotification(
    request.brand.userId,
    decision === "ACCEPT" ? "PAID_CONTENT_REQUEST_ACCEPTED" : "PAID_CONTENT_REQUEST_DECLINED",
    {
      creador: request.creator.displayName,
      monto: formatCOP(Number(request.feeAmount)),
    },
  );

  return updated;
}

/// El creador ya hizo el contenido y lo entrega — recién ACÁ se calcula el
/// split (comisión de Marcolini + neto del creador) y queda listo para
/// entrar al próximo corte de la marca / próximo pago del creador, igual
/// que un ContentLicense.
export async function deliverPaidContent(
  creatorId: string,
  requestId: string,
  data: { deliveryUrl: string; deliveryScreenshotUrl: string },
) {
  const request = await prisma.paidContentRequest.findFirst({
    where: { id: requestId, creatorId, status: "ACCEPTED" },
    include: { brand: true, creator: true },
  });
  if (!request) throw new PaidContentError("Ese encargo no está listo para entregar.");

  const config = await getPlatformConfig();
  const feeAmount = Number(request.feeAmount);
  const platformCutAmount = round2(feeAmount * (Number(config.contentLicenseCommissionPercent) / 100));
  const creatorNetAmount = round2(feeAmount - platformCutAmount);

  const updated = await prisma.paidContentRequest.update({
    where: { id: request.id },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
      deliveryUrl: data.deliveryUrl,
      deliveryScreenshotUrl: data.deliveryScreenshotUrl,
      platformCutAmount,
      creatorNetAmount,
    },
  });

  await createNotification(request.brand.userId, "PAID_CONTENT_DELIVERED", {
    creador: request.creator.displayName,
  });

  return updated;
}
