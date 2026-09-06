import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
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
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Compras de tu vitrina y muestras aprobadas — el envío lo gestionas tú,
        Marcolini solo lo registra acá.
      </p>
      <StoreSubNav />
      <StoreOrdersPanel
        initialOrders={orders.map((o) => ({
          id: o.id,
          kind: o.kind,
          status: o.status,
          reference: o.reference,
          buyerName: o.buyerName,
          buyerEmail: o.buyerEmail,
          buyerPhone: o.buyerPhone,
          shippingAddress: o.shippingAddress,
          shippingCity: o.shippingCity,
          shippingNotes: o.shippingNotes,
          discountCode: o.discountCode,
          totalCents: o.totalCents,
          createdAt: o.createdAt.toISOString(),
          items: o.items.map((i) => ({
            id: i.id,
            name: i.name,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
          })),
        }))}
      />
    </div>
  );
}
