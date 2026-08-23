import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorDashboardSummary } from "@/server/services/creator-finance-service";
import { getCreatorBadgeBoard } from "@/server/services/creator-badge-service";
import { CreatorBadgesCard } from "@/components/portal/creator-badges-card";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

function nextPayoutDate(dayOfMonth: number) {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (candidate < now) candidate.setMonth(candidate.getMonth() + 1);
  return candidate.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

export default async function CreadorDashboardPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const summary = await getCreatorDashboardSummary(profile.id);
  const badgeBoard = await getCreatorBadgeBoard(profile);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">DASHBOARD</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">
        Hola, {profile.displayName}
      </h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Comisión confirmada</p>
          <p className="font-display text-2xl font-semibold text-brand-ink">
            {formatCOP(summary.approvedPendingPayout)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">lista para tu próximo pago</p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Próximo pago</p>
          <p className="font-display text-2xl font-semibold text-brand-ink">
            {nextPayoutDate(summary.payoutDayOfMonth)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">solo montos ya aprobados</p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Pagado este año</p>
          <p className="font-display text-2xl font-semibold text-brand-ink">
            {formatCOP(summary.paidThisYear)}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">acumulado en desembolsos</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6">
          <h2 className="font-display font-semibold text-brand-ink mb-4">Tus marcas top</h2>
          {summary.topBrands.length === 0 ? (
            <div className="text-sm text-brand-ink-soft">
              <p className="mb-3">Todavía no tienes ventas registradas.</p>
              <a href="/creador/marketplace" className="text-brand-accent font-medium hover:underline">
                Explora el marketplace y únete a una marca →
              </a>
            </div>
          ) : (
            <ul className="divide-y divide-brand-line">
              {summary.topBrands.map((b) => (
                <li key={b.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-brand-ink">{b.name}</span>
                  <span className="font-mono text-brand-ink-soft">{formatCOP(b.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CreatorBadgesCard
          earnedBadges={badgeBoard.earnedBadges}
          nextHint={badgeBoard.nextHint}
          totalCount={badgeBoard.totalCount}
        />
      </div>
    </div>
  );
}
