"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatCOP } from "@/components/storefront/catalog-templates/types";

export type CollectionSortOrder =
  | "MANUAL"
  | "ALPHA_ASC"
  | "ALPHA_DESC"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "NEWEST";

const SORT_LABELS: Record<CollectionSortOrder, string> = {
  MANUAL: "Manual (arrastrando)",
  ALPHA_ASC: "Nombre: A–Z",
  ALPHA_DESC: "Nombre: Z–A",
  PRICE_ASC: "Precio: menor a mayor",
  PRICE_DESC: "Precio: mayor a menor",
  NEWEST: "Más nuevos primero",
};

type ProductOption = {
  id: string;
  name: string;
  imageUrl: string | null;
  price: number;
  status: string;
  stock: number | null;
  createdAt: string;
};

/// Mismo criterio que sortCollectionProducts (brand-collection-service.ts),
/// para que lo que la marca ve acá sea el orden real de la vitrina.
function sortProducts(products: ProductOption[], sortOrder: CollectionSortOrder) {
  const byName = (a: ProductOption, b: ProductOption) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base", numeric: true });
  const sorted = [...products];
  switch (sortOrder) {
    case "ALPHA_ASC":
      return sorted.sort(byName);
    case "ALPHA_DESC":
      return sorted.sort((a, b) => byName(b, a));
    case "PRICE_ASC":
      return sorted.sort((a, b) => a.price - b.price || byName(a, b));
    case "PRICE_DESC":
      return sorted.sort((a, b) => b.price - a.price || byName(a, b));
    case "NEWEST":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    default:
      return sorted;
  }
}

function DragHandleIcon() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">
      {[3, 9, 15].map((y) => (
        <g key={y}>
          <circle cx="3" cy={y} r="1.5" />
          <circle cx="9" cy={y} r="1.5" />
        </g>
      ))}
    </svg>
  );
}

function ProductRow({
  product,
  index,
  draggable,
  selected,
  onSelect,
  onRemove,
}: {
  product: ProductOption;
  index: number;
  draggable: boolean;
  selected: boolean;
  /// shift = con Shift apretado (marca el rango desde el último marcado).
  onSelect: (shift: boolean) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: product.id,
    disabled: !draggable,
  });
  const hidden = product.status !== "ACTIVE";
  const soldOut = product.stock != null && product.stock <= 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2.5 px-3 py-2 text-sm ${selected ? "bg-brand-accent-soft" : "bg-brand-surface"} ${
        isDragging ? "relative z-10 shadow-lg ring-1 ring-brand-accent" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => {}}
        onClick={(e) => onSelect(e.shiftKey)}
        aria-label={`Seleccionar ${product.name}`}
        className="shrink-0"
      />
      {draggable ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover ${product.name}`}
          className="text-brand-ink-soft hover:text-brand-ink cursor-grab active:cursor-grabbing touch-none px-1 py-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
        >
          <DragHandleIcon />
        </button>
      ) : null}
      <span className="w-6 text-right text-xs font-mono text-brand-ink-soft tabular-nums shrink-0">
        {index + 1}
      </span>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded bg-brand-bg shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-brand-ink truncate">{product.name}</p>
        {(hidden || soldOut) && (
          <p className="text-[11px] text-brand-ink-soft">
            {hidden ? "No visible en la tienda" : "Agotado"}
          </p>
        )}
      </div>
      <span className="text-xs text-brand-ink-soft tabular-nums shrink-0 hidden sm:inline">
        {formatCOP(product.price)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar ${product.name} de la colección`}
        className="text-brand-ink-soft hover:text-red-600 px-1.5 text-lg leading-none shrink-0"
      >
        ×
      </button>
    </li>
  );
}

/// Productos de una colección, estilo Shopify: buscar/explorar para
/// agregar, y abajo la lista en el orden en que se ven en la tienda, con
/// "Ordenar" (manual arrastrando, o automático por nombre, precio o
/// fecha). Antes era solo una lista de checkboxes sin orden. Ver
/// conversación del 2026-10-01.
export function CollectionProductsEditor({
  productIds,
  onChange,
  sortOrder,
  onSortOrderChange,
}: {
  productIds: string[];
  onChange: (ids: string[]) => void;
  sortOrder: CollectionSortOrder;
  onSortOrderChange: (order: CollectionSortOrder) => void;
}) {
  const [products, setProducts] = useState<ProductOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  // Varios a la vez: marcarlos y subirlos al principio (o bajarlos, o
  // quitarlos) sin arrastrar uno por uno — pedido del 2026-10-19 con una
  // colección de 105 productos.
  const [selected, setSelected] = useState<string[]>([]);
  const [lastPicked, setLastPicked] = useState<string | null>(null);
  const [listQuery, setListQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    fetch("/api/marca/tienda/productos")
      .then((r) => r.json())
      .then((body) =>
        setProducts(
          (body.products ?? []).map((p: ProductOption) => ({
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            price: Number(p.price),
            status: p.status,
            stock: p.stock,
            createdAt: p.createdAt,
          })),
        ),
      )
      .catch(() => setProducts([]));
  }, []);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const manualList = productIds
    .map((id) => byId.get(id))
    .filter((p): p is ProductOption => p != null);
  const shown = sortProducts(manualList, sortOrder);
  const isManual = sortOrder === "MANUAL";
  const listFilter = listQuery.trim().toLowerCase();
  const visibleRows = listFilter ? shown.filter((p) => p.name.toLowerCase().includes(listFilter)) : shown;
  const chosen = selected.filter((id) => productIds.includes(id));
  const allVisibleChosen = visibleRows.length > 0 && visibleRows.every((p) => chosen.includes(p.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = productIds.indexOf(String(active.id));
    const to = productIds.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove(productIds, from, to));
  }

  function toggle(id: string) {
    onChange(productIds.includes(id) ? productIds.filter((i) => i !== id) : [...productIds, id]);
  }

  function pick(id: string, shift: boolean) {
    setNotice(null);
    const ids = visibleRows.map((p) => p.id);
    const from = lastPicked ? ids.indexOf(lastPicked) : -1;
    const to = ids.indexOf(id);
    const turnOn = !chosen.includes(id);
    const range = shift && from >= 0 && to >= 0 ? ids.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    setSelected((prev) => (turnOn ? Array.from(new Set([...prev, ...range])) : prev.filter((x) => !range.includes(x))));
    setLastPicked(id);
  }

  function toggleAllVisible() {
    const ids = visibleRows.map((p) => p.id);
    setSelected((prev) => (allVisibleChosen ? prev.filter((x) => !ids.includes(x)) : Array.from(new Set([...prev, ...ids]))));
  }

  /// Los marcados quedan juntos al principio (o al final), en el orden en
  /// que estaban entre ellos. Con un orden automático, pasa a Manual
  /// partiendo de lo que se veía.
  function moveChosen(where: "top" | "bottom") {
    const base = isManual ? productIds : shown.map((p) => p.id);
    const moving = base.filter((id) => chosen.includes(id));
    const rest = base.filter((id) => !chosen.includes(id));
    onChange(where === "top" ? [...moving, ...rest] : [...rest, ...moving]);
    if (!isManual) onSortOrderChange("MANUAL");
    setSelected([]);
    setListQuery("");
    const n = moving.length;
    setNotice(
      `${n} producto${n === 1 ? "" : "s"} ${where === "top" ? (n === 1 ? "subió al principio" : "subieron al principio") : n === 1 ? "bajó al final" : "bajaron al final"}${isManual ? "" : " (el orden quedó en Manual)"}. Guarda la colección para que se vea así en tu tienda.`,
    );
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: where === "top" ? 0 : listRef.current.scrollHeight }));
  }

  function removeChosen() {
    const n = chosen.length;
    onChange(productIds.filter((id) => !chosen.includes(id)));
    setSelected([]);
    setNotice(`${n} producto${n === 1 ? "" : "s"} fuera de la colección. Guarda la colección para confirmarlo.`);
  }

  function changeSort(next: CollectionSortOrder) {
    // Al pasar a Manual se parte del orden que se estaba viendo, como en
    // Shopify — no salta de golpe a un orden viejo.
    if (next === "MANUAL" && !isManual) onChange(shown.map((p) => p.id));
    onSortOrderChange(next);
  }

  const filtered = (products ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const pickerOpen = browsing || query.trim().length > 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar productos para agregar"
          className="input text-sm flex-1"
        />
        <button
          type="button"
          onClick={() => setBrowsing((b) => !b)}
          className="text-sm border border-brand-line rounded-full px-4 hover:bg-brand-accent-soft shrink-0"
        >
          {pickerOpen ? "Cerrar" : "Explorar"}
        </button>
      </div>

      {pickerOpen && (
        <div className="rounded-xl border border-brand-line overflow-hidden">
          <div className="max-h-64 overflow-y-auto divide-y divide-brand-line">
            {products === null ? (
              <p className="text-xs text-brand-ink-soft p-3">Cargando...</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-brand-ink-soft p-3">Sin productos con ese nombre.</p>
            ) : (
              filtered.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-brand-bg"
                >
                  <input
                    type="checkbox"
                    checked={productIds.includes(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-brand-bg shrink-0" />
                  )}
                  <span className="text-brand-ink truncate">{p.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-brand-line overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-brand-bg border-b border-brand-line">
          <p className="text-sm font-medium text-brand-ink">
            {productIds.length} producto{productIds.length === 1 ? "" : "s"} en la colección
          </p>
          <label className="flex items-center gap-2 text-xs text-brand-ink-soft">
            Ordenar
            <select
              value={sortOrder}
              onChange={(e) => changeSort(e.target.value as CollectionSortOrder)}
              className="input text-xs py-1.5 w-auto"
            >
              {(Object.keys(SORT_LABELS) as CollectionSortOrder[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {products === null ? (
          <p className="text-xs text-brand-ink-soft p-3">Cargando...</p>
        ) : shown.length === 0 ? (
          <p className="text-xs text-brand-ink-soft p-3">
            Todavía no hay productos. Búscalos arriba o toca Explorar para agregarlos.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-brand-ink-soft px-3 pt-2">
              {isManual
                ? "Así se ven en tu tienda. Arrastra desde los puntitos para cambiar el orden, o marca varios y súbelos al principio de una vez (con Shift marcas todos los del medio)."
                : "Orden automático: los productos nuevos se acomodan solos. Para moverlos a mano, elige Manual — o marca varios y súbelos al principio."}
            </p>
            <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-brand-ink-soft shrink-0">
                <input type="checkbox" checked={allVisibleChosen} onChange={toggleAllVisible} aria-label="Seleccionar todos los de la lista" />
                {listFilter ? "Todos los que coinciden" : "Todos"}
              </label>
              <input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Buscar en la colección (ej. Morados)"
                aria-label="Buscar en la colección"
                className="input text-xs py-1.5 flex-1 min-w-[10rem]"
              />
            </div>
            {chosen.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mx-3 mt-2 rounded-lg bg-brand-accent-soft px-3 py-2">
                <span className="text-sm font-medium text-brand-ink">
                  {chosen.length} seleccionado{chosen.length === 1 ? "" : "s"}
                </span>
                <button type="button" onClick={() => moveChosen("top")} className="rounded-full bg-brand-ink text-brand-bg px-3.5 py-1.5 text-xs font-semibold hover:opacity-90">
                  Subir al principio
                </button>
                <button type="button" onClick={() => moveChosen("bottom")} className="rounded-full border border-brand-line bg-brand-surface px-3.5 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-bg">
                  Bajar al final
                </button>
                <button type="button" onClick={removeChosen} className="rounded-full border border-brand-line bg-brand-surface px-3.5 py-1.5 text-xs font-medium text-red-700 hover:bg-brand-bg">
                  Quitar de la colección
                </button>
                <button type="button" onClick={() => setSelected([])} className="ml-auto text-xs text-brand-ink-soft hover:underline">
                  Deseleccionar
                </button>
              </div>
            )}
            {notice && <p className="text-xs text-brand-ink px-3 pt-2">{notice}</p>}
            {visibleRows.length === 0 && <p className="text-xs text-brand-ink-soft p-3">Ningún producto de la colección se llama así.</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={visibleRows.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ul ref={listRef} className="max-h-[28rem] overflow-y-auto divide-y divide-brand-line mt-2 border-t border-brand-line">
                  {visibleRows.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      index={shown.indexOf(p)}
                      // Con la lista filtrada no se arrastra: el lugar que
                      // se ve no sería el real.
                      draggable={isManual && !listFilter}
                      selected={chosen.includes(p.id)}
                      onSelect={(shift) => pick(p.id, shift)}
                      onRemove={() => toggle(p.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
    </div>
  );
}
