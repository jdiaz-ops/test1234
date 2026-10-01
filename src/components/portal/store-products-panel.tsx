"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  StoreProductForm,
  type ManualProduct,
  type ProductStatusValue,
} from "@/components/portal/store-product-form";
import { ShopifyCsvImporter } from "@/components/portal/shopify-csv-importer";

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
        className="input text-sm py-1.5 !w-20 shrink-0 font-mono"
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
  unlisted: { text: "No listado (solo con link directo)", className: "text-amber-700", dot: "bg-amber-500" },
  hidden: { text: "Oculto (borrador)", className: "text-red-600", dot: "bg-red-500" },
};

const FILTERS: { key: Visibility | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "visible", label: "Activos" },
  { key: "soldout", label: "Agotados" },
  { key: "unlisted", label: "No listados" },
  { key: "hidden", label: "Ocultos" },
];

/// Orden de la tabla — A-Z por defecto (pedido de la marca), con las
/// mismas opciones básicas que Shopify. "Más recientes" usa el orden en
/// que llegan de la API (createdAt desc, ver listManualProducts).
type SortKey = "name-asc" | "name-desc" | "newest" | "oldest" | "price-asc" | "price-desc" | "stock-asc" | "stock-desc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name-asc", label: "Nombre (A-Z)" },
  { key: "name-desc", label: "Nombre (Z-A)" },
  { key: "newest", label: "Más recientes" },
  { key: "oldest", label: "Más antiguos" },
  { key: "price-asc", label: "Precio: menor a mayor" },
  { key: "price-desc", label: "Precio: mayor a menor" },
  { key: "stock-asc", label: "Inventario: menor a mayor" },
  { key: "stock-desc", label: "Inventario: mayor a menor" },
];

function totalStock(p: ManualProduct): number | null {
  return p.hasVariants ? p.variants.reduce((sum, v) => sum + v.stock, 0) : p.stock;
}

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
  // Filtro por colección: "all", "none" (sin colección) o el id. Ver
  // conversación del 2026-10-02.
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const counts = products.reduce(
    (acc, p) => {
      acc[visibilityOf(p)]++;
      return acc;
    },
    { visible: 0, soldout: 0, unlisted: 0, hidden: 0 } as Record<Visibility, number>,
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  // Edición en grupo: productos marcados con la casilla de la fila. Ver
  // conversación del 2026-09-30.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [bulkCollectionId, setBulkCollectionId] = useState("");
  useEffect(() => {
    fetch("/api/marca/tienda/colecciones")
      .then((r) => r.json())
      .then((body) =>
        setCollections((body.collections ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))),
      )
      .catch(() => {});
  }, []);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(action: "activate" | "hide" | "addCollection" | "removeCollection") {
    if (selected.size === 0) return;
    if ((action === "addCollection" || action === "removeCollection") && !bulkCollectionId) {
      setError("Elige primero la colección.");
      return;
    }
    setBulkBusy(true);
    setError(null);
    setBulkNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: Array.from(selected),
          action,
          collectionId: bulkCollectionId || undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo aplicar el cambio.");
        return;
      }
      const verb = {
        activate: "activados",
        hide: "ocultos",
        addCollection: "agregados a la colección",
        removeCollection: "quitados de la colección",
      }[action];
      setBulkNotice(
        `Listo: ${body.changed} ${verb}.` +
          (body.skipped > 0
            ? action === "activate"
              ? ` ${body.skipped} sin precio se quedaron ocultos.`
              : ` ${body.skipped} ya estaban así.`
            : ""),
      );
      setSelected(new Set());
      reloadProducts();
    } catch {
      setError("No se pudo aplicar — revisa tu conexión.");
    } finally {
      setBulkBusy(false);
    }
  }
  const q = search.trim().toLowerCase();
  const recency = new Map(products.map((p, i) => [p.id, i]));
  const byName = (a: ManualProduct, b: ManualProduct) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true });
  // Sin inventario definido (null = sin control) va al final al ordenar
  // por inventario, en ambos sentidos.
  const stockOrder = (dir: 1 | -1) => (a: ManualProduct, b: ManualProduct) => {
    const sa = totalStock(a);
    const sb = totalStock(b);
    if (sa == null && sb == null) return byName(a, b);
    if (sa == null) return 1;
    if (sb == null) return -1;
    return (sa - sb) * dir || byName(a, b);
  };
  const comparators: Record<SortKey, (a: ManualProduct, b: ManualProduct) => number> = {
    "name-asc": byName,
    "name-desc": (a, b) => byName(b, a),
    newest: (a, b) => recency.get(a.id)! - recency.get(b.id)!,
    oldest: (a, b) => recency.get(b.id)! - recency.get(a.id)!,
    "price-asc": (a, b) => a.price - b.price || byName(a, b),
    "price-desc": (a, b) => b.price - a.price || byName(a, b),
    "stock-asc": stockOrder(1),
    "stock-desc": stockOrder(-1),
  };
  const shownProducts = products
    .filter(
      (p) =>
        (filter === "all" || visibilityOf(p) === filter) &&
        (collectionFilter === "all" ||
          (collectionFilter === "none" ? p.collectionIds.length === 0 : p.collectionIds.includes(collectionFilter))) &&
        (!q || p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)),
    )
    .sort(comparators[sort]);

  /// Inventario o estado desde la fila (ver /api/marca/tienda/productos/rapido).
  async function quickUpdate(
    productId: string,
    data: { stock?: number; status?: ProductStatusValue; price?: number; compareAtPrice?: number | null },
  ) {
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
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                stock: body.product.stock,
                status: body.product.status,
                price: Number(body.product.price),
                compareAtPrice: body.product.compareAtPrice != null ? Number(body.product.compareAtPrice) : null,
              }
            : p,
        ),
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
        {products.length > 0 && (
          <a
            href="/api/marca/tienda/productos/exportar"
            className="border border-brand-line rounded-full px-6 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft"
          >
            Exportar a Excel
          </a>
        )}
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

      {/* Barra como la de Shopify: estado · buscar · ordenar. Ver
          conversación del 2026-09-30. */}
      {products.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl border border-brand-line bg-brand-surface p-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Visibility | "all")}
            className="input text-sm py-2 sm:w-52"
            aria-label="Filtrar por estado"
          >
            {FILTERS.map((f) => {
              const n = f.key === "all" ? products.length : counts[f.key];
              if (f.key !== "all" && n === 0 && filter !== f.key) return null;
              return (
                <option key={f.key} value={f.key}>
                  {f.label} ({n})
                </option>
              );
            })}
          </select>
          {collections.length > 0 && (
            <select
              value={collectionFilter}
              onChange={(e) => setCollectionFilter(e.target.value)}
              className="input text-sm py-2 sm:w-56"
              aria-label="Filtrar por colección"
            >
              <option value="all">Todas las colecciones</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({products.filter((p) => p.collectionIds.includes(c.id)).length})
                </option>
              ))}
              <option value="none">Sin colección ({products.filter((p) => p.collectionIds.length === 0).length})</option>
            </select>
          )}
          <div className="relative flex-1 min-w-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-ink-soft pointer-events-none"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU"
              className="input text-sm py-2 pl-9 w-full"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-brand-ink-soft sm:shrink-0">
            <span className="whitespace-nowrap">Ordenar por</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="input text-sm py-2 flex-1 sm:w-56"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {bulkNotice && <p className="text-sm text-green-700">{bulkNotice}</p>}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 rounded-2xl border border-brand-ink bg-brand-surface p-3 flex flex-wrap items-center gap-2 shadow-sm">
          <p className="text-sm font-medium text-brand-ink mr-2">
            {selected.size} {selected.size === 1 ? "seleccionado" : "seleccionados"}
          </p>
          <button
            type="button"
            onClick={() => runBulk("activate")}
            disabled={bulkBusy}
            className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
          >
            Activar
          </button>
          <button
            type="button"
            onClick={() => runBulk("hide")}
            disabled={bulkBusy}
            className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
          >
            Ocultar
          </button>
          {collections.length > 0 && (
            <>
              <select
                value={bulkCollectionId}
                onChange={(e) => setBulkCollectionId(e.target.value)}
                className="input text-xs py-1.5 !w-48 shrink-0"
                aria-label="Colección"
              >
                <option value="">Elige una colección</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => runBulk("addCollection")}
                disabled={bulkBusy || !bulkCollectionId}
                className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
              >
                Agregar a la colección
              </button>
              <button
                type="button"
                onClick={() => runBulk("removeCollection")}
                disabled={bulkBusy || !bulkCollectionId}
                className="rounded-full border border-brand-line px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
              >
                Quitar de la colección
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-brand-ink-soft hover:underline ml-auto"
          >
            Deseleccionar
          </button>
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
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="text-left text-xs text-brand-ink-soft border-b border-brand-line">
                <th className="pl-4 py-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={shownProducts.length > 0 && shownProducts.every((p) => selected.has(p.id))}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(shownProducts.map((p) => p.id)) : new Set())
                    }
                  />
                </th>
                <th className="font-medium px-4 py-3">Producto</th>
                <th className="font-medium px-3 py-3 w-48">Estado</th>
                <th className="font-medium px-3 py-3 w-32">Inventario</th>
                <th className="font-medium px-3 py-3 w-36">Precio</th>
                <th className="font-medium px-3 py-3 w-36">Precio antes</th>
                <th className="px-4 py-3 w-56" />
              </tr>
            </thead>
            <tbody>
              {shownProducts.map((product) => {
                const v = VISIBILITY_LABEL[visibilityOf(product)];
                const busy = rowBusy === product.id;
                return (
                  <tr
                    key={product.id}
                    className={`border-b border-brand-line last:border-b-0 align-middle ${
                      selected.has(product.id) ? "bg-brand-accent-soft/40" : ""
                    }`}
                  >
                    <td className="pl-4 py-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${product.name}`}
                        checked={selected.has(product.id)}
                        onChange={() => toggleSelected(product.id)}
                      />
                    </td>
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
                          className="input text-xs py-1.5 !w-[132px] shrink-0"
                          aria-label={`Estado de ${product.name}`}
                        >
                          <option value="ACTIVE">Activo</option>
                          <option value="DRAFT">Oculto</option>
                          {product.status === "UNLISTED" && <option value="UNLISTED">No listado</option>}
                        </select>
                      </div>
                      {visibilityOf(product) === "soldout" && (
                        // Sin inventario el producto NO se esconde: sigue
                        // en la tienda marcado "Agotado" y sin poder
                        // comprarse. Ver conversación del 2026-09-30.
                        <span className="inline-block mt-1.5 ml-4 rounded-full bg-amber-100 text-amber-800 text-[11px] font-medium px-2 py-0.5">
                          Agotado en la tienda
                        </span>
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
                    <td className="px-3 py-2.5">
                      {product.hasVariants ? (
                        <span className="text-xs text-brand-ink-soft">Varios</span>
                      ) : (
                        <MoneyCell
                          value={product.price}
                          disabled={busy}
                          onSave={(price) => quickUpdate(product.id, { price: price ?? undefined })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {product.hasVariants ? (
                        <span className="text-xs text-brand-ink-soft">—</span>
                      ) : (
                        <MoneyCell
                          value={product.compareAtPrice}
                          disabled={busy}
                          allowEmpty
                          onSave={(compareAtPrice) => quickUpdate(product.id, { compareAtPrice })}
                        />
                      )}
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

function formatThousands(n: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
}

/// Precio / precio antes en la fila — igual que StockCell: se guarda al
/// salir del campo o con Enter, solo si cambió. Con `allowEmpty`, vaciar
/// el campo quita el valor (el producto deja de estar en oferta). Acepta
/// "15.000" o "15000".
function MoneyCell({
  value,
  disabled,
  allowEmpty,
  onSave,
}: {
  value: number | null;
  disabled?: boolean;
  allowEmpty?: boolean;
  onSave: (v: number | null) => void;
}) {
  // Siempre con separador de miles, como pesos colombianos (4.000,
  // 15.000) — también mientras se escribe. Ver conversación del
  // 2026-09-30 ("los decimales siempre").
  const shown = (v: number | null) => (v == null ? "" : formatThousands(v));
  const [draft, setDraft] = useState(shown(value));
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(shown(value));
  }
  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setDraft(digits ? formatThousands(Number(digits)) : "");
  }
  function commit() {
    const digits = draft.replace(/\D/g, "");
    if (digits === "") {
      if (allowEmpty) {
        if (value != null) onSave(null);
      } else {
        setDraft(shown(value));
      }
      return;
    }
    const n = Number(digits);
    if (!Number.isFinite(n) || n <= 0) {
      setDraft(shown(value));
      return;
    }
    if (n !== value) onSave(n);
    else setDraft(shown(value));
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-brand-ink-soft">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder={allowEmpty ? "—" : ""}
        aria-label={allowEmpty ? "Precio antes" : "Precio"}
        className="input text-sm py-1.5 !w-28 shrink-0 font-mono"
      />
    </div>
  );
}
