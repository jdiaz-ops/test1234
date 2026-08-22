import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

export default async function MarcaDashboardPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const summary = await getBrandDashboardSummary(profile.id);

  const roi = summary.platformFeePaid > 0 ? summary.gmv / summary.platformFeePaid : null;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">DASHBOARD</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">{profile.companyName}</h1>

      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 sm:col-span-1">
          <p className="text-xs text-brand-ink-soft mb-1">Ventas generadas vía Marcolini</p>
          <p className="font-display text-xl font-semibold text-brand-ink">{formatCOP(summary.gmv)}</p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Transacciones / órdenes vía Marcolini</p>
          <p className="font-display text-xl font-semibold text-brand-ink">{summary.orderCount}</p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Comisión a creadores</p>
          <p className="font-display text-xl font-semibold text-brand-ink">
            {formatCOP(summary.commissionPaidToCreators)}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Nuevos embajadores</p>
          <p className="font-display text-xl font-semibold text-brand-ink">{summary.newCreatorsThisMonth}</p>
          <p className="text-xs text-brand-ink-soft mt-1">este mes</p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Retorno</p>
          <p className="font-display text-xl font-semibold text-brand-accent">
            {roi ? `${roi.toFixed(1)}x` : "—"}
          </p>
          <p className="text-xs text-brand-ink-soft mt-1">por cada $1 en tarifa</p>
        </div>
      </div>
    </div>
  );
}
