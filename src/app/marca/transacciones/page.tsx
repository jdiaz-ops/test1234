import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandTransactions } from "@/server/services/brand-finance-service";
import { listEnrollmentsForBrand } from "@/server/services/enrollment-management-service";
import { ManualSaleForm } from "@/components/portal/manual-sale-form";

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

const sourceLabel: Record<string, string> = {
  SHOPIFY: "Shopify",
  WOOCOMMERCE: "WooCommerce",
  MANUAL: "Manual",
};

export default async function MarcaTransaccionesPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const [transactions, enrollments] = await Promise.all([
    getBrandTransactions(profile.id),
    listEnrollmentsForBrand(profile.id),
  ]);

  const codeOptions = enrollments
    .filter((e) => e.status === "ACTIVE")
    .map((e) => ({ discountCode: e.discountCode, creatorName: e.creator.displayName, offerName: e.offer.name }));

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">TRANSACCIONES</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Ventas generadas</h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Las de tu tienda conectada aparecen solas. ¿Cerraste una venta por fuera (WhatsApp, en persona, etc.)?
        Regístrala a mano abajo.
      </p>

      <ManualSaleForm codeOptions={codeOptions} />

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
                <th className="px-5 py-3 font-normal">Origen</th>
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
                  <td className="px-5 py-3 text-brand-ink-soft">
                    {sourceLabel[t.source] ?? t.source}
                    {t.note && <span className="block text-xs text-brand-ink-soft/70">{t.note}</span>}
                  </td>
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
