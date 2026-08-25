import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listChallengesForBrand, listSubmissionsForBrand } from "@/server/services/challenge-service";
import { ChallengesPanel } from "@/components/portal/challenges-panel";
import { HIDDEN_CHALLENGE_TYPES, type ChallengeType } from "@/lib/challenge-types";

export default async function RetosPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  const [offersRaw, challenges, submissions] = await Promise.all([
    prisma.offer.findMany({
      where: { brandId: profile.id, status: "ACTIVE" },
      select: { id: true, name: true, defaultCommissionPercent: true, defaultDiscountPercent: true },
    }),
    listChallengesForBrand(profile.id),
    listSubmissionsForBrand(profile.id),
  ]);
  const offers = offersRaw.map((o) => ({
    ...o,
    defaultCommissionPercent: Number(o.defaultCommissionPercent),
    defaultDiscountPercent: Number(o.defaultDiscountPercent),
  }));

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CAMPAÑAS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Motiva a tus creadores</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Crea una Misión (meta con bono), un Flash Sale (comisión y/o
        descuento elevados), o un Mix de las dos — por un tiempo limitado,
        para motivar a tus creadores a vender más. Por ahora solo puedes
        tener una campaña activa a la vez.
      </p>

      <ChallengesPanel
        offers={offers}
        challenges={challenges
          .filter((c) => !HIDDEN_CHALLENGE_TYPES.includes(c.type as ChallengeType))
          .map((c) => ({
          id: c.id,
          name: c.name,
          // Los dos tipos viejos (TEMP_COMMISSION_BOOST/TEMP_DISCOUNT_BOOST)
          // siguen en el enum de Postgres por compatibilidad, pero ya no
          // existen filas con ellos (se migraron a FLASH_SALE) ni el código
          // vuelve a crearlos — de ahí el cast.
          type: c.type as ChallengeType,
          status: c.status,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
          offer: { name: c.offer.name },
          config: c.config as Record<string, unknown>,
          discountBoostActive: c.discountBoostActive,
          rewards: c.rewards.map((r) => ({
            id: r.id,
            amount: Number(r.amount),
            status: r.status,
            creator: { displayName: r.creator.displayName },
          })),
        }))}
        submissions={submissions.map((s) => ({
          id: s.id,
          submissionUrl: s.submissionUrl,
          submissionNote: s.submissionNote,
          amount: Number(s.amount),
          creator: { displayName: s.creator.displayName },
          challenge: { name: s.challenge.name },
        }))}
      />
    </div>
  );
}
