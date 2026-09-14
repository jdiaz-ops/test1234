import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  getStoreCustomerDetail,
  estimateCustomerSegment,
} from "@/server/services/store-customer-service";
import { StoreCustomerEditor } from "@/components/portal/store-customer-editor";
import { OrderItemsList } from "@/components/portal/order-detail-panel";

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function TiendaClienteDetallePage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const { email } = await params;
  const customer = await getStoreCustomerDetail(profile.id, decodeURIComponent(email));
  if (!customer) notFound();

  const segment = estimateCustomerSegment(customer);
  const lastOrder = customer.orders[0];

  return (
    <div>
      <Link
        href="/marca/tienda/clientes"
        className="text-xs text-brand-ink-soft hover:text-brand-ink inline-flex items-center gap-1 mb-4"
      >
        ← Volver a clientes
      </Link>

      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
        {customer.name}
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-brand-line bg-brand-surface p-3">
          <p className="text-[11px] text-brand-ink-soft">Gastado</p>
          <p className="font-mono text-sm text-brand-ink">
            {formatCOP(customer.totalSpentCents)}
          </p>
        </div>
        <div className="rounded-xl border border-brand-line bg-brand-surface p-3">
          <p className="text-[11px] text-brand-ink-soft">Pedidos</p>
          <p className="font-mono text-sm text-brand-ink">{customer.orderCount}</p>
        </div>
        <div className="rounded-xl border border-brand-line bg-brand-surface p-3">
          <p className="text-[11px] text-brand-ink-soft">Cliente desde</p>
          <p className="text-sm text-brand-ink">{formatDate(customer.firstOrderAt)}</p>
        </div>
        <div className="rounded-xl border border-brand-line bg-brand-surface p-3">
          <p className="text-[11px] text-brand-ink-soft" title="Estimado, no un cálculo exacto">
            Grupo (estimado)
          </p>
          <p className="text-sm text-brand-ink">{segment}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {lastOrder && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-brand-ink">
                  Último pedido realizado
                </p>
                <Link
                  href={`/marca/tienda/pedidos/${lastOrder.id}`}
                  className="text-xs text-brand-accent hover:underline"
                >
                  Ver pedido →
                </Link>
              </div>
              <OrderItemsList
                orderId={lastOrder.id}
                isService={false}
                isPaid={false}
                initialItems={lastOrder.items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  variantLabel: i.variantLabel,
                  unitPriceCents: i.unitPriceCents,
                  quantity: i.quantity,
                  imageUrl: i.imageUrl,
                  serviceConfirmedAt: i.serviceConfirmedAt?.toISOString() ?? null,
                  serviceMeetingInfo: i.serviceMeetingInfo,
                }))}
              />
            </div>
          )}

          {customer.orders.length > 1 && (
            <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
              <p className="text-sm font-medium text-brand-ink p-4 pb-2">
                Todos los pedidos
              </p>
              <div className="divide-y divide-brand-line">
                {customer.orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/marca/tienda/pedidos/${o.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-brand-bg"
                  >
                    <span className="text-brand-ink-soft">
                      {formatDate(o.createdAt)} · {o.items.length} artículo
                      {o.items.length === 1 ? "" : "s"}
                    </span>
                    <span className="font-mono text-brand-ink">
                      {formatCOP(o.totalCents)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-brand-ink-soft mb-1">
                Contacto
              </p>
              <p className="text-brand-ink">{customer.email}</p>
              <p className="text-brand-ink">{customer.phone}</p>
            </div>
            {customer.city && (
              <div>
                <p className="text-xs font-medium text-brand-ink-soft mb-1">
                  Ubicación
                </p>
                <p className="text-brand-ink">
                  {customer.city}
                  {customer.region && `, ${customer.region}`}
                </p>
              </div>
            )}
          </div>

          <StoreCustomerEditor
            email={customer.email}
            initialEmailSubscribed={customer.emailSubscribed}
            initialTags={customer.tags}
            initialNotes={customer.notes}
            initialStoreCreditCents={customer.storeCreditCents}
          />
        </div>
      </div>
    </div>
  );
}
