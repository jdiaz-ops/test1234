import { prisma } from "@/lib/prisma";

/// Borrado total de los perfiles de prueba (marcas y creadores creados con
/// "Crear marcas/creadores de prueba", correo @marcolini.test). Se queda
/// el creador de prueba 1 a pedido de Juan (2026-10-01). Borra también
/// todo lo que cuelga de ellos: ventas, comisiones, pedidos, cobros,
/// vínculos con marcas, etc. No se puede deshacer.

const TEST_EMAIL_DOMAIN = "@marcolini.test";
export const KEPT_TEST_CREATOR_EMAIL = "creador-prueba-1@marcolini.test";

export async function findTestProfiles() {
  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: TEST_EMAIL_DOMAIN, mode: "insensitive" },
      role: { in: ["BRAND", "CREATOR"] },
      NOT: { email: KEPT_TEST_CREATOR_EMAIL },
    },
    select: {
      id: true,
      email: true,
      role: true,
      brandProfile: { select: { id: true, companyName: true } },
      creatorProfile: { select: { id: true, displayName: true } },
    },
    orderBy: { email: "asc" },
  });
  return users.map((u) => ({
    userId: u.id,
    email: u.email,
    role: u.role,
    brandId: u.brandProfile?.id ?? null,
    creatorId: u.creatorProfile?.id ?? null,
    name: u.brandProfile?.companyName ?? u.creatorProfile?.displayName ?? u.email,
  }));
}

export async function deleteTestProfiles() {
  const profiles = await findTestProfiles();
  if (profiles.length === 0) return { deleted: [] as string[] };

  const B = profiles.flatMap((p) => (p.brandId ? [p.brandId] : []));
  const C = profiles.flatMap((p) => (p.creatorId ? [p.creatorId] : []));
  const U = profiles.map((p) => p.userId);

  await prisma.$transaction(
    async (tx) => {
      // Lo que no se borra solo al borrar la marca o el creador (relaciones
      // sin borrado en cascada), de adentro hacia afuera.
      const orders = (await tx.storeOrder.findMany({ where: { brandId: { in: B } }, select: { id: true } })).map(
        (o) => o.id,
      );
      await tx.sampleRequest.updateMany({ where: { orderId: { in: orders } }, data: { orderId: null } });

      const txIds = (
        await tx.transaction.findMany({
          where: { OR: [{ brandId: { in: B } }, { creatorId: { in: C } }] },
          select: { id: true },
        })
      ).map((t) => t.id);
      await tx.storeOrder.updateMany({ where: { transactionId: { in: txIds } }, data: { transactionId: null } });
      await tx.commission.deleteMany({
        where: { OR: [{ transactionId: { in: txIds } }, { creatorProfileId: { in: C } }] },
      });
      await tx.transaction.deleteMany({ where: { id: { in: txIds } } });
      await tx.storeOrder.deleteMany({ where: { id: { in: orders } } });

      await tx.enrollmentInvitation.deleteMany({
        where: {
          OR: [{ enrollment: { creatorId: { in: C } } }, { enrollment: { offer: { brandId: { in: B } } } }],
        },
      });
      await tx.challengeReward.deleteMany({ where: { creatorId: { in: C } } });
      await tx.creatorReferral.deleteMany({
        where: { OR: [{ referrerId: { in: C } }, { referredId: { in: C } }] },
      });
      await tx.contentLicense.deleteMany({
        where: { OR: [{ brandId: { in: B } }, { creatorId: { in: C } }, { content: { creatorId: { in: C } } }] },
      });
      await tx.paidContentRequest.deleteMany({
        where: { OR: [{ brandId: { in: B } }, { creatorId: { in: C } }] },
      });
      await tx.licensableContent.deleteMany({ where: { creatorId: { in: C } } });
      await tx.conversation.deleteMany({ where: { creatorId: { in: C } } });

      // Cobros de las marcas de prueba y pagos de los creadores de prueba:
      // lo de OTRAS cuentas que los apunte queda sin ese vínculo.
      const chargeFilter = { brandCharge: { brandId: { in: B } } };
      await tx.commission.updateMany({ where: chargeFilter, data: { brandChargeId: null } });
      await tx.challengeReward.updateMany({ where: chargeFilter, data: { brandChargeId: null } });
      await tx.brandCharge.deleteMany({ where: { brandId: { in: B } } });
      await tx.payout.deleteMany({ where: { creatorId: { in: C } } });
      await tx.instantPayoutRequest.deleteMany({ where: { creatorId: { in: C } } });

      // El resto (perfil, ofertas, vínculos, productos, tienda, vitrina…)
      // se borra en cascada con la cuenta.
      await tx.user.deleteMany({ where: { id: { in: U } } });
    },
    { timeout: 60_000 },
  );

  return { deleted: profiles.map((p) => p.name) };
}
