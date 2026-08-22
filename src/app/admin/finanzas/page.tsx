import {
  listBrandCharges,
  listPayouts,
  listStoreHealth,
  getCommissionsSummary,
} from "@/server/services/admin-finance-service";
import { ApproveCommissionsButton } from "@/components/portal/approve-commissions-button";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

const healthLabel: Record<string, string> = {
  NOT_CONNECTED: "🔴 No conectada",
  CONNECTED: "🟢 Conectada",
  ERROR: "🟠 Error",
};

export default async function AdminFinanzasPage() {
  const [charges, payouts, health, commissions] = await Promise.all([
    listBrandCharges(),
    listPayouts(),
    listStoreHealth(),
    getCommissionsSummary(),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">FINANZAS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Cobros, pagos y tiendas</h1>

      <h2 className="font-display font-semibold text-brand-ink mb-3">Comisiones (Motor de Comisiones)</h2>
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
          <div>
            <p className="text-xs text-brand-ink-soft mb-1">Pendientes (en espera)</p>
            <p className="font-mono text-brand-ink">
              {commissions.pending.count} · {formatCOP(commissions.pending.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-ink-soft mb-1">Aprobadas (listas para pagar)</p>
            <p className="font-mono text-brand-ink">
              {commissions.approved.count} · {formatCOP(commissions.approved.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-ink-soft mb-1">Pagadas</p>
            <p className="font-mono text-brand-ink">
              {commissions.paid.count} · {formatCOP(commissions.paid.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-brand-ink-soft mb-1">Revertidas (reembolsos)</p>
            <p className="font-mono text-brand-ink">
              {commissions.reversed.count} · {formatCOP(commissions.reversed.amount)}
            </p>
          </div>
        </div>
        <ApproveCommissionsButton eligibleNow={commissions.eligibleNow} />
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-3">Cobros a marcas (día 1)</h2>
      {charges.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-8">
          Aún no se ha procesado ningún cobro — se activa cuando esté listo el Motor de Pagos.
        </p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden mb-8">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-brand-line">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 text-brand-ink">{c.brand.companyName}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(c.totalAmount))}</td>
                  <td className="px-5 py-3 text-brand-ink-soft">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="font-display font-semibold text-brand-ink mb-3">Pagos a creadores (día 15)</h2>
      {payouts.length === 0 ? (
        <p className="text-sm text-brand-ink-soft mb-8">Aún no se ha procesado ningún pago.</p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden mb-8">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-brand-line">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 text-brand-ink">{p.creator.displayName}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(p.totalAmount))}</td>
                  <td className="px-5 py-3 text-brand-ink-soft">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="font-display font-semibold text-brand-ink mb-3">Salud de integraciones</h2>
      <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
              <th className="px-5 py-3 font-normal">Marca</th>
              <th className="px-5 py-3 font-normal">Plataforma</th>
              <th className="px-5 py-3 font-normal">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {health.map((h) => (
              <tr key={h.id}>
                <td className="px-5 py-3 text-brand-ink">{h.companyName}</td>
                <td className="px-5 py-3 text-brand-ink-soft">{h.storeType}</td>
                <td className="px-5 py-3">{healthLabel[h.storeConnectionStatus]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
