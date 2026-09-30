import { ProductCard, type CardProduct } from "@/components/storefront/product-card";

/// Grilla de las landing de colección y del buscador — la misma tarjeta
/// que el catálogo (ver ProductCard): 2 por fila en celular y 4 en
/// computadora, como la página de colección de la tienda Shopify que la
/// marca tomó de referencia. Antes tenía su propia tarjeta con opciones
/// aparte (imagen/título/botones) en Diseño → "Página de colección", que
/// se confundía con "Catálogo". Ver conversación del 2026-09-30.
export function CollectionProductGrid({
  products,
  basePath,
}: {
  products: CardProduct[];
  basePath: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} basePath={basePath} />
      ))}
    </div>
  );
}
