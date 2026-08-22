import {
  getGlobalDashboardSummary,
  getProfitabilityByMonth,
  getMarketInsight,
} from "@/server/services/admin-dashboard-service";
import { ProfitabilityPanel } from "@/components/portal/profitability-panel";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

export default async function AdminDashboardPage() {
  const [summary, profitability, insight] = await Promise.all([
    getGlobalDashboardSummary(),
    getProfitabilityByMonth(),
    getMarketInsight(),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">DASHBOARD GLOBAL</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Marcolini en números</h1>

      <div className="grid sm:grid-cols-4 gap-4 mb-10">
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">GMV total</p>
          <p className="font-display text-xl font-semibold text-brand-ink">{formatCOP(summary.gmv)}</p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Ingreso de plataforma</p>
          <p className="font-display text-xl font-semibold text-brand-accent">
            {formatCOP(summary.platformRevenue)}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Marcas activas</p>
          <p className="font-display text-xl font-semibold text-brand-ink">{summary.activeBrandCount}</p>
          <p className="text-xs text-brand-ink-soft mt-1">+{summary.newBrandsThisMonth} este mes</p>
        </div>
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
          <p className="text-xs text-brand-ink-soft mb-1">Creadores</p>
          <p className="font-display text-xl font-semibold text-brand-ink">{summary.creatorCount}</p>
          <p className="text-xs text-brand-ink-soft mt-1">+{summary.newCreatorsThisMonth} este mes</p>
        </div>
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Panel de Rentabilidad</h2>
      <p className="text-sm text-brand-ink-soft mb-4 max-w-lg">
        El ingreso se calcula solo (tu tarifa de plataforma). El costo lo
        ingresas tú una vez al mes — hosting, herramientas, lo que gastes en
        mantener Marcolini funcionando.
      </p>
      <div className="mb-10">
        <ProfitabilityPanel rows={profitability} />
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Insight de mercado</h2>
      <p className="text-sm text-brand-ink-soft mb-4 max-w-lg">
        Rendimiento por marca, calculado a partir de las ventas reales.
      </p>
      {!insight.hasData ? (
        <p className="text-sm text-brand-ink-soft">Todavía no hay ventas registradas.</p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Marca</th>
                <th className="px-5 py-3 font-normal">Ventas</th>
                <th className="px-5 py-3 font-normal">Total</th>
                <th className="px-5 py-3 font-normal">Ticket promedio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {insight.brandStats.map((b) => (
                <tr key={b.name}>
                  <td className="px-5 py-3 text-brand-ink">{b.name}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink-soft">{b.count}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(b.total)}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink-soft">{formatCOP(b.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
