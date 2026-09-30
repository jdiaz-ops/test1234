"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  StoreProductForm,
  type ManualProduct,
  type ProductStatusValue,
} from "@/components/portal/store-product-form";
import { ShopifyCsvImporter } from "@/components/portal/shopify-csv-importer";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/// Lista de productos de "Mi tienda" con Agregar (a mano) e Importar desde
/// Shopify (CSV). El viejo "Importar producto" — elegir uno ya
/// sincronizado por la conexión Shopify/WooCommerce para precargar el
/// formulario — se quitó a pedido de la marca: al lado del importador de
/// CSV confundía. Ver conversación del 2026-09-30.
/// Casilla de inventario de la fila: se escribe el número y se guarda al
/// salir del campo o con Enter (solo si cambió).
function StockCell({
  value,
  disabled,
  label,
  onSave,
}: {
  value: number | null;
  disabled?: boolean;
  label: string;
  onSave: (stock: number) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(value == null ? "" : String(value));
  }
  function commit() {
    const n = Number(draft);
    if (draft === "" || !Number.isInteger(n) || n < 0) {
      setDraft(value == null ? "" : String(value));
      return;
    }
    if (n !== value) onSave(n);
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        step={1}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="—"
        aria-label="Inventario"
        className="input text-sm py-1.5 w-20 font-mono"
      />
      <span className="text-[11px] text-brand-ink-soft">{label}</span>
    </div>
  );
}

/// Qué ve el comprador de este producto, en una palabra — la marca no
/// tenía "una forma fácil de ver si un producto está activo, visible o
/// no". Ver conversación del 2026-09-30.
type Visibility = "visible" | "soldout" | "unlisted" | "hidden";

function visibilityOf(p: ManualProduct): Visibility {
  if (p.status === "DRAFT") return "hidden";
  if (p.status === "UNLISTED") return "unlisted";
  const stock = p.hasVariants ? p.variants.reduce((sum, v) => sum + v.stock, 0) : p.stock;
  if (stock != null && stock <= 0) return "soldout";
  return "visible";
}

const VISIBILITY_LABEL: Record<Visibility, { text: string; className: string; dot: string }> = {
  visible: { text: "Visible en la tienda", className: "text-green-700", dot: "bg-green-500" },
  soldout: { text: "Visible · agotado (no se puede comprar)", className: "text-amber-700", dot: "bg-amber-500" },
  unlisted: { text: "Oculto del catálogo · solo con link directo", className: "text-amber-700", dot: "bg-amber-500" },
  hidden: { text: "Oculto (borrador)", className: "text-red-600", dot: "bg-red-500" },
};

const FILTERS: { key: Visibility | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "visible", label: "Visibles" },
  { key: "soldout", label: "Agotados" },
  { key: "unlisted", label: "Solo con link" },
  { key: "hidden", label: "Ocultos" },
];

export function StoreProductsPanel({
  initialProducts,
  storeUrl,
}: {
  initialProducts: ManualProduct[];
  /// Dirección pública de la tienda para "Ver en la tienda" — null si la
  /// marca todavía no configuró su subdominio.
  storeUrl?: string | null;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [filter, setFilter] = useState<Visibility | "all">("all");
  const counts = products.reduce(
    (acc, p) => {
      acc[visibilityOf(p)]++;
      return acc;
    },
    { visible: 0, soldout: 0, unlisted: 0, hidden: 0 } as Record<Visibility, number>,
  );
  const [search, setSearch] = useState("");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const q = search.trim().toLowerCase();
  const shownProducts = products.filter(
    (p) =>
      (filter === "all" || visibilityOf(p) === filter) &&
      (!q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)),
  );

  /// Inventario o estado desde la fila (ver /api/marca/tienda/productos/rapido).
  async function quickUpdate(productId: string, data: { stock?: number; status?: ProductStatusValue }) {
    setRowBusy(productId);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/rapido", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, ...data }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar el cambio.");
        return;
      }
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: body.product.stock, status: body.product.status } : p)),
      );
      router.refresh();
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setRowBusy(null);
    }
  }
  const [mode, setMode] = useState<
    | { kind: "list" }
    | { kind: "create"; seed?: Partial<ManualProduct> }
    | { kind: "edit"; product: ManualProduct }
    | { kind: "shopify" }
  >({
    kind: "list",
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activatedNotice, setActivatedNotice] = useState<string | null>(null);

  /// Borradores que sí se podrían vender (con precio o variantes) — los
  /// que cuenta el aviso de "no se ven en la tienda". Un borrador sin
  /// precio no se activa en lote: hay que ponerle precio primero.
  const sellableDrafts = products.filter(
    (p) => p.status === "DRAFT" && (p.hasVariants || p.price > 0),
  ).length;

  async function handleActivateDrafts() {
    if (
      !window.confirm(
        `¿Activar ${sellableDrafts} productos en borrador? Van a verse y poder comprarse en tu tienda de inmediato.`,
      )
    )
      return;
    setActivating(true);
    setError(null);
    setActivatedNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/activar-borradores", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudieron activar los borradores.");
        return;
      }
      setActivatedNotice(`Listo: ${body?.count ?? 0} productos activados.`);
      reloadProducts();
    } catch {
      setError("No se pudieron activar — revisa tu conexión.");
    } finally {
      setActivating(false);
    }
  }

  function reloadProducts() {
    router.refresh();
    // El server component vuelve a mandar la lista actualizada por props en
    // el próximo render — mientras tanto, disparamos un GET nosotros mismos
    // para no depender del timing del refresh de Next.
    fetch("/api/marca/tienda/productos")
      .then((r) => r.json())
      .then((body) => setProducts(body.products ?? []))
      .catch(() => {});
  }

  function refreshAfterSave() {
    setMode({ kind: "list" });
    reloadProducts();
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
      // Si venía de editar ese mismo producto, vuelve a la lista — ya no
      // hay nada que seguir editando. Sin efecto si ya estaba en la
      // lista (era ahí donde se pidió eliminar).
      setMode((prev) =>
        prev.kind === "edit" && prev.product.id === productId ? { kind: "list" } : prev,
      );
      router.refresh();
    } catch {
      setError("No se pudo eliminar — revisa tu conexión.");
    } finally {
      setDeletingId(null);
    }
  }

  /// Precarga el formulario de Crear con los datos del producto elegido —
  /// la marca revisa/ajusta el nombre u otros campos y guarda como uno
  /// nuevo, en Borrador para no publicarlo sin querer. Ver conversación
  /// del 2026-09-14.
  function handleDuplicate(product: ManualProduct) {
    setMode({
      kind: "create",
      seed: { ...product, name: `${product.name} (copia)`, status: "DRAFT" },
    });
  }

  if (mode.kind === "create") {
    return (
      // key fijo pero DISTINTO del de "edit" abajo — sin esto, pasar de
      // Editar a Duplicar (mismo tipo de componente, misma posición en
      // el árbol) hace que React reutilice la instancia en vez de
      // remontarla, y el formulario se queda con el estado viejo
      // (ignora el seed con "(copia)"). Encontrado probando el flujo
      // real. Ver conversación del 2026-09-14.
      <StoreProductForm
        key="create-form"
        seed={mode.seed}
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }
  if (mode.kind === "edit") {
    return (
      <StoreProductForm
        key={`edit-${mode.product.id}`}
        initial={mode.product}
        onSaved={refreshAfterSave}
        onCancel={() => setMode({ kind: "list" })}
        onDelete={() => handleDelete(mode.product.id)}
        onDuplicate={() => handleDuplicate(mode.product)}
        deleting={deletingId === mode.product.id}
      />
    );
  }
  if (mode.kind === "shopify") {
    return (
      <ShopifyCsvImporter
        onImported={reloadProducts}
        onClose={() => setMode({ kind: "list" })}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
        >
          + Agregar producto
        </button>
        <button
          type="button"
          onClick={() => setMode({ kind: "shopify" })}
          className="border border-brand-line rounded-full px-6 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft"
        >
          Importar desde Shopify
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {activatedNotice && <p className="text-sm text-green-700">{activatedNotice}</p>}

      {sellableDrafts > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-900">
            {sellableDrafts === 1
              ? "Tienes 1 producto en borrador: no se ve en tu tienda."
              : `Tienes ${sellableDrafts} productos en borrador: no se ven en tu tienda.`}
          </p>
          <button
            type="button"
            onClick={handleActivateDrafts}
            disabled={activating}
            className="rounded-full bg-brand-ink text-brand-bg px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {activating ? "Activando…" : sellableDrafts === 1 ? "Activar ese producto" : "Activar todos los borradores"}
          </button>
        </div>
      )}

      {products.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const n = f.key === "all" ? products.length : counts[f.key];
            if (f.key !== "all" && n === 0) return null;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium border ${
                  active
                    ? "bg-brand-ink text-brand-bg border-brand-ink"
                    : "border-brand-line text-brand-ink hover:bg-brand-accent-soft"
                }`}
              >
                {f.label} ({n})
              </button>
            );
          })}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU"
            className="input text-sm sm:ml-auto sm:max-w-xs"
          />
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          Todavía no has agregado ningún producto.
        </p>
      ) : shownProducts.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">No hay productos que coincidan.</p>
      ) : (
        // Tabla como la de Shopify (Producto · Estado · Inventario ·
        // Precio · acciones): el estado se cambia con el selector de la fila
        // y el inventario se escribe ahí mismo, sin abrir el formulario.
        // Ver conversación del 2026-09-30.
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-brand-ink-soft border-b border-brand-line">
                <th className="font-medium px-4 py-3">Producto</th>
                <th className="font-medium px-3 py-3 w-48">Estado</th>
                <th className="font-medium px-3 py-3 w-36">Inventario</th>
                <th className="font-medium px-3 py-3 w-28 text-right">Precio</th>
                <th className="px-4 py-3 w-64" />
              </tr>
            </thead>
            <tbody>
              {shownProducts.map((product) => {
                const v = VISIBILITY_LABEL[visibilityOf(product)];
                const busy = rowBusy === product.id;
                return (
                  <tr key={product.id} className="border-b border-brand-line last:border-b-0 align-middle">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.imageUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 border border-brand-line" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-brand-bg shrink-0" />
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setMode({ kind: "edit", product })}
                            className="font-medium text-brand-ink hover:underline text-left line-clamp-2 leading-snug"
                          >
                            {product.name}
                          </button>
                          {product.type !== "PHYSICAL" && (
                            <p className="text-[10px] font-mono text-brand-ink-soft">
                              {product.type === "SERVICE" ? "SERVICIO" : "DIGITAL"}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${v.dot}`} title={v.text} />
                        <select
                          value={product.status}
                          disabled={busy}
                          onChange={(e) => quickUpdate(product.id, { status: e.target.value as ProductStatusValue })}
                          className="input text-xs py-1.5"
                          aria-label={`Estado de ${product.name}`}
                        >
                          <option value="ACTIVE">Activo (visible)</option>
                          <option value="DRAFT">Oculto (borrador)</option>
                          <option value="UNLISTED">Solo con link directo</option>
                        </select>
                      </div>
                      {visibilityOf(product) === "soldout" && (
                        <p className="text-[11px] text-amber-700 mt-1 ml-4">Agotado: se ve pero no se puede comprar</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {product.hasVariants ? (
                        <button
                          type="button"
                          onClick={() => setMode({ kind: "edit", product })}
                          className="text-xs text-brand-ink-soft hover:underline text-left"
                          title="Con variantes el inventario se ajusta por variante"
                        >
                          {product.variants.reduce((sum, va) => sum + va.stock, 0)} en {product.variants.length} variantes
                        </button>
                      ) : (
                        <StockCell
                          value={product.stock}
                          disabled={busy}
                          label={product.type === "SERVICE" ? "cupos" : "unidades"}
                          onSave={(stock) => quickUpdate(product.id, { stock })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-brand-ink whitespace-nowrap">
                      {product.hasVariants ? "Varios" : formatCOP(product.price)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        <button type="button" onClick={() => setMode({ kind: "edit", product })} className="text-xs text-brand-accent hover:underline">
                          Editar
                        </button>
                        <button type="button" onClick={() => handleDuplicate(product)} className="text-xs text-brand-accent hover:underline">
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingId === product.id ? "Eliminando..." : "Eliminar"}
                        </button>
                        {storeUrl && product.slug && product.status !== "DRAFT" && (
                          <a
                            href={`${storeUrl}/${product.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-ink-soft hover:underline"
                          >
                            Ver ↗
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
