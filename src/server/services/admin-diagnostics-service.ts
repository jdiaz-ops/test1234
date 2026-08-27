import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize-email";

export class AdminDiagnosticsError extends Error {}

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

/// Borra una fila de User completa — para limpiar una cuenta de prueba
/// duplicada que quedó ocupando un correo que se necesita para una cuenta
/// real. Sin deshacer: antes de llamarla, confirmar con findUsersByEmail
/// que es la fila correcta.
///
/// El schema NO pone onDelete: Cascade en todo lo que cuelga de
/// CreatorProfile/BrandProfile a propósito — específicamente en lo que
/// representa dinero real ya movido (Transaction, Commission, Payout,
/// InstantPayoutRequest, BrandCharge): borrar un usuario nunca debe borrar
/// en silencio su historial financiero. Por eso, si existe cualquiera de
/// esas filas, esta función se niega a borrar — hay que resolverlo a mano
/// (no es el caso de una cuenta de prueba real). Lo demás que cuelga sin
/// cascade (CreatorReferral, ChallengeReward, Conversation) sí se limpia acá
/// antes de borrar el User, porque sin este paso Postgres rechaza el borrado
/// por la restricción de llave foránea — antes fallaba así, en silencio,
/// sin mostrar ningún error.
export async function deleteUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { creatorProfile: true, brandProfile: true },
  });
  if (!user) throw new AdminDiagnosticsError("Esa cuenta ya no existe.");

  if (user.creatorProfile) {
    const creatorId = user.creatorProfile.id;
    const [transactions, commissions, payouts, instantPayouts] =
      await Promise.all([
        prisma.transaction.count({ where: { creatorId } }),
        prisma.commission.count({ where: { creatorProfileId: creatorId } }),
        prisma.payout.count({ where: { creatorId } }),
        prisma.instantPayoutRequest.count({ where: { creatorId } }),
      ]);
    if (transactions || commissions || payouts || instantPayouts) {
      throw new AdminDiagnosticsError(
        "Esta cuenta tiene ventas, comisiones o pagos reales asociados — no se puede borrar desde acá.",
      );
    }

    await prisma.$transaction([
      prisma.conversation.deleteMany({ where: { creatorId } }),
      prisma.creatorReferral.deleteMany({
        where: { OR: [{ referrerId: creatorId }, { referredId: creatorId }] },
      }),
      prisma.challengeReward.deleteMany({ where: { creatorId } }),
    ]);
  }

  if (user.brandProfile) {
    const brandId = user.brandProfile.id;
    const [transactions, charges] = await Promise.all([
      prisma.transaction.count({ where: { brandId } }),
      prisma.brandCharge.count({ where: { brandId } }),
    ]);
    if (transactions || charges) {
      throw new AdminDiagnosticsError(
        "Esta cuenta tiene ventas o cobros reales asociados — no se puede borrar desde acá.",
      );
    }
  }

  await prisma.user.delete({ where: { id: userId } });
}
