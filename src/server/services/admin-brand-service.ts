import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendAccountInvite } from "@/server/services/auth-service";
import { createNotification } from "@/server/services/notification-service";
import { normalizeEmail } from "@/lib/normalize-email";
import { PLACEHOLDER_EMAIL_DOMAIN, sendBrandWelcomeEmail } from "@/lib/email";
import { portalUrl } from "@/lib/store-url";

export class AdminBrandError extends Error {}

/// El admin agrega la marca a mano — para el arranque "casi uno a uno",
/// donde la marca ya se validó por fuera (llamada, reunión), así que nace
/// ya Aprobada en vez de pasar por la cola de revisión. Con correo, la
/// persona recibe un link para poner su propia contraseña (nunca se la
/// inventa el admin). Sin correo (2026-10-18), la marca nace "sin dueña":
/// una cuenta provisional con la que el admin la arma por "Entrar como",
/// y cuando la tienda está lista le genera a la dueña un link de acceso
/// (ver generateBrandAccessLink) con el que ella pone su correo y su
/// contraseña (ver claimBrandAccess).
export async function createBrandManually(data: {
  email?: string | null;
  companyName: string;
  city?: string;
}) {
  const email = data.email?.trim() ? normalizeEmail(data.email) : null;
  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (existing)
      throw new AdminBrandError("Ya existe una cuenta con este correo.");
  }

  const placeholder = `marca-${crypto.randomBytes(8).toString("hex")}@${PLACEHOLDER_EMAIL_DOMAIN}`;
  const user = await prisma.user.create({
    data: {
      email: email ?? placeholder,
      role: "BRAND",
      emailVerified: email ? new Date() : null,
      brandProfile: {
        create: {
          companyName: data.companyName,
          city: data.city,
          status: "APPROVED",
          approvedAt: new Date(),
          termsAcceptedAt: new Date(),
          ownerPending: !email,
        },
      },
    },
    include: { brandProfile: true },
  });

  if (email) await sendAccountInvite(email);

  return user;
}

// --------------------------------------------------------------------------
// Link de acceso para una marca sin dueña
// --------------------------------------------------------------------------

/// Vence a los 7 días: tiempo de sobra para mandarlo y que lo abran, sin
/// que un link viejo quede vivo por meses.
const ACCESS_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashAccessToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function accessLinkUrl(token: string) {
  return `${portalUrl()}/activar?token=${token}`;
}

/// Genera (o reemplaza) el link de un solo uso con el que la dueña reclama
/// la marca. Solo se guarda el hash: el link completo se muestra una sola
/// vez al admin, que lo manda por WhatsApp.
export async function generateBrandAccessLink(brandId: string) {
  const brand = await prisma.brandProfile.findUnique({ where: { id: brandId }, select: { ownerPending: true } });
  if (!brand) throw new AdminBrandError("Marca no encontrada.");
  if (!brand.ownerPending) throw new AdminBrandError("Esta marca ya tiene dueña: entra con su correo o recupera la contraseña.");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ACCESS_LINK_TTL_MS);
  await prisma.brandProfile.update({
    where: { id: brandId },
    data: { accessTokenHash: hashAccessToken(token), accessTokenExpiresAt: expiresAt, accessLinkCreatedAt: new Date() },
  });
  return { url: accessLinkUrl(token), expiresAt };
}

export async function revokeBrandAccessLink(brandId: string) {
  await prisma.brandProfile.update({
    where: { id: brandId },
    data: { accessTokenHash: null, accessTokenExpiresAt: null, accessLinkCreatedAt: null },
  });
}

/// La marca a la que apunta un link vigente — lo que ve la dueña en la
/// página de activación. null si el link no existe, venció o ya se usó.
export async function getBrandByAccessToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const brand = await prisma.brandProfile.findUnique({
    where: { accessTokenHash: hashAccessToken(token) },
    select: { id: true, companyName: true, logoUrl: true, ownerPending: true, accessTokenExpiresAt: true },
  });
  if (!brand || !brand.ownerPending || !brand.accessTokenExpiresAt || brand.accessTokenExpiresAt < new Date()) return null;
  return { id: brand.id, companyName: brand.companyName, logoUrl: brand.logoUrl };
}

/// La dueña pone su correo y su contraseña: quedan ligados a la cuenta
/// provisional, el link se invalida y le llega la bienvenida. El correo
/// queda confirmado de una vez — el link que le mandó el admin es la
/// prueba de que es ella.
export async function claimBrandAccess(token: string, data: { email: string; password: string }) {
  const brand = await getBrandByAccessToken(token);
  if (!brand) throw new AdminBrandError("Este link ya no sirve. Pídele a Marcolini uno nuevo.");
  const email = normalizeEmail(data.email);
  const taken = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (taken) {
    throw new AdminBrandError("Ya existe una cuenta con este correo. Si es tuya, entra con ella o recupera la contraseña.");
  }
  const passwordHash = await bcrypt.hash(data.password, 10);
  const profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id }, select: { userId: true } });
  await prisma.$transaction([
    prisma.user.update({ where: { id: profile.userId }, data: { email, emailVerified: new Date(), passwordHash } }),
    prisma.brandProfile.update({
      where: { id: brand.id },
      data: { ownerPending: false, claimedAt: new Date(), accessTokenHash: null, accessTokenExpiresAt: null },
    }),
  ]);
  await sendBrandWelcomeEmail(email, { companyName: brand.companyName, loginUrl: `${portalUrl()}/login` });
  return { email, companyName: brand.companyName };
}

export async function listBrands(status?: string) {
  return prisma.brandProfile.findMany({
    where: status ? { status: status as never } : {},
    include: {
      user: { select: { email: true } },
      vertical: true,
      _count: { select: { offers: true } },
      // Solo el corte abierto (si hay uno) — para mostrar en Marcas si se
      // puede "simular corte vencido" o hay que ofrecer "quitarlo" (ver
      // createTestOverdueCharge/removeTestCharge en payment-service.ts).
      charges: {
        where: { status: { not: "PAID" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getBrand(brandId: string) {
  return prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    include: { user: true, vertical: true, offers: true },
  });
}

export async function approveBrand(brandId: string) {
  const brand = await prisma.brandProfile.update({
    where: { id: brandId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  await createNotification(brand.userId, "BRAND_APPROVED", {});
  return brand;
}

export async function rejectBrand(brandId: string) {
  const brand = await prisma.brandProfile.update({
    where: { id: brandId },
    data: { status: "REJECTED" },
  });
  await createNotification(brand.userId, "BRAND_REJECTED", {});
  return brand;
}

export async function pauseBrand(brandId: string) {
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: { status: "PAUSED" },
  });
}

export async function reactivateBrand(brandId: string) {
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: { status: "APPROVED" },
  });
}

/// Le permite al admin forzar si una marca aparece o no en el marketplace de
/// creadores, sin importar si cumple los requisitos reales de onboarding —
/// pensado para probar visualmente el flujo del creador con marcas de
/// prueba a medio llenar (ver MarketplaceVisibilityOverride en el schema y
/// listActiveOffers en marketplace-service.ts, que es quien lo respeta).
export async function setBrandMarketplaceVisibility(
  brandId: string,
  override: "AUTO" | "FORCE_VISIBLE" | "FORCE_HIDDEN",
) {
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: { marketplaceVisibilityOverride: override },
  });
}

export async function setBrandFeeOverride(
  brandId: string,
  feePercent: number | null,
) {
  const brand = await prisma.brandProfile.update({
    where: { id: brandId },
    data: { platformFeePercentOverride: feePercent },
  });
  await prisma.notification.create({
    data: {
      userId: brand.userId,
      type: "fee_changed",
      message: feePercent
        ? `Tu tarifa de plataforma cambió a ${feePercent}%.`
        : "Tu tarifa de plataforma volvió al valor por defecto.",
    },
  });
  return brand;
}
