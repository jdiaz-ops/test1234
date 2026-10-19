import { redirect } from "next/navigation";
import { requireAllyProfile } from "@/lib/current-ally";
import { formatRate } from "@/lib/ally-earnings";
import { allyOverview } from "@/server/services/ally-service";
import { AllyMonthsTable, AllyReferralsTable, AllyStats } from "@/components/aliados/ally-summary";
import { AllyLinkCard } from "@/components/aliados/ally-link-card";
import { AllyPayoutForm } from "@/components/aliados/ally-payout-form";

export const dynamic = "force-dynamic";

export default async function AllyHomePage() {
  const ally = await requireAllyProfile();
  if (!ally) redirect("/aliado/entrar");
  const overview = await allyOverview(ally.id);
  if (!overview) redirect("/aliado/entrar");

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">TU PORTAL DE ALIADO</p>
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Hola, {overview.ally.name.split(" ")[0]}</h1>
        <p className="text-sm text-brand-ink-soft mt-1 max-w-xl">
          Ganas {formatRate(overview.ally.brandRateBps)} de las ventas de cada marca y {formatRate(overview.ally.creatorRateBps)} de las de cada
          creadora que traigas, durante {overview.ally.windowMonths} meses desde su primera venta. Si traes la marca y la creadora, ganas por las dos.
        </p>
      </div>

      {overview.ally.status === "PAUSED" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Tu link está en pausa: no está recibiendo solicitudes nuevas. Lo que ya ganaste se te sigue pagando.
        </p>
      )}

      <AllyLinkCard link={overview.link} />
      <AllyStats overview={overview} />

      <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
        <h2 className="text-sm font-medium text-brand-ink">Tus marcas y creadoras</h2>
        <AllyReferralsTable overview={overview} />
      </section>

      <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-brand-ink">Lo ganado por mes</h2>
          <p className="text-xs text-brand-ink-soft">
            Se paga mes vencido, a la cuenta de tus datos de pago. Las ventas que se devuelven no cuentan.
          </p>
        </div>
        <AllyMonthsTable overview={overview} />
      </section>

      <section className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-brand-ink">Tus datos de pago</h2>
          <p className="text-xs text-brand-ink-soft">Los usamos solo para pagarte tus comisiones.</p>
        </div>
        <AllyPayoutForm initial={overview.ally.payoutDetails} />
      </section>
    </div>
  );
}
