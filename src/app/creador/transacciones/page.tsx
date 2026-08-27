import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorTransactions } from "@/server/services/creator-finance-service";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  PAID: "Pagada",
  REVERSED: "Revertida",
};

const statusColor: Record<string, string> = {
  PENDING: "text-brand-ink-soft",
  APPROVED: "text-brand-accent",
  PAID: "text-emerald-600",
  REVERSED: "text-red-600",
};

export default async function TransaccionesPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const transactions = await getCreatorTransactions(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        TRANSACCIONES
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">
        Historial de ventas
      </h1>

      {transactions.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no tienes ventas registradas. Aparecerán aquí automáticamente
          cuando alguien compre usando tu código.
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                  <th className="px-5 py-3 font-normal">Fecha</th>
                  <th className="px-5 py-3 font-normal">Marca</th>
                  <th className="px-5 py-3 font-normal">Venta</th>
                  <th className="px-5 py-3 font-normal">Tu comisión</th>
                  <th className="px-5 py-3 font-normal">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-3 text-brand-ink-soft font-mono">
                      {t.occurredAt.toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-5 py-3 text-brand-ink">
                      {t.offer.brand.companyName}
                    </td>
                    <td className="px-5 py-3 font-mono text-brand-ink">
                      {formatCOP(Number(t.netAmount))}
                    </td>
                    <td className="px-5 py-3 font-mono text-brand-accent">
                      {t.commission
                        ? formatCOP(
                            Number(t.commission.creatorCommissionAmount),
                          )
                        : "—"}
                    </td>
                    <td
                      className={`px-5 py-3 font-medium ${t.commission ? statusColor[t.commission.status] : ""}`}
                    >
                      {t.commission ? statusLabel[t.commission.status] : "—"}
                    </td>
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
