import type { ShopifyCsvStats, ShopifyImportProduct } from "@/lib/shopify-csv";
import type { ShopifyImportCollection } from "@/lib/shopify-products-json";

/// Qué parte de una tienda traer en "Duplicar tienda": toda, una colección,
/// una marca (una tienda que vende varias, como blissednails.co con
/// Shilke) o los productos cuyo nombre o marca diga una palabra. Pedido
/// del 2026-10-19: "que la herramienta pueda descargar una colección o una
/// marca en específico".
export type ScopeKind = "all" | "collection" | "brand" | "text";
export type ImportScope = { kind: ScopeKind; value: string };
export const ALL_STORE: ImportScope = { kind: "all", value: "" };

function fold(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/// Las marcas de los productos (el "Vendor" de Shopify, la marca de
/// WooCommerce o del JSON-LD), de la que más tiene a la que menos.
export function vendorsOf(products: ShopifyImportProduct[]): { name: string; count: number }[] {
  const byKey = new Map<string, { name: string; count: number }>();
  for (const p of products) {
    const name = p.vendor?.trim();
    if (!name) continue;
    const entry = byKey.get(fold(name)) ?? { name, count: 0 };
    entry.count++;
    byKey.set(fold(name), entry);
  }
  return Array.from(byKey.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/// Los productos y colecciones de esa parte de la tienda. Las colecciones
/// quedan solo con sus productos que entran, y las que quedan vacías no van.
export function applyImportScope(
  products: ShopifyImportProduct[],
  collections: ShopifyImportCollection[],
  scope: ImportScope,
): { products: ShopifyImportProduct[]; collections: ShopifyImportCollection[] } {
  if (scope.kind === "all") return { products, collections };
  const chosen = scope.kind === "collection" ? collections.find((c) => c.handle === scope.value) : null;
  const needle = fold(scope.value);
  const inScope = (p: ShopifyImportProduct) => {
    switch (scope.kind) {
      case "collection":
        return Boolean(chosen?.productHandles.includes(p.handle));
      case "brand":
        return needle.length > 0 && fold(p.vendor ?? "") === needle;
      case "text":
        return needle.length > 0 && fold(`${p.name} ${p.vendor ?? ""}`).includes(needle);
    }
  };
  const scoped = products.filter(inScope);
  const handles = new Set(scoped.map((p) => p.handle));
  return {
    products: scoped,
    collections: collections
      .filter((c) => scope.kind !== "collection" || c.handle === scope.value)
      .map((c) => ({ ...c, productHandles: c.productHandles.filter((h) => handles.has(h)) }))
      .filter((c) => c.productHandles.length > 0),
  };
}

export function importStats(products: ShopifyImportProduct[]): ShopifyCsvStats {
  const stats: ShopifyCsvStats = { products: 0, withVariants: 0, images: 0, unknownStock: 0, draft: 0 };
  for (const p of products) {
    stats.products++;
    stats.images += p.images.length;
    if (p.hasVariants) stats.withVariants++;
    if (p.status === "DRAFT") stats.draft++;
    if (p.stock == null || p.hasVariants) stats.unknownStock++;
  }
  return stats;
}
