import { listPendingPayouts } from "@/server/services/payment-service";
import { AdminCreatorPayoutsQueue } from "@/components/portal/admin-creator-payouts-queue";

export default async function AdminPagosCreadoresPage() {
  const payouts = await listPendingPayouts();

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">PAGOS</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Pagos pendientes a creadores</h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        El pago a creadores se hace manual — transfiere a cada uno por su cuenta o llave Bre-B, y márcalo
        aquí cuando lo hagas.
      </p>

      {payouts.length > 0 && (
        <a
          href="/api/admin/pagos-creadores/pdf"
          className="inline-block text-xs text-brand-accent font-medium hover:underline mb-6"
        >
          Descargar resumen (PDF) →
        </a>
      )}

      <AdminCreatorPayoutsQueue
        items={payouts.map((p) => ({
          id: p.id,
          creatorName: p.creator.displayName,
          amount: Number(p.totalAmount),
          payoutMethod: p.creator.payoutMethod,
          bankName: p.creator.bankName,
          bankAccountType: p.creator.bankAccountType,
          bankAccountNumber: p.creator.bankAccountNumber,
          paymentHolderName: p.creator.paymentHolderName,
          breBKey: p.creator.breBKey,
        }))}
      />
    </div>
  );
}
