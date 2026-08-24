import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken, consumeToken, ONE_DAY_MS, ONE_HOUR_MS } from "@/lib/tokens";
import { sendVerificationEmail, sendPasswordResetEmail, sendAccountInviteEmail } from "@/lib/email";
import {
  generateUniqueBaseCode,
  generateUniqueStorefrontSlug,
} from "@/lib/creator-identity";
import { createReferralFromCode } from "@/server/services/referral-service";
import { createNotification } from "@/server/services/notification-service";
import { flagPotentialFraud } from "@/server/services/admin-fraud-service";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export class AuthServiceError extends Error {}

/// Quita el "+algo" antes del @ (ej. "laura+2@gmail.com" -> "laura@gmail.com")
/// — la variante de correo más común para abrir varias cuentas con el
/// mismo correo real. No detecta todas las formas posibles (ej. puntos en
/// Gmail), pero cubre la más usada sin tener que adivinar reglas por
/// proveedor.
function normalizeEmailForDedup(email: string) {
  const [local, domain] = email.toLowerCase().split("@");
  if (!domain) return email.toLowerCase();
  return `${local.split("+")[0]}@${domain}`;
}

/// Detector de fraude: alguien abriendo una segunda cuenta de creador con
/// una variante del mismo correo (ej. para autoreferirse el bono de
/// $20.000, o inflar rachas/insignias). Corre en cada registro; nunca lo
/// bloquea, solo lo deja marcado para revisión — puede ser coincidencia
/// legítima (ej. una agencia con varias cuentas reales).
async function checkDuplicateCreatorAccount(newUserId: string, email: string) {
  const normalized = normalizeEmailForDedup(email);
  const otherCreators = await prisma.user.findMany({
    where: { role: "CREATOR", id: { not: newUserId } },
    select: { email: true },
  });
  const duplicate = otherCreators.find((u) => normalizeEmailForDedup(u.email) === normalized);
  if (!duplicate) return;

  await flagPotentialFraud(
    null,
    `Posible cuenta duplicada: ${email} parece ser la misma persona que ${duplicate.email} (variante del mismo correo)`
  );
}

// --------------------------------------------------------------------------
// Registro de CREADOR
// --------------------------------------------------------------------------

export async function registerCreator(input: {
  email: string;
  password: string;
  displayName: string;
  termsAccepted: boolean;
  refCode?: string;
}) {
  if (!input.termsAccepted) {
    throw new AuthServiceError("Debes aceptar los Términos y Condiciones para registrarte.");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthServiceError("Ya existe una cuenta con este correo.");

  const passwordHash = await bcrypt.hash(input.password, 10);
  // El código nace solo, a partir del nombre (ej. "Laura Gómez" -> "LAURAGOMEZ")
  // — ya no se le pide al creador que lo invente en el registro, para que el
  // paso sea más rápido. Si más adelante hace falta poder personalizarlo,
  // se agrega esa opción en Perfil, no aquí.
  const baseCode = await generateUniqueBaseCode(input.displayName);
  const storefrontSlug = await generateUniqueStorefrontSlug(input.displayName);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: "CREATOR",
      creatorProfile: {
        create: {
          displayName: input.displayName,
          baseCode,
          storefrontSlug,
          termsAcceptedAt: new Date(),
        },
      },
    },
    include: { creatorProfile: true },
  });

  // Programa de referidos — si vino con un código de invitación, se
  // registra la relación acá; nunca bloquea el registro si el código no
  // sirve (ver createReferralFromCode).
  if (input.refCode) {
    await createReferralFromCode(input.refCode, user.creatorProfile!.id);
  }

  await checkDuplicateCreatorAccount(user.id, input.email);

  await sendVerificationForUser(user.email);

  return user;
}

// --------------------------------------------------------------------------
// Registro de MARCA
// --------------------------------------------------------------------------

export async function registerBrand(input: {
  email: string;
  password: string;
  companyName: string;
  city?: string;
  termsAccepted: boolean;
}) {
  if (!input.termsAccepted) {
    throw new AuthServiceError("Debes aceptar los Términos y Condiciones para registrarte.");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthServiceError("Ya existe una cuenta con este correo.");

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: "BRAND",
      brandProfile: {
        create: {
          companyName: input.companyName,
          city: input.city,
          termsAcceptedAt: new Date(),
          // status queda en PENDING por defecto — a la espera de aprobación
          // del admin, como se definió para mantener la curaduría de calidad.
        },
      },
    },
    include: { brandProfile: true },
  });

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", adminRole: { in: ["OWNER", "BRAND_APPROVER"] } },
    select: { id: true },
  });
  await Promise.all(
    admins.map((admin) => createNotification(admin.id, "BRAND_PENDING_ADMIN", { marca: input.companyName }))
  );

  await sendVerificationForUser(user.email);

  return user;
}

// --------------------------------------------------------------------------
// Verificación de email
// --------------------------------------------------------------------------

async function sendVerificationForUser(email: string) {
  const token = await createToken(email, ONE_DAY_MS);
  const verifyUrl = `${APP_URL}/verificar-email?token=${token}`;
  await sendVerificationEmail(email, verifyUrl);
}

export async function verifyEmail(token: string) {
  const email = await consumeToken(token);
  if (!email) {
    throw new AuthServiceError("El link de verificación es inválido o ya expiró.");
  }

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });
}

export async function resendVerificationEmail(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // No revelamos si el correo existe o no, para no filtrar información.
  if (!user || user.emailVerified) return;
  await sendVerificationForUser(email);
}

// --------------------------------------------------------------------------
// Recuperación de contraseña
// --------------------------------------------------------------------------

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return; // no revelamos si el correo existe

  const token = await createToken(email, ONE_HOUR_MS);
  const resetUrl = `${APP_URL}/restablecer-password?token=${token}`;
  await sendPasswordResetEmail(email, resetUrl);
}

/// Para cuentas que el admin crea a mano (marca o creador agregados
/// manualmente, sin pasar por el registro público): reusa el mismo
/// mecanismo de token que la recuperación de contraseña, pero con el
/// correo de invitación en vez del de "recuperar contraseña".
export async function sendAccountInvite(email: string) {
  const token = await createToken(email, ONE_HOUR_MS);
  const setPasswordUrl = `${APP_URL}/restablecer-password?token=${token}`;
  await sendAccountInviteEmail(email, setPasswordUrl);
}

// --------------------------------------------------------------------------
// Cambio de contraseña (usuario ya autenticado, desde Configuración de cuenta)
// --------------------------------------------------------------------------

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) {
    throw new AuthServiceError("Tu cuenta usa login con Google — no tiene contraseña que cambiar.");
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new AuthServiceError("La contraseña actual no es correcta.");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function resetPassword(token: string, newPassword: string) {
  const email = await consumeToken(token);
  if (!email) {
    throw new AuthServiceError("El link para restablecer tu contraseña es inválido o ya expiró.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  });
}
