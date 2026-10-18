/// Filtros de la página de colección: las facetas salen solas de los
/// productos que hay (atributos como Tono o Grupo, los ejes de las
/// variantes, el tamaño que diga el nombre, rangos de precio y
/// disponibilidad), se aplican en el navegador y no hay nada que
/// configurar. Acá vive lo puro, sin React: facetas, coincidencia y
/// orden. Ver conversación del 2026-10-18 ("un motor eficiente de
/// filtrar… por tonos, por precio, por ml y demás").

export type FilterableVariant = {
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null;
  stock: number | null;
};

export type FilterableProduct = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  hasVariants?: boolean;
  optionNames?: string[];
  variants?: FilterableVariant[];
  attributes?: Record<string, string>;
};

export type FacetValue = { value: string; count: number };
export type Facet = { key: string; label: string; values: FacetValue[] };
/// min incluido, max excluido; max null = sin tope.
export type PriceBucket = { key: string; label: string; min: number; max: number | null; count: number };

export type SortKey = "recommended" | "price-asc" | "price-desc" | "name";

export type FilterState = {
  text: string;
  /// Valores elegidos por faceta (clave normalizada → valores).
  values: Record<string, string[]>;
  /// Claves de los rangos de precio elegidos.
  price: string[];
  onlyAvailable: boolean;
  sort: SortKey;
};

export const EMPTY_FILTERS: FilterState = { text: "", values: {}, price: [], onlyAvailable: false, sort: "recommended" };

export const SIZE_LABEL = "Tamaño";

/// Clave de una faceta: sin acentos ni mayúsculas, para que "Color" y
/// "color" sean la misma.
export function facetKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/// Nombres de eje que Shopify pone por defecto cuando no hay uno real.
const GENERIC_AXES = new Set(["title", "titulo", "default title", "opcion", "option"]);

/// "Gel Polish 15 ml", "Crema 250g", "Kit x 12 unidades" → "15 ml",
/// "250 g", "12 unidades". Null si el nombre no dice tamaño.
export function detectSize(name: string): string | null {
  const m = /(\d+(?:[.,]\d+)?)\s?(ml|mL|ML|cc|l|L|g|gr|gramos|kg|oz|onzas?|und|unds|unidades|pzas?|piezas|pares?)\b/.exec(name);
  if (!m) return null;
  const amount = m[1].replace(",", ".");
  const unit = m[2].toLowerCase();
  const normalized =
    unit === "ml" || unit === "cc" ? "ml" : unit === "l" ? "L" : unit === "g" || unit === "gr" || unit === "gramos" ? "g" : unit === "kg" ? "kg" : unit.startsWith("onza") ? "oz" : unit === "oz" ? "oz" : unit.startsWith("und") || unit === "unidades" ? "unidades" : unit.startsWith("pza") || unit === "piezas" ? "piezas" : "pares";
  const number = Number(amount);
  const amountText = Number.isFinite(number) ? String(number).replace(".", ",") : amount;
  return `${amountText} ${normalized}`;
}

/// Todo por lo que se puede filtrar un producto: sus atributos, los
/// valores de cada eje de sus variantes y el tamaño del nombre.
export function productFacetValues(product: FilterableProduct): Map<string, { label: string; values: Set<string> }> {
  const out = new Map<string, { label: string; values: Set<string> }>();
  const add = (label: string, value: string | null | undefined) => {
    const clean = (value ?? "").trim();
    const cleanLabel = label.trim();
    if (!clean || !cleanLabel) return;
    const key = facetKey(cleanLabel);
    const entry = out.get(key) ?? { label: cleanLabel, values: new Set<string>() };
    entry.values.add(clean);
    out.set(key, entry);
  };
  for (const [label, value] of Object.entries(product.attributes ?? {})) {
    if (typeof value === "string") add(label, value);
  }
  if (product.hasVariants && product.variants && product.optionNames) {
    product.optionNames.forEach((name, idx) => {
      const label = GENERIC_AXES.has(facetKey(name)) ? "Opción" : name;
      const key = `option${idx + 1}Value` as "option1Value" | "option2Value" | "option3Value";
      for (const v of product.variants!) add(label, v[key]);
    });
  }
  const size = detectSize(product.name);
  if (size && !out.has(facetKey(SIZE_LABEL))) add(SIZE_LABEL, size);
  return out;
}

function nicePrice(value: number) {
  const step = value >= 200000 ? 20000 : value >= 50000 ? 10000 : value >= 20000 ? 5000 : 1000;
  return Math.round(value / step) * step;
}

export function formatPesos(amount: number) {
  return `$ ${Math.round(amount).toLocaleString("es-CO")}`;
}

/// Hasta 4 rangos de precio con cortes "bonitos" en los cuartiles de los
/// precios que hay — ninguno si todos cuestan casi lo mismo.
export function priceBuckets(prices: number[]): PriceBucket[] {
  const distinct = Array.from(new Set(prices.filter((p) => Number.isFinite(p) && p > 0))).sort((a, b) => a - b);
  if (distinct.length < 2) return [];
  const min = distinct[0];
  const max = distinct[distinct.length - 1];
  if (max - min < 1000) return [];
  const at = (fraction: number) => distinct[Math.min(distinct.length - 1, Math.floor(fraction * distinct.length))];
  const cuts = Array.from(new Set([nicePrice(at(0.25)), nicePrice(at(0.5)), nicePrice(at(0.75))]))
    .filter((c) => c > min && c <= max)
    .sort((a, b) => a - b);
  if (cuts.length === 0) return [];
  const buckets: PriceBucket[] = [];
  let lower = 0;
  cuts.forEach((cut, i) => {
    buckets.push({
      key: `p${i}`,
      label: i === 0 ? `Hasta ${formatPesos(cut)}` : `${formatPesos(lower)} – ${formatPesos(cut)}`,
      min: lower,
      max: cut,
      count: 0,
    });
    lower = cut;
  });
  buckets.push({ key: `p${cuts.length}`, label: `Más de ${formatPesos(lower)}`, min: lower, max: null, count: 0 });
  for (const price of prices) {
    const b = buckets.find((x) => price >= x.min && (x.max == null || price < x.max));
    if (b) b.count++;
  }
  return buckets.filter((b) => b.count > 0);
}

/// Facetas con al menos dos valores distintos (con uno solo no hay nada
/// que filtrar), valores ordenados por frecuencia y nombre.
export function buildFacets(products: FilterableProduct[]): { facets: Facet[]; priceBuckets: PriceBucket[] } {
  const byKey = new Map<string, { label: string; counts: Map<string, number> }>();
  for (const product of products) {
    for (const [key, entry] of productFacetValues(product)) {
      const facet = byKey.get(key) ?? { label: entry.label, counts: new Map<string, number>() };
      for (const value of entry.values) facet.counts.set(value, (facet.counts.get(value) ?? 0) + 1);
      byKey.set(key, facet);
    }
  }
  const facets: Facet[] = [];
  for (const [key, facet] of byKey) {
    if (facet.counts.size < 2) continue;
    const values = Array.from(facet.counts, ([value, count]) => ({ value, count })).sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value, "es", { numeric: true }),
    );
    facets.push({ key, label: facet.label, values });
  }
  // Las más útiles primero: pocas opciones claras antes que listas largas,
  // y el tamaño al final.
  facets.sort((a, b) => {
    if (a.key === facetKey(SIZE_LABEL)) return 1;
    if (b.key === facetKey(SIZE_LABEL)) return -1;
    return a.values.length - b.values.length;
  });
  return { facets, priceBuckets: priceBuckets(products.map((p) => p.price)) };
}

function isAvailable(product: FilterableProduct) {
  if (product.hasVariants && product.variants && product.variants.length > 0) {
    return product.variants.some((v) => v.stock == null || v.stock > 0);
  }
  return product.stock == null || product.stock > 0;
}

export function matchesFilters(product: FilterableProduct, state: FilterState, buckets: PriceBucket[]): boolean {
  if (state.onlyAvailable && !isAvailable(product)) return false;
  const own = productFacetValues(product);
  for (const [key, chosen] of Object.entries(state.values)) {
    if (chosen.length === 0) continue;
    const values = own.get(key)?.values;
    if (!values || !chosen.some((c) => values.has(c))) return false;
  }
  if (state.price.length > 0) {
    const inRange = state.price.some((key) => {
      const b = buckets.find((x) => x.key === key);
      return b ? product.price >= b.min && (b.max == null || product.price < b.max) : false;
    });
    if (!inRange) return false;
  }
  const text = fold(state.text.trim());
  if (text) {
    const haystack = [product.name, ...Array.from(own.values()).flatMap((e) => Array.from(e.values))].map(fold).join(" ");
    if (!text.split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  return true;
}

export function sortProducts<T extends FilterableProduct>(products: T[], sort: SortKey): T[] {
  if (sort === "recommended") return products;
  const copy = [...products];
  if (sort === "price-asc") copy.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") copy.sort((a, b) => b.price - a.price);
  else copy.sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
  return copy;
}

export function applyFilters<T extends FilterableProduct>(products: T[], state: FilterState, buckets: PriceBucket[]): T[] {
  return sortProducts(
    products.filter((p) => matchesFilters(p, state, buckets)),
    state.sort,
  );
}

export function activeFilterCount(state: FilterState) {
  return (
    Object.values(state.values).reduce((n, v) => n + v.length, 0) +
    state.price.length +
    (state.onlyAvailable ? 1 : 0) +
    (state.text.trim() ? 1 : 0)
  );
}
