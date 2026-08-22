import { listAllTransactions } from "@/server/services/admin-finance-service";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

const statusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  PAID: "Pagada",
  REVERSED: "Revertida",
};

export default async function AdminTransaccionesPage() {
  const transactions = await listAllTransactions();

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">TRANSACCIONES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Todas las ventas</h1>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no hay ventas registradas en toda la plataforma.
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Fecha</th>
                <th className="px-5 py-3 font-normal">Marca</th>
                <th className="px-5 py-3 font-normal">Creador</th>
                <th className="px-5 py-3 font-normal">Venta</th>
                <th className="px-5 py-3 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 text-brand-ink-soft font-mono">
                    {t.occurredAt.toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-5 py-3 text-brand-ink">{t.offer.brand.companyName}</td>
                  <td className="px-5 py-3 text-brand-ink-soft">{t.creator.displayName}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(t.netAmount))}</td>
                  <td className="px-5 py-3 text-brand-ink-soft">
                    {t.commission ? statusLabel[t.commission.status] : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
