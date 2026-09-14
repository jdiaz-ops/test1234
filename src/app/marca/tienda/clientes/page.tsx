import Link from "next/link";
import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { listStoreCustomers } from "@/server/services/store-customer-service";

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function TiendaClientesPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const customers = await listStoreCustomers(profile.id);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Clientes
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Todos los que te han comprado en tu tienda de Marcolini.
      </p>
      <StoreSubNav />

      {customers.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no tienes clientes — aparecerán acá apenas alguien te
          compre.
        </p>
      ) : (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.5fr_1fr_1fr_0.7fr_1fr] gap-3 px-4 py-2 text-xs font-medium text-brand-ink-soft border-b border-brand-line">
            <span>Cliente</span>
            <span>Suscripción</span>
            <span>Ubicación</span>
            <span>Pedidos</span>
            <span>Gastado</span>
          </div>
          <div className="divide-y divide-brand-line">
            {customers.map((c) => (
              <Link
                key={c.email}
                href={`/marca/tienda/clientes/${encodeURIComponent(c.email)}`}
                className="grid sm:grid-cols-[1.5fr_1fr_1fr_0.7fr_1fr] gap-1 sm:gap-3 px-4 py-3 text-sm hover:bg-brand-bg"
              >
                <div className="min-w-0">
                  <p className="font-medium text-brand-ink truncate">{c.name}</p>
                  <p className="text-xs text-brand-ink-soft truncate">{c.email}</p>
                </div>
                <span className="text-xs text-brand-ink-soft">
                  {c.emailSubscribed ? (
                    <span className="text-brand-accent">Suscrito</span>
                  ) : (
                    "No suscrito"
                  )}
                </span>
                <span className="text-xs text-brand-ink-soft">
                  {c.city ? `${c.city}${c.region ? `, ${c.region}` : ""}` : "—"}
                </span>
                <span className="text-xs text-brand-ink-soft">{c.orderCount}</span>
                <span className="font-mono text-xs text-brand-ink">
                  {formatCOP(c.totalSpentCents)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
