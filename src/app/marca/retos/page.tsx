import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listChallengesForBrand, listSubmissionsForBrand } from "@/server/services/challenge-service";
import { ChallengesPanel } from "@/components/portal/challenges-panel";
import { HIDDEN_CHALLENGE_TYPES } from "@/lib/challenge-types";

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
        Lanza un bono por ventas generadas, sube la comisión de todos tus
        creadores, o dale un descuento especial temporal a sus compradores —
        por un tiempo limitado, para motivarlos a vender más.
      </p>

      <ChallengesPanel
        offers={offers}
        challenges={challenges
          .filter((c) => !HIDDEN_CHALLENGE_TYPES.includes(c.type))
          .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          status: c.status,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate.toISOString(),
          offer: { name: c.offer.name },
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
