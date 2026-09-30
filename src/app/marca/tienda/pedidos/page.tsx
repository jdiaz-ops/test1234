import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreOrdersPanel } from "@/components/portal/store-orders-panel";
import { listBrandOrders } from "@/server/services/store-order-service";

export default async function TiendaPedidosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const orders = await listBrandOrders(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Pedidos
      </h1>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <p className="text-sm text-brand-ink-soft max-w-lg">
          Compras de tu vitrina y muestras aprobadas — el envío lo gestionas tú,
          Marcolini solo lo registra acá.
        </p>
        {/* Pedidos pagados y devueltos en .xlsx, para contabilidad. Ver
            store-export-service.ts. */}
        <a
          href="/api/marca/tienda/pedidos/exportar"
          className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft shrink-0"
        >
          Exportar a Excel
        </a>
      </div>
      <StoreOrdersPanel
        initialOrders={orders.map((o) => ({
          id: o.id,
          kind: o.kind,
          status: o.status,
          fulfillmentStatus: o.fulfillmentStatus,
          reference: o.reference,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          buyerPhone: o.buyerPhone,
          shippingAddress: o.shippingAddress,
          shippingCity: o.shippingCity,
          shippingRegion: o.shippingRegion,
          shippingNotes: o.shippingNotes,
          servicePreferredAt: o.servicePreferredAt?.toISOString() ?? null,
          discountCode: o.discountCode,
          totalCents: o.totalCents,
          createdAt: o.createdAt.toISOString(),
          creator: o.transaction
            ? {
                name: o.transaction.creator.displayName,
                commissionPercent: Number(
                  o.transaction.enrollment.commissionPercentOverride ??
                    o.transaction.enrollment.offer.defaultCommissionPercent,
                ),
                commissionAmountCents: o.transaction.commission
                  ? Math.round(
                      Number(o.transaction.commission.creatorCommissionAmount) * 100,
                    )
                  : null,
              }
            : null,
          itemCount: o.items.length,
        }))}
      />
    </div>
  );
}
