import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { CardForm } from "@/components/portal/card-form";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    amount
  );
}

const chargeStatusLabel: Record<string, string> = {
  PENDING: "Pendiente",
  CHARGED: "Cobrado",
  FAILED: "Falló",
};

export default async function FacturacionPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const summary = await getBrandDashboardSummary(profile.id);
  const charges = await prisma.brandCharge.findMany({
    where: { brandId: profile.id },
    orderBy: { periodStart: "desc" },
  });

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">FACTURACIÓN</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-8">Facturación y pagos</h1>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-6">
        <h2 className="font-display font-semibold text-brand-ink mb-2">Tu tarifa</h2>
        <p className="text-sm text-brand-ink-soft">
          <span className="font-mono text-brand-accent">{summary.platformFeePercent}%</span> + IVA (
          <span className="font-mono">{summary.vatPercent}%</span>) sobre cada venta, cobrado el día 1
          de cada mes junto con la comisión de tus creadores.
        </p>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 mb-6">
        <h2 className="font-display font-semibold text-brand-ink mb-2">Método de cobro</h2>
        <p className="text-sm text-brand-ink-soft mb-4">
          {profile.cardTokenRef
            ? "Tienes una tarjeta registrada para el cobro automático."
            : "Registra tu tarjeta para que el cobro del día 1 se haga solo, sin que tengas que hacer nada cada mes."}
        </p>
        <CardForm hasCard={!!profile.cardTokenRef} />
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Historial de cobros</h2>
      {charges.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">Aún no se ha generado ningún cobro.</p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                <th className="px-5 py-3 font-normal">Período</th>
                <th className="px-5 py-3 font-normal">Monto</th>
                <th className="px-5 py-3 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 text-brand-ink-soft font-mono">
                    {c.periodStart.toLocaleDateString("es-CO")}
                  </td>
                  <td className="px-5 py-3 font-mono text-brand-ink">{formatCOP(Number(c.totalAmount))}</td>
                  <td className="px-5 py-3 text-brand-ink-soft">{chargeStatusLabel[c.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
