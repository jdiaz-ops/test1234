import { prisma } from "@/lib/prisma";
import { sendAccountInvite } from "@/server/services/auth-service";
import { generateUniqueBaseCode, generateUniqueStorefrontSlug } from "@/lib/creator-identity";

export class AdminCreatorError extends Error {}

/// El admin agrega el creador a mano — mismo espíritu que
/// createBrandManually: nace activo de una (los creadores no tienen cola
/// de aprobación, ver la decisión en Equipo/roles), y le llega un correo
/// para poner su propia contraseña.
export async function createCreatorManually(data: { email: string; displayName: string; desiredCode: string; city?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AdminCreatorError("Ya existe una cuenta con este correo.");

  const baseCode = await generateUniqueBaseCode(data.desiredCode);
  const storefrontSlug = await generateUniqueStorefrontSlug(data.displayName);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      role: "CREATOR",
      emailVerified: new Date(),
      creatorProfile: {
        create: {
          displayName: data.displayName,
          city: data.city,
          baseCode,
          storefrontSlug,
        },
      },
    },
    include: { creatorProfile: true },
  });

  await sendAccountInvite(data.email);

  return user;
}

const TEST_CREATOR_NAMES = ["Creadora Uno Prueba", "Creadora Dos Prueba", "Creadora Tres Prueba"];

/// Crea (o completa) 3 creadores de mentira para que el Propietario pueda
/// probar el marketplace y el portal de creador con "Entrar como" — mismo
/// espíritu que createTestBrands (ver /api/admin/marcas/prueba): nunca se
/// manda correo (no hace falta, nunca se entra con contraseña), y es
/// idempotente — si ya existen (mismo correo), no los duplica.
export async function createTestCreators() {
  const created: string[] = [];
  const yaExistian: string[] = [];

  for (let i = 0; i < TEST_CREATOR_NAMES.length; i++) {
    const email = `creador-prueba-${i + 1}@marcolini.test`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      yaExistian.push(TEST_CREATOR_NAMES[i]);
      continue;
    }

    const baseCode = await generateUniqueBaseCode(`PRUEBA${i + 1}`);
    const storefrontSlug = await generateUniqueStorefrontSlug(TEST_CREATOR_NAMES[i]);

    await prisma.user.create({
      data: {
        email,
        role: "CREATOR",
        emailVerified: new Date(),
        creatorProfile: {
          create: {
            displayName: TEST_CREATOR_NAMES[i],
            baseCode,
            storefrontSlug,
          },
        },
      },
    });
    created.push(TEST_CREATOR_NAMES[i]);
  }

  return { created, yaExistian };
}

export async function listCreators() {
  return prisma.creatorProfile.findMany({
    include: { vertical: true, _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function setCreatorSuspended(creatorId: string, suspended: boolean) {
  const creator = await prisma.creatorProfile.update({
    where: { id: creatorId },
    data: { suspended },
  });
  await prisma.notification.create({
    data: {
      userId: creator.userId,
      type: suspended ? "account_suspended" : "account_reactivated",
      message: suspended
        ? "Tu cuenta fue suspendida. Contáctanos si crees que es un error."
        : "Tu cuenta fue reactivada.",
    },
  });
  return creator;
}
