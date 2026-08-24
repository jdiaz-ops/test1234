import { auth } from "@/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  getBrandDashboardSummary,
  getTopCreatorsForBrand,
  countPendingApprovalsForBrand,
} from "@/server/services/brand-finance-service";
import { getOpenBrandCharge } from "@/server/services/payment-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";
import { ChargePaymentBox } from "@/components/portal/charge-payment-box";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default async function MarcaDashboardPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const [summary, topCreators, pendingApprovals, openCharge] = await Promise.all([
    getBrandDashboardSummary(profile.id),
    getTopCreatorsForBrand(profile.id, 3),
    countPendingApprovalsForBrand(profile.id),
    // Nivel 2/3 (OVERDUE/DEACTIVATED) nunca llegan hasta acá — el layout ya
    // los intercepta con la pantalla de bloqueo (ver marca/layout.tsx) — así
    // que si hay algo aquí, es Nivel 1 (PENDING) o un comprobante recién
    // subido en revisión (PROOF_SUBMITTED), y el panel sigue sin bloquear.
    getOpenBrandCharge(profile.id),
  ]);
  const platformConfig = openCharge ? await getPlatformConfig() : null;

  const totalCost = summary.commissionPaidToCreators + summary.platformFeePaid;
  const roi = totalCost > 0 ? summary.gmv / totalCost : null;
  const aov = summary.orderCount > 0 ? summary.gmv / summary.orderCount : null;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">DASHBOARD</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">{profile.companyName}</h1>

      {openCharge && platformConfig && (
        <div className="mb-6">
          <ChargePaymentBox
            charge={{
              id: openCharge.id,
              totalAmount: Number(openCharge.totalAmount),
              dueAt: openCharge.dueAt.toISOString(),
              deactivationDueAt: openCharge.deactivationDueAt?.toISOString() ?? null,
              deactivatedAt: openCharge.deactivatedAt?.toISOString() ?? null,
              status: openCharge.status,
              pdfUrl: openCharge.pdfUrl,
              proofSubmittedAt: openCharge.proofSubmittedAt?.toISOString() ?? null,
              proofRejectedAt: openCharge.proofRejectedAt?.toISOString() ?? null,
              proofRejectedReason: openCharge.proofRejectedReason,
            }}
            paymentInstructions={platformConfig.paymentInstructions}
            paymentQrImageUrl={platformConfig.paymentQrImageUrl}
          />
        </div>
      )}

      {pendingApprovals > 0 && (
        <Link
          href="/marca/creadores"
          className="flex items-center gap-2 text-sm text-brand-accent font-medium mb-6 hover:underline"
        >
          <span className="bg-brand-accent text-white text-[10px] font-mono font-medium rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {pendingApprovals}
          </span>
          {pendingApprovals === 1
            ? "creador esperando tu aprobación"
            : "creadores esperando tu aprobación"}
        </Link>
      )}

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
          <p className="text-xs text-brand-ink-soft mb-1">Ticket promedio</p>
          <p className="font-display text-xl font-semibold text-brand-ink">
            {aov ? formatCOP(aov) : "—"}
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
          <p className="text-xs text-brand-ink-soft mt-1">por cada $1 invertido en comisión + tarifa</p>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-accent-soft/40 p-6 mb-10">
        <p className="text-sm text-brand-ink">
          Este mes invertiste{" "}
          <span className="font-mono text-brand-accent font-medium">{formatCOP(totalCost)}</span>{" "}
          (comisiones a creadores + tarifa Marcolini) y generaste{" "}
          <span className="font-mono text-brand-accent font-medium">{formatCOP(summary.gmv)}</span> en
          ventas.
        </p>
      </div>

      {topCreators.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-brand-ink mb-4">Tus creadores top</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {topCreators.map((c) => (
              <div key={c.id} className="rounded-2xl border border-brand-line bg-brand-surface p-5 text-center">
                {c.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photoUrl} alt={c.displayName} className="w-14 h-14 rounded-full object-cover mx-auto mb-3" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-brand-accent-soft text-brand-accent font-display font-semibold flex items-center justify-center mx-auto mb-3">
                    {initials(c.displayName)}
                  </div>
                )}
                <p className="font-display font-semibold text-brand-ink mb-2">{c.displayName}</p>
                <p className="text-xs text-brand-ink-soft">
                  Te generó <span className="font-mono text-brand-ink">{c.orderCount}</span>{" "}
                  {c.orderCount === 1 ? "orden" : "órdenes"} ·{" "}
                  <span className="font-mono text-brand-accent">{formatCOP(c.revenue)}</span> en ingresos
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
