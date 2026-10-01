import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreOrdersPanel } from "@/components/portal/store-orders-panel";
import { relativeOrderDate } from "@/lib/relative-date";
import {
  canDeleteStoreOrder,
  listBrandOrders,
  reconcilePendingOrders,
} from "@/server/services/store-order-service";

export default async function TiendaPedidosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  // Antes de listar, pone al día con Wompi los pedidos que siguen
  // pendientes (máximo unos segundos; si Wompi tarda, se lista igual).
  await Promise.race([
    reconcilePendingOrders(profile.id).catch(() => null),
    new Promise((resolve) => setTimeout(resolve, 6000)),
  ]);
  const orders = await listBrandOrders(profile.id);
  const now = new Date();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-brand-ink">
            Pedidos
          </h1>
        </div>
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
          shippingAddress: o.shippingAddress,
          servicePreferredAt: o.servicePreferredAt?.toISOString() ?? null,
          shippingMethod: o.shippingMethod,
          discountCode: o.discountCode,
          totalCents: o.totalCents,
          createdAt: o.createdAt.toISOString(),
          createdLabel: relativeOrderDate(o.createdAt, now),
          archived: o.archivedAt != null,
          deletable: canDeleteStoreOrder(o),
          unitCount: o.items.reduce((n, i) => n + i.quantity, 0),
          creator: o.transaction ? { name: o.transaction.creator.displayName } : null,
        }))}
      />
    </div>
  );
}
