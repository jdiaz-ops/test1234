import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandTransactions } from "@/server/services/brand-finance-service";

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

export default async function MarcaTransaccionesPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const transactions = await getBrandTransactions(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">TRANSACCIONES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Ventas generadas</h1>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no hay ventas registradas. Aparecerán aquí automáticamente
          cuando un cliente compre usando el código de un creador.
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Fecha</th>
                <th className="px-5 py-3 font-normal">Creador</th>
                <th className="px-5 py-3 font-normal">Venta</th>
                <th className="px-5 py-3 font-normal">Comisión</th>
                <th className="px-5 py-3 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-5 py-3 text-brand-ink-soft font-mono">
                    {t.occurredAt.toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-5 py-3 text-brand-ink">{t.creator.displayName}</td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(t.netAmount))}</td>
                  <td className="px-5 py-3 font-mono text-brand-accent">
                    {t.commission ? formatCOP(Number(t.commission.creatorCommissionAmount)) : "—"}
                  </td>
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
