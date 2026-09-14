"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  StoreProductForm,
  type ManualProduct,
} from "@/components/portal/store-product-form";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

type SyncedProductOption = { id: string; name: string; imageUrl: string | null; price: number };

/// Lista de productos ya sincronizados de Shopify/WooCommerce para elegir
/// cuál importar — al elegir uno, precarga el formulario de Crear
/// producto (sin guardar nada todavía, la marca revisa/edita y guarda
/// ella). Ver conversación del 2026-09-14: "me gusta la función de poder
/// importar productos".
function ImportPicker({
  onPick,
  onCancel,
}: {
  onPick: (productId: string) => void;
  onCancel: () => void;
}) {
  const [products, setProducts] = useState<SyncedProductOption[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/marca/tienda/productos/sincronizados")
      .then((r) => r.json())
      .then((body) => setProducts(body.products ?? []))
      .catch(() => setProducts([]));
  }, []);

  const filtered = (products ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-ink">
          Importar producto sincronizado
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-brand-ink-soft hover:underline"
        >
          Cancelar
        </button>
      </div>
      <p className="text-xs text-brand-ink-soft">
        Elige un producto de tu tienda Shopify/WooCommerce ya sincronizada —
        precargamos nombre, descripción, precio, peso, SKU y fotos, tú
        revisas y guardas.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar producto"
        className="input text-sm"
      />
      <div className="max-h-80 overflow-y-auto divide-y divide-brand-line rounded-xl border border-brand-line">
        {products === null ? (
          <p className="text-xs text-brand-ink-soft p-3">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-brand-ink-soft p-3">
            {products.length === 0
              ? "No tienes productos sincronizados todavía — conecta tu tienda desde Cuenta."
              : "Sin resultados."}
          </p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-brand-bg"
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-brand-bg shrink-0" />
              )}
              <span className="flex-1 min-w-0 text-sm text-brand-ink truncate">{p.name}</span>
              <span className="font-mono text-xs text-brand-ink-soft shrink-0">
                {formatCOP(p.price)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function StoreProductsPanel({
  initialProducts,
}: {
  initialProducts: ManualProduct[];
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [mode, setMode] = useState<
    | { kind: "list" }
    | { kind: "create"; seed?: Partial<ManualProduct> }
    | { kind: "edit"; product: ManualProduct }
    | { kind: "import" }
  >({
    kind: "list",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function refreshAfterSave() {
    setMode({ kind: "list" });
    router.refresh();
    // El server component vuelve a mandar la lista actualizada por props en
    // el próximo render — mientras tanto, disparamos un GET nosotros mismos
    // para no depender del timing del refresh de Next.
    fetch("/api/marca/tienda/productos")
      .then((r) => r.json())
      .then((body) => setProducts(body.products ?? []))
      .catch(() => {});
  }

  async function handleImportPick(productId: string) {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/marca/tienda/productos/sincronizados/${productId}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo cargar el producto.");
        return;
      }
      setMode({ kind: "create", seed: body.product });
    } catch {
      setError("No se pudo cargar — revisa tu conexión.");
    } finally {
      setImporting(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!window.confirm("¿Eliminar este producto? No se puede deshacer."))
      return;
    setDeletingId(productId);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/productos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo eliminar el producto.");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      router.refresh();
    } catch {
      setError("No se pudo eliminar — revisa tu conexión.");
    } finally {
      setDeletingId(null);
    }
  }

  if (mode.kind === "create") {
    return (
      <StoreProductForm
        seed={mode.seed}
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }
  if (mode.kind === "edit") {
    return (
      <StoreProductForm
        initial={mode.product}
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }
  if (mode.kind === "import") {
    return (
      <ImportPicker
        onPick={handleImportPick}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
        >
          + Agregar producto
        </button>
        <button
          type="button"
          onClick={() => setMode({ kind: "import" })}
          disabled={importing}
          className="border border-brand-line rounded-full px-6 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
        >
          {importing ? "Cargando..." : "Importar producto"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {products.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no has agregado ningún producto.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-brand-line bg-brand-surface p-4 flex gap-3"
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-brand-bg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {product.type === "SERVICE" && (
                    <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-purple-100 text-purple-700 shrink-0">
                      SERVICIO
                    </span>
                  )}
                  {product.type === "DIGITAL" && (
                    <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-blue-100 text-blue-700 shrink-0">
                      DIGITAL
                    </span>
                  )}
                  <p className="font-display font-semibold text-brand-ink truncate">
                    {product.name}
                  </p>
                </div>
                <p className="text-sm text-brand-ink-soft">
                  {product.hasVariants
                    ? "Varios precios"
                    : formatCOP(product.price)}
                </p>
                {product.status === "DRAFT" && (
                  <p className="text-xs text-red-600 mt-0.5">Borrador</p>
                )}
                {product.status === "UNLISTED" && (
                  <p className="text-xs text-amber-600 mt-0.5">No listado</p>
                )}
                {product.hasVariants ? (
                  <p className="text-xs text-brand-ink-soft mt-0.5">
                    {product.variants.length} variantes ·{" "}
                    {product.variants.reduce((sum, v) => sum + v.stock, 0)} en
                    stock
                  </p>
                ) : (
                  product.stock != null && (
                    <p className="text-xs text-brand-ink-soft mt-0.5">
                      {product.type === "SERVICE" ? "Cupos" : "Inventario"}:{" "}
                      {product.stock}
                    </p>
                  )
                )}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setMode({ kind: "edit", product })}
                    className="text-xs text-brand-accent hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    disabled={deletingId === product.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === product.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
