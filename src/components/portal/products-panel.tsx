"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  available: boolean;
  featured: boolean;
};

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

const MAX_FEATURED = 3;

export function ProductsPanel({
  products,
  storeConnected,
  lastSyncedAt,
}: {
  products: Product[];
  storeConnected: boolean;
  lastSyncedAt: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const featuredCount = products.filter((p) => p.featured).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  async function sync() {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    const res = await fetch("/api/marca/productos/sincronizar", { method: "POST" });
    setSyncing(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo sincronizar.");
      return;
    }
    const body = await res.json();
    setSyncMessage(`${body.imported} producto${body.imported === 1 ? "" : "s"} sincronizado${body.imported === 1 ? "" : "s"}.`);
    router.refresh();
  }

  async function toggleFeatured(product: Product) {
    if (!product.featured && featuredCount >= MAX_FEATURED) {
      setError(`Ya tienes ${MAX_FEATURED} productos destacados — quita uno antes de agregar otro.`);
      return;
    }
    setError(null);
    setTogglingId(product.id);
    const res = await fetch("/api/marca/productos/destacar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: product.id, featured: !product.featured }),
    });
    setTogglingId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo actualizar.");
      return;
    }
    router.refresh();
  }

  if (!storeConnected) {
    return (
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
        Conecta tu tienda (Shopify o WooCommerce) en <span className="text-brand-ink">Cuenta → Conexión de tienda</span>{" "}
        para poder traer tu catálogo de productos.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex-1 min-w-[220px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="input max-w-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-brand-ink-soft">
            {lastSyncedAt ? `Última sincronización: ${new Date(lastSyncedAt).toLocaleString("es-CO")}` : "Aún no sincronizado"}
          </span>
          <button
            onClick={sync}
            disabled={syncing}
            className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {syncing ? "Sincronizando..." : "Sincronizar productos"}
          </button>
        </div>
      </div>

      {syncMessage && <p className="text-sm text-brand-accent mb-4">{syncMessage}</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <p className="text-xs text-brand-ink-soft mb-4">
        Destacados: <span className="font-mono text-brand-ink">{featuredCount}/{MAX_FEATURED}</span> — aparecen
        primero como sugeridos cuando un creador arma una colección con tus productos.
      </p>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 text-sm text-brand-ink-soft">
          Todavía no has sincronizado tu catálogo — dale a &quot;Sincronizar productos&quot; para traerlo.
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">No hay productos con ese filtro.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border bg-brand-surface p-4 ${
                p.available ? "border-brand-line" : "border-brand-line opacity-50"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- foto sincronizada desde la tienda de la marca
                  <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-brand-accent-soft shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-ink truncate">{p.name}</p>
                  <p className="font-mono text-xs text-brand-ink-soft">{formatPrice(p.price, p.currency)}</p>
                </div>
              </div>
              {!p.available && <p className="text-xs text-brand-ink-soft mb-2">Ya no está disponible en tu tienda.</p>}
              <button
                onClick={() => toggleFeatured(p)}
                disabled={togglingId === p.id || !p.available}
                className={`w-full text-xs font-medium rounded-full px-3 py-2 border disabled:opacity-50 ${
                  p.featured
                    ? "border-brand-accent bg-brand-accent-soft text-brand-accent"
                    : "border-brand-line text-brand-ink-soft hover:border-brand-ink-soft"
                }`}
              >
                {p.featured ? "★ Destacado — quitar" : "Destacar producto"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
