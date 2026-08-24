import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listActiveChallengesForCreator, listRewardsForCreator } from "@/server/services/challenge-service";
import { CreatorChallengesPanel } from "@/components/portal/creator-challenges-panel";
import { HIDDEN_CHALLENGE_TYPES, type ChallengeType } from "@/lib/challenge-types";

const rewardStatusLabel: Record<string, string> = {
  PENDING_REVIEW: "En revisión",
  PENDING: "En espera",
  APPROVED: "Aprobado",
  PAID: "Pagado",
  REJECTED: "No aprobado",
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

export default async function CreadorRetosPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

  const [active, rewards] = await Promise.all([
    listActiveChallengesForCreator(profile.id),
    listRewardsForCreator(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CAMPAÑAS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Gana más</h1>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Campañas activas</h2>
      <CreatorChallengesPanel
        activeChallenges={active
          .filter((a) => !HIDDEN_CHALLENGE_TYPES.includes(a.challenge.type as ChallengeType))
          .map((a) => ({
          challenge: {
            id: a.challenge.id,
            name: a.challenge.name,
            type: a.challenge.type as ChallengeType,
            endDate: a.challenge.endDate.toISOString(),
            config: a.challenge.config as Record<string, unknown>,
            offer: { name: a.challenge.offer.name, brand: { companyName: a.challenge.offer.brand.companyName } },
          },
          myReward: a.myReward ? { id: a.myReward.id, status: a.myReward.status, amount: Number(a.myReward.amount) } : null,
          progress: a.progress,
        }))}
      />

      {rewards.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display font-semibold text-brand-ink mb-4">Tus premios</h2>
          <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-brand-line">
                {rewards.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3 text-brand-ink">{r.challenge.name}</td>
                    <td className="px-5 py-3 text-brand-ink-soft">{r.challenge.offer.brand.companyName}</td>
                    <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(r.amount))}</td>
                    <td className="px-5 py-3 text-brand-ink-soft">{rewardStatusLabel[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
