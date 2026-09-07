import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { formatCOP, type CatalogProduct } from "./types";

/// Grid parejo de tarjetas — la plantilla de siempre, ahora una opción más
/// entre varias en vez de la única forma de ver el catálogo.
export function ClasicaTemplate({
  products,
  basePath,
}: {
  products: CatalogProduct[];
  basePath: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {products.map((product) => (
        <div
          key={product.id}
          className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden flex flex-col"
        >
          <Link href={`${basePath}/${product.slug}`}>
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-brand-accent-soft" />
            )}
          </Link>
          <div className="p-3 flex flex-col gap-2 flex-1">
            <Link href={`${basePath}/${product.slug}`}>
              {product.type === "SERVICE" && (
                <p className="text-[10px] font-mono text-brand-accent mb-0.5">
                  SERVICIO
                </p>
              )}
              <p className="text-xs font-medium text-brand-ink leading-snug line-clamp-2">
                {product.name}
              </p>
            </Link>
            <p className="text-xs font-mono text-brand-ink-soft">
              {formatCOP(product.price)}
            </p>
            <div className="mt-auto">
              <AddToCartButton
                product={{
                  id: product.id,
                  slug: product.slug ?? "",
                  name: product.name,
                  price: product.price,
                  imageUrl: product.imageUrl,
                  stock: product.stock,
                  type: product.type,
                }}
                className="w-full bg-brand-accent text-white rounded-full px-3 py-1.5 text-[11px] font-semibold hover:opacity-90 disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
