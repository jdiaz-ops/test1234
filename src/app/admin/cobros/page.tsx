import { prisma } from "@/lib/prisma";
import { AdminBillingQueue } from "@/components/portal/admin-billing-queue";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusLabel: Record<string, string> = {
  PENDING: "Esperando pago",
  PROOF_SUBMITTED: "Comprobante en revisión",
  PAID: "Pagado",
  OVERDUE: "Vencido — cuenta inhabilitada",
  DEACTIVATED: "Vencido — servicio desactivado",
};

export default async function AdminFacturacionPage() {
  const [pending, recent] = await Promise.all([
    // Un comprobante sin revisar todavía — submitPaymentProof siempre deja
    // proofRejectedAt en null al subir uno nuevo, así que esto nunca
    // incluye uno ya rechazado a la espera de que la marca suba otro.
    prisma.brandCharge.findMany({
      where: {
        proofSubmittedAt: { not: null },
        proofRejectedAt: null,
        status: { not: "PAID" },
      },
      include: { brand: true },
      orderBy: { proofSubmittedAt: "asc" },
    }),
    prisma.brandCharge.findMany({
      where: { status: { in: ["PAID", "OVERDUE", "DEACTIVATED"] } },
      include: { brand: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        FACTURACIÓN
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Verificar pagos de marcas
      </h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Las marcas pagan por transferencia directa (QR/Bre-B) y suben su
        comprobante — verifícalo aquí para reactivarlas. Configura las
        instrucciones de pago en Configuración.
      </p>

      <h2 className="font-display font-semibold text-brand-ink mb-4">
        Pendientes de verificar
      </h2>
      <div className="mb-10">
        <AdminBillingQueue
          items={pending.map((c) => ({
            id: c.id,
            brandName: c.brand.companyName,
            totalAmount: Number(c.totalAmount),
            dueAt: c.dueAt.toISOString(),
            proofUrl: c.proofUrl,
            proofSubmittedAt: c.proofSubmittedAt?.toISOString() ?? null,
          }))}
        />
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">
        Historial reciente
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no hay cortes resueltos.
        </p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
                  <th className="px-5 py-3 font-normal">Marca</th>
                  <th className="px-5 py-3 font-normal">Monto</th>
                  <th className="px-5 py-3 font-normal">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 text-brand-ink">
                      {c.brand.companyName}
                    </td>
                    <td className="px-5 py-3 font-mono text-brand-ink">
                      {formatCOP(Number(c.totalAmount))}
                    </td>
                    <td className="px-5 py-3 text-brand-ink-soft">
                      {statusLabel[c.status]}
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
