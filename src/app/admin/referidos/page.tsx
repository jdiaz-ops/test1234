import { listAllReferrals } from "@/server/services/referral-service";
import { AdminReferralsQueue } from "@/components/portal/admin-referrals-queue";

export default async function AdminReferidosPage() {
  const referrals = await listAllReferrals();

  const qualifiedAmount = referrals
    .filter((r) => r.status === "QUALIFIED")
    .reduce((sum, r) => sum + Number(r.bonusAmount), 0);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">REFERIDOS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Programa de referidos</h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        $20.000 por cada creador que otro invita, pagadero apenas el invitado hace su primera venta. El
        pago es manual — igual que un pago normal a creador — márcalo aquí cuando transfieras.
      </p>

      {qualifiedAmount > 0 && (
        <div className="rounded-2xl border border-brand-accent-soft bg-brand-accent-soft px-4 py-3 mb-6 inline-block">
          <p className="font-mono text-sm font-medium text-brand-accent">
            {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
              qualifiedAmount
            )}{" "}
            por pagar ahora
          </p>
        </div>
      )}

      <AdminReferralsQueue
        items={referrals.map((r) => ({
          id: r.id,
          referrerName: r.referrer.displayName,
          referredName: r.referred.displayName,
          amount: Number(r.bonusAmount),
          status: r.status,
        }))}
      />
    </div>
  );
}
