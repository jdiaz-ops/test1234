/// Precio de un producto con variantes.
///
/// El precio vive en cada variante; el del producto es el "base" (el que
/// usan las variantes sin precio propio) y es el que muestran las
/// tarjetas, el buscador y las secciones de la home. Para que no salga
/// "$ 0" en una colección, el base se mantiene en el menor precio de las
/// variantes (ver createManualProduct) y, cuando las variantes cuestan
/// distinto, la tarjeta dice "Desde". Ver conversación del 2026-10-18.

/// El menor precio entre las variantes con precio propio; si ninguna lo
/// tiene, el base que venga (el que puso la marca).
export function basePriceFor(variants: { price: number | null | undefined }[], fallback: number | null | undefined): number {
  const own = variants.map((v) => v.price).filter((p): p is number => typeof p === "number" && p > 0);
  if (own.length > 0) return Math.min(...own);
  return typeof fallback === "number" && fallback > 0 ? fallback : 0;
}

/// Qué muestra una tarjeta: el menor precio y si hay variantes más caras
/// ("Desde $X").
export function priceRange(price: number, variants?: { price: unknown }[] | null): { min: number; from: boolean } {
  const prices = (variants ?? [])
    .map((v) => (v.price == null ? price : Number(v.price)))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return { min: price, from: false };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, from: max > min };
}
