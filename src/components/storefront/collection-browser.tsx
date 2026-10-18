"use client";

import { useMemo, useState } from "react";
import { ProductCard, type CardProduct } from "@/components/storefront/product-card";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  applyFilters,
  buildFacets,
  type Facet,
  type FilterState,
  type PriceBucket,
  type SortKey,
} from "@/lib/collection-filters";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "Recomendados" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "name", label: "Nombre: A–Z" },
];

const SHOW_LIMIT = 8;

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FacetGroup({
  facet,
  chosen,
  onToggle,
}: {
  facet: Facet;
  chosen: string[];
  onToggle: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const values = q ? facet.values.filter((v) => v.value.toLowerCase().includes(q)) : facet.values;
  const visible = expanded || q ? values : values.slice(0, SHOW_LIMIT);
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-brand-ink mb-2">{facet.label}</legend>
      {facet.values.length > 12 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Buscar ${facet.label.toLowerCase()}`}
          aria-label={`Buscar ${facet.label.toLowerCase()}`}
          className="mb-2 w-full rounded-md border border-brand-line bg-brand-surface px-2.5 py-1.5 text-xs text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:ring-1 focus:ring-brand-accent"
        />
      )}
      <ul className="space-y-1.5">
        {visible.map((v) => (
          <li key={v.value}>
            <label className="flex items-center gap-2 text-sm text-brand-ink cursor-pointer">
              <input type="checkbox" checked={chosen.includes(v.value)} onChange={() => onToggle(v.value)} className="accent-brand-ink" />
              <span className="flex-1 truncate">{v.value}</span>
              <span className="text-xs text-brand-ink-soft tabular-nums">{v.count}</span>
            </label>
          </li>
        ))}
        {visible.length === 0 && <li className="text-xs text-brand-ink-soft">Nada coincide.</li>}
      </ul>
      {!q && values.length > SHOW_LIMIT && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1.5 text-xs font-medium text-brand-accent hover:underline">
          {expanded ? "Ver menos" : `Ver ${values.length - SHOW_LIMIT} más`}
        </button>
      )}
    </fieldset>
  );
}

function FilterPanel({
  facets,
  buckets,
  state,
  setState,
  showAvailability,
}: {
  facets: Facet[];
  buckets: PriceBucket[];
  state: FilterState;
  setState: (next: FilterState) => void;
  showAvailability: boolean;
}) {
  return (
    <div className="space-y-6">
      <input
        type="search"
        value={state.text}
        onChange={(e) => setState({ ...state, text: e.target.value })}
        placeholder="Buscar en esta colección"
        aria-label="Buscar en esta colección"
        className="w-full rounded-full border border-brand-line bg-brand-surface px-3.5 py-2 text-sm text-brand-ink placeholder:text-brand-ink-soft focus:outline-none focus:ring-1 focus:ring-brand-accent"
      />
      {showAvailability && (
        <label className="flex items-center gap-2 text-sm text-brand-ink cursor-pointer">
          <input
            type="checkbox"
            checked={state.onlyAvailable}
            onChange={(e) => setState({ ...state, onlyAvailable: e.target.checked })}
            className="accent-brand-ink"
          />
          Solo disponibles
        </label>
      )}
      {facets.map((facet) => (
        <FacetGroup
          key={facet.key}
          facet={facet}
          chosen={state.values[facet.key] ?? []}
          onToggle={(value) =>
            setState({ ...state, values: { ...state.values, [facet.key]: toggle(state.values[facet.key] ?? [], value) } })
          }
        />
      ))}
      {buckets.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold text-brand-ink mb-2">Precio</legend>
          <ul className="space-y-1.5">
            {buckets.map((b) => (
              <li key={b.key}>
                <label className="flex items-center gap-2 text-sm text-brand-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.price.includes(b.key)}
                    onChange={() => setState({ ...state, price: toggle(state.price, b.key) })}
                    className="accent-brand-ink"
                  />
                  <span className="flex-1">{b.label}</span>
                  <span className="text-xs text-brand-ink-soft tabular-nums">{b.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </div>
  );
}

/// La página de colección con filtros: las facetas salen solas de los
/// productos (atributos como Grupo o Tono, los ejes de las variantes, el
/// tamaño del nombre, rangos de precio) y se aplican al instante, sin
/// recargar. En computadora van en una columna a la izquierda; en celular,
/// en un panel que abre el botón "Filtrar". Ver collection-filters.ts y
/// conversación del 2026-10-18.
export function CollectionBrowser({ products, basePath }: { products: CardProduct[]; basePath: string }) {
  const [state, setState] = useState<FilterState>(EMPTY_FILTERS);
  const [open, setOpen] = useState(false);
  const { facets, priceBuckets } = useMemo(() => buildFacets(products), [products]);
  const shown = useMemo(() => applyFilters(products, state, priceBuckets), [products, state, priceBuckets]);
  const showAvailability = products.some((p) =>
    p.hasVariants && p.variants ? p.variants.some((v) => v.stock != null && v.stock <= 0) : p.stock != null && p.stock <= 0,
  );
  const hasFilters = facets.length > 0 || priceBuckets.length > 0 || showAvailability || products.length > 8;
  const active = activeFilterCount(state);

  const chips: { label: string; clear: () => void }[] = [];
  for (const facet of facets) {
    for (const value of state.values[facet.key] ?? []) {
      chips.push({
        label: `${facet.label}: ${value}`,
        clear: () => setState((s) => ({ ...s, values: { ...s.values, [facet.key]: (s.values[facet.key] ?? []).filter((v) => v !== value) } })),
      });
    }
  }
  for (const key of state.price) {
    const b = priceBuckets.find((x) => x.key === key);
    if (b) chips.push({ label: b.label, clear: () => setState((s) => ({ ...s, price: s.price.filter((k) => k !== key) })) });
  }
  if (state.onlyAvailable) chips.push({ label: "Solo disponibles", clear: () => setState((s) => ({ ...s, onlyAvailable: false })) });
  if (state.text.trim()) chips.push({ label: `"${state.text.trim()}"`, clear: () => setState((s) => ({ ...s, text: "" })) });

  const panel = (
    <FilterPanel facets={facets} buckets={priceBuckets} state={state} setState={setState} showAvailability={showAvailability} />
  );

  const grid = (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${hasFilters ? "sm:grid-cols-3 xl:grid-cols-4" : "sm:grid-cols-4"}`}>
      {shown.map((product) => (
        <ProductCard key={product.id} product={product} basePath={basePath} />
      ))}
    </div>
  );

  if (!hasFilters) return grid;

  return (
    <div className="sm:grid sm:grid-cols-[220px_1fr] sm:gap-8 lg:grid-cols-[240px_1fr]">
      <aside className="hidden sm:block">
        <div className="sticky top-24">{panel}</div>
      </aside>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="sm:hidden inline-flex items-center gap-1.5 rounded-full border border-brand-ink px-3.5 py-1.5 text-sm font-medium text-brand-ink"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-4 h-4" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>
              Filtrar{active > 0 ? ` (${active})` : ""}
            </button>
            <p className="text-sm text-brand-ink-soft tabular-nums">
              {shown.length} {shown.length === 1 ? "producto" : "productos"}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-brand-ink-soft">
            <span className="hidden sm:inline">Ordenar:</span>
            <select
              value={state.sort}
              onChange={(e) => setState({ ...state, sort: e.target.value as SortKey })}
              aria-label="Ordenar"
              className="rounded-full border border-brand-line bg-brand-surface px-3 py-1.5 text-sm text-brand-ink"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {chips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1 rounded-full bg-brand-accent-soft px-3 py-1 text-xs font-medium text-brand-ink"
              >
                {chip.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button type="button" onClick={() => setState(EMPTY_FILTERS)} className="text-xs text-brand-ink-soft hover:underline">
              Quitar filtros
            </button>
          </div>
        )}

        {shown.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm text-brand-ink-soft">Ningún producto coincide con esos filtros.</p>
            <button type="button" onClick={() => setState(EMPTY_FILTERS)} className="text-sm font-medium text-brand-accent hover:underline">
              Quitar filtros
            </button>
          </div>
        ) : (
          grid
        )}
      </div>

      {/* Panel de celular, como el menú lateral: oscurece el fondo y entra
          desde la derecha. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 sm:hidden ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-brand-surface shadow-2xl flex flex-col transition-transform duration-300 motion-reduce:transition-none sm:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-line">
          <p className="font-display text-base font-semibold text-brand-ink">Filtros</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar filtros"
            className="w-8 h-8 flex items-center justify-center rounded-full text-brand-ink-soft hover:bg-brand-accent-soft hover:text-brand-ink text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{panel}</div>
        <div className="px-5 py-4 border-t border-brand-line flex items-center gap-3">
          {active > 0 && (
            <button type="button" onClick={() => setState(EMPTY_FILTERS)} className="text-sm text-brand-ink-soft hover:underline">
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto rounded-full bg-brand-button text-brand-button-text px-5 py-2 text-sm font-semibold"
          >
            Ver {shown.length} {shown.length === 1 ? "producto" : "productos"}
          </button>
        </div>
      </div>
    </div>
  );
}
