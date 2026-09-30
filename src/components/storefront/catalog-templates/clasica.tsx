import { ProductCard } from "@/components/storefront/product-card";
import type { CatalogProduct } from "./types";

/// Grid parejo de tarjetas — la plantilla de siempre, ahora una opción más
/// entre varias en vez de la única forma de ver el catálogo. Usa el
/// listado principal (home) — las landing de colección tienen su propia
/// tarjeta dedicada, ver collection-product-grid.tsx.
export function ClasicaTemplate({
  products,
  basePath,
  productsPerRow = "2-4",
}: {
  products: CatalogProduct[];
  basePath: string;
  /// Ver theme.productListing.productsPerRow en el editor de Diseño.
  productsPerRow?: "1-3" | "2-4";
}) {
  return (
    <div
      className={`grid gap-4 ${productsPerRow === "1-3" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} basePath={basePath} />
      ))}
    </div>
  );
}
