import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize-email";

/// Diagnóstico exclusivo del Propietario: busca TODAS las filas de User
/// que coincidan con un correo, sin importar mayúsculas/minúsculas — para
/// detectar cuentas duplicadas (mismo correo, dos filas de User distintas)
/// que pudieron crearse antes del fix de normalización de correo (ver
/// normalize-email.ts). Si hay más de una fila acá, ese es el problema:
/// un flujo (reset de contraseña, invitación, registro) puede haber
/// tocado una fila distinta a la que usa el login — cada uno hace su
/// propia búsqueda case-insensitive por separado, y sin un orderBy
/// explícito no hay garantía de que ambas devuelvan siempre la misma fila
/// si existe más de una candidata.
export async function findUsersByEmail(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const users = await prisma.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    include: {
      brandProfile: { select: { companyName: true, status: true } },
      creatorProfile: { select: { displayName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    emailVerified: Boolean(u.emailVerified),
    hasPassword: Boolean(u.passwordHash),
    createdAt: u.createdAt,
    profileName:
      u.brandProfile?.companyName ?? u.creatorProfile?.displayName ?? null,
    brandStatus: u.brandProfile?.status ?? null,
  }));
}
