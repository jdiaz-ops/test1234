import { prisma } from "@/lib/prisma";
import { createNotification } from "@/server/services/notification-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";

/// Licenciamiento de contenido: el creador ofrece un post YA publicado
/// (Instagram/TikTok) para que una marca alquile el derecho de reusarlo
/// como pauta paga (Meta/TikTok Ads) por un tiempo determinado — fee fijo,
/// sin código de descuento ni venta de por medio (ver ContentLicense en el
/// schema). Solo se puede alquilar contenido de un creador con el que la
/// marca ya tiene una vinculación ACTIVE — igual que "ofrecer muestra"
/// desde el buscador, esto no es para reclutar creadores nuevos.

export class ContentLicenseError extends Error {}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

// ---------------------------------------------------------------- CREADOR

export async function listCreatorLicensableContent(creatorId: string) {
  return prisma.licensableContent.findMany({
    where: { creatorId },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { licenses: true } },
    },
  });
}

export async function createLicensableContent(
  creatorId: string,
  data: {
    platform: "INSTAGRAM" | "TIKTOK";
    contentUrl: string;
    screenshotUrl: string;
    caption?: string;
    pricePer30Days: number;
  },
) {
  return prisma.licensableContent.create({
    data: {
      creatorId,
      platform: data.platform,
      contentUrl: data.contentUrl,
      screenshotUrl: data.screenshotUrl,
      caption: data.caption || null,
      pricePer30Days: data.pricePer30Days,
    },
  });
}

export async function updateLicensableContent(
  creatorId: string,
  data: { contentId: string; active?: boolean; pricePer30Days?: number; caption?: string },
) {
  const content = await prisma.licensableContent.findFirst({
    where: { id: data.contentId, creatorId },
  });
  if (!content) throw new ContentLicenseError("Contenido no encontrado.");

  return prisma.licensableContent.update({
    where: { id: content.id },
    data: {
      ...(data.active != null ? { active: data.active } : {}),
      ...(data.pricePer30Days != null ? { pricePer30Days: data.pricePer30Days } : {}),
      ...(data.caption !== undefined ? { caption: data.caption || null } : {}),
    },
  });
}

/// Licencias que le han alquilado a este creador — para que vea qué se
/// vendió y cuánto le van a pagar (aunque el pago real corra por el motor
/// de payoutCreator normal, junto con sus comisiones).
export async function listCreatorLicenses(creatorId: string) {
  return prisma.contentLicense.findMany({
    where: { creatorId },
    orderBy: { createdAt: "desc" },
    include: {
      content: true,
      brand: { select: { companyName: true, logoUrl: true } },
    },
  });
}

// ----------------------------------------------------------------- MARCA

/// Solo contenido de creadores con los que la marca ya tiene una
/// vinculación ACTIVE — no es un catálogo abierto de reclutamiento, es para
/// marcas que ya trabajan con ese creador y quieren reusar algo que ya
/// publicó.
export async function listBrandLicenseCatalog(brandId: string) {
  const linkedCreatorIds = (
    await prisma.creatorOfferEnrollment.findMany({
      where: { status: "ACTIVE", offer: { brandId } },
      select: { creatorId: true },
    })
  ).map((e) => e.creatorId);

  if (linkedCreatorIds.length === 0) return [];

  return prisma.licensableContent.findMany({
    where: { creatorId: { in: linkedCreatorIds }, active: true },
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, displayName: true, photoUrl: true } },
    },
  });
}

export async function listBrandLicenses(brandId: string) {
  return prisma.contentLicense.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    include: {
      content: true,
      creator: { select: { displayName: true, photoUrl: true } },
    },
  });
}

/// La marca alquila un LicensableContent por `durationDays` (30/60/90). El
/// precio ya lo fijó el creador (pricePer30Days) — la marca no negocia acá,
/// solo elige por cuánto tiempo. El fee se suma al próximo corte de la
/// marca (chargeBrandForPeriod) y la parte del creador a su próximo pago
/// (payoutCreator) — ver esas dos funciones en payment-service.ts.
export async function rentContentLicense(
  brandId: string,
  data: { contentId: string; durationDays: number },
) {
  const content = await prisma.licensableContent.findUnique({
    where: { id: data.contentId },
    include: { creator: true },
  });
  if (!content || !content.active) throw new ContentLicenseError("Ese contenido ya no está disponible.");

  const isLinked = await prisma.creatorOfferEnrollment.findFirst({
    where: { status: "ACTIVE", creatorId: content.creatorId, offer: { brandId } },
  });
  if (!isLinked) {
    throw new ContentLicenseError(
      "Solo puedes alquilar contenido de creadores ya vinculados a tu programa.",
    );
  }

  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });

  const periods = data.durationDays / 30;
  const feeAmount = round2(Number(content.pricePer30Days) * periods);

  const config = await getPlatformConfig();
  const platformCutAmount = round2(feeAmount * (Number(config.contentLicenseCommissionPercent) / 100));
  const creatorNetAmount = round2(feeAmount - platformCutAmount);

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + data.durationDays * 24 * 60 * 60 * 1000);

  const license = await prisma.contentLicense.create({
    data: {
      contentId: content.id,
      brandId,
      creatorId: content.creatorId,
      durationDays: data.durationDays,
      feeAmount,
      platformCutAmount,
      creatorNetAmount,
      startsAt,
      endsAt,
    },
    include: { content: true },
  });

  await createNotification(content.creator.userId, "CONTENT_LICENSE_RENTED", {
    marca: brand.companyName,
    dias: String(data.durationDays),
    monto: formatCOP(creatorNetAmount),
  });

  return license;
}
