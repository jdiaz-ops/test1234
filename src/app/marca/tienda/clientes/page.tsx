import Link from "next/link";
import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { listStoreCustomers, type CustomerFilter } from "@/server/services/store-customer-service";
import { ShopifyCustomersImporter } from "@/components/portal/shopify-customers-importer";

function formatCOP(cents: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const FILTERS: { key: CustomerFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "con-compras", label: "Con compras" },
  { key: "sin-compras", label: "Sin compras" },
  { key: "suscritos", label: "Suscritos a correos" },
  { key: "sms", label: "SMS y WhatsApp" },
];

export default async function TiendaClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ buscar?: string; filtro?: string; pagina?: string }>;
}) {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const params = await searchParams;
  const filter = (FILTERS.find((f) => f.key === params.filtro)?.key ?? "todos") as CustomerFilter;
  const { customers, total, page, totalPages, counts } = await listStoreCustomers(profile.id, {
    search: params.buscar,
    filter,
    page: Number(params.pagina) || 1,
  });

  function href(next: { filtro?: CustomerFilter; pagina?: number }) {
    const q = new URLSearchParams();
    if (params.buscar) q.set("buscar", params.buscar);
    const f = next.filtro ?? filter;
    if (f !== "todos") q.set("filtro", f);
    if (next.pagina && next.pagina > 1) q.set("pagina", String(next.pagina));
    const query = q.toString();
    return `/marca/tienda/clientes${query ? `?${query}` : ""}`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Clientes</h1>
      </div>
      <p className="text-sm text-brand-ink-soft mb-4 max-w-lg">
        Los que te han comprado en tu tienda de Marcolini y los que traigas desde Shopify.
      </p>

      <div className="mb-6">
        <ShopifyCustomersImporter />
      </div>

      {counts.todos === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no tienes clientes. Aparecerán aquí apenas alguien te compre, o impórtalos desde Shopify.
        </p>
      ) : (
        <>
          <form action="/marca/tienda/clientes" className="flex flex-wrap gap-2 mb-3">
            {filter !== "todos" && <input type="hidden" name="filtro" value={filter} />}
            <input
              type="search"
              name="buscar"
              defaultValue={params.buscar}
              placeholder="Buscar por nombre, correo, celular o documento"
              className="input max-w-sm"
            />
            <button
              type="submit"
              className="border border-brand-line rounded-md px-4 py-2 text-sm hover:bg-brand-accent-soft"
            >
              Buscar
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={href({ filtro: f.key })}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  filter === f.key
                    ? "bg-brand-ink text-white"
                    : "border border-brand-line text-brand-ink-soft hover:text-brand-ink"
                }`}
              >
                {f.label} <span className="font-mono opacity-70">{counts[f.key].toLocaleString("es-CO")}</span>
              </Link>
            ))}
          </div>

          {customers.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">Ningún cliente coincide con esa búsqueda.</p>
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
                      <p className="font-medium text-brand-ink truncate">{c.name || c.email}</p>
                      <p className="text-xs text-brand-ink-soft truncate">{c.email}</p>
                    </div>
                    <span className="text-xs text-brand-ink-soft">
                      {c.emailSubscribed ? <span className="text-brand-accent">Correos</span> : "Sin correos"}
                      {c.smsSubscribed && <span className="text-brand-accent"> · SMS</span>}
                    </span>
                    <span className="text-xs text-brand-ink-soft">
                      {c.city ? `${c.city}${c.region ? `, ${c.region}` : ""}` : "—"}
                    </span>
                    <span className="text-xs text-brand-ink-soft">{c.orderCount}</span>
                    <span className="font-mono text-xs text-brand-ink">{formatCOP(c.totalSpentCents)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-xs text-brand-ink-soft">
                {total.toLocaleString("es-CO")} clientes · página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={href({ pagina: page - 1 })} className="border border-brand-line rounded-md px-3 py-1.5 hover:bg-brand-accent-soft">
                    ← Anterior
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={href({ pagina: page + 1 })} className="border border-brand-line rounded-md px-3 py-1.5 hover:bg-brand-accent-soft">
                    Siguiente →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
