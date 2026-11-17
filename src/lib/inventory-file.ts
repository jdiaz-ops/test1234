import Papa from "papaparse";

/// Actualizar inventario y precio de promoción con el archivo de la marca
/// (CSV o Excel, como el "INVENTARIO 8 DE OCTUBRE 2026 - DERULO" de H la
/// Cosedora: Producto | Unidades | Precio unitario en oferta). Aquí se lee
/// el archivo y se busca cada fila en los productos de la tienda; aplicar
/// los cambios está en inventory-file-service.ts. Pedido del 2026-11-17.

export class InventoryFileError extends Error {}

/// Una fila del archivo. units o promoPrice en null: esa columna no viene
/// o la celda está vacía (no se toca).
export type InventoryRow = { line: number; name: string; units: number | null; promoPrice: number | null };

/// Minúsculas, sin tildes ni signos: "Quiubo, mor! " → "quiubo mor".
export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/// "2000", "$2.000", "2.000,50", "2,000.50" → número. Vacío o ilegible: null.
export function parseAmount(raw: string | null | undefined): number | null {
  let s = (raw ?? "").replace(/[^\d.,-]/g, "");
  if (!s || s === "-") return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // El último separador es el de los decimales.
    const decimal = lastDot > lastComma ? "." : ",";
    s = s.split(decimal === "." ? "," : ".").join("").replace(decimal, ".");
  } else if (lastDot >= 0 || lastComma >= 0) {
    // "2.000" o "1.000.000" son miles; "2,5" es decimal.
    const parts = s.split(lastDot >= 0 ? "." : ",");
    s = parts.length > 2 || parts[parts.length - 1].length === 3 ? parts.join("") : parts.join(".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const NAME_HEADER = /^(producto|productos|nombre|nombre del producto|referencia|product|item)$/;
const UNITS_HEADER = /(unidades|inventario|stock|cantidad|existencias)/;
const PRICE_HEADER = /(precio|oferta|tarifa|valor)/;
const PROMO_HINT = /(oferta|promo|especial)/;

/// Las filas de la tabla, empiece en la columna y la fila que empiece: se
/// busca la de los títulos (Producto, Unidades, Precio…) en las primeras.
export function readInventoryTable(cells: string[][]): InventoryRow[] {
  const headerAt = cells.slice(0, 15).findIndex((row) => {
    const titles = row.map((c) => normalizeName(c ?? ""));
    return titles.some((t) => NAME_HEADER.test(t)) && titles.some((t) => UNITS_HEADER.test(t) || PRICE_HEADER.test(t));
  });
  if (headerAt < 0) {
    throw new InventoryFileError("No encontramos los títulos: el archivo tiene que traer una columna «Producto» y otra de «Unidades» o de «Precio».");
  }
  const titles = cells[headerAt].map((c) => normalizeName(c ?? ""));
  const nameCol = titles.findIndex((t) => NAME_HEADER.test(t));
  const unitsCol = titles.findIndex((t) => UNITS_HEADER.test(t));
  // Si hay varias de precio, la de oferta/promoción.
  const priceCols = titles.map((t, i) => (PRICE_HEADER.test(t) && i !== unitsCol ? i : -1)).filter((i) => i >= 0);
  const priceCol = priceCols.find((i) => PROMO_HINT.test(titles[i])) ?? priceCols[0] ?? -1;

  const rows: InventoryRow[] = [];
  cells.slice(headerAt + 1).forEach((row, i) => {
    const name = (row[nameCol] ?? "").trim();
    if (!name) return;
    const units = unitsCol >= 0 ? parseAmount(row[unitsCol]) : null;
    const promo = priceCol >= 0 ? parseAmount(row[priceCol]) : null;
    rows.push({
      line: headerAt + i + 2,
      name,
      units: units != null && units >= 0 ? Math.round(units) : null,
      promoPrice: promo != null && promo > 0 ? promo : null,
    });
  });
  if (rows.length === 0) throw new InventoryFileError("El archivo no trae productos debajo de los títulos.");
  return rows;
}

/// CSV con coma o punto y coma (Excel en español guarda con ";"). Las
/// filas vacías se dejan para que "fila N" sea la misma que en Excel.
export function parseInventoryCsv(text: string): InventoryRow[] {
  const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: false });
  return readInventoryTable(result.data.map((row) => row.map((cell) => String(cell ?? ""))));
}

export type InventoryProduct = {
  id: string;
  name: string;
  sku: string | null;
  /// Valores de sus variantes ("Rojo", "Talla M"…), para avisar si la fila
  /// es una variante y no un producto.
  variantValues: string[];
};

export type RowMatch =
  | { kind: "product"; productId: string }
  | { kind: "ambiguous"; productIds: string[] }
  | { kind: "variant"; productId: string; variant: string }
  | { kind: "none" };

/// El producto de la tienda de una fila: por SKU, por nombre igual, o por
/// nombre que lo contiene como palabras ("Chicago" → "Esmalte Tradicional
/// Chicago"). Si varios coinciden, la marca elige.
export function matchInventoryRow(name: string, products: InventoryProduct[]): RowMatch {
  const wanted = normalizeName(name);
  if (!wanted) return { kind: "none" };
  const pick = (found: InventoryProduct[]): RowMatch | null =>
    found.length === 1
      ? { kind: "product", productId: found[0].id }
      : found.length > 1
        ? { kind: "ambiguous", productIds: found.map((p) => p.id) }
        : null;
  const bySku = products.filter((p) => p.sku && normalizeName(p.sku) === wanted);
  if (bySku.length === 1) return { kind: "product", productId: bySku[0].id };
  const exact = pick(products.filter((p) => normalizeName(p.name) === wanted));
  if (exact) return exact;
  const containing = pick(products.filter((p) => ` ${normalizeName(p.name)} `.includes(` ${wanted} `)));
  if (containing) return containing;
  for (const p of products) {
    const variant = p.variantValues.find((v) => normalizeName(v) === wanted);
    if (variant) return { kind: "variant", productId: p.id, variant };
  }
  return { kind: "none" };
}
