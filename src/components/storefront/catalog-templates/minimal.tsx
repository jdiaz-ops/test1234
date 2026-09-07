import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { formatCOP, type CatalogProduct } from "./types";

/// Lista vertical, sin tarjetas ni bordes — el texto lleva el peso, no la
/// imagen (que queda chica, redonda). Pensada para catálogos cortos y
/// curados, tipo boutique — todo lo contrario a un grid denso.
export function MinimalTemplate({
  products,
  basePath,
}: {
  products: CatalogProduct[];
  basePath: string;
}) {
  return (
    <div className="divide-y divide-brand-line">
      {products.map((product) => (
        <div key={product.id} className="flex items-center gap-5 py-6">
          <Link
            href={`${basePath}/${product.slug}`}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden shrink-0 bg-brand-accent-soft"
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : null}
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`${basePath}/${product.slug}`}>
              {product.type === "SERVICE" && (
                <p className="text-[10px] font-mono text-brand-accent mb-0.5">
                  SERVICIO
                </p>
              )}
              <p className="font-display text-base text-brand-ink truncate">
                {product.name}
              </p>
            </Link>
            <p className="text-sm font-mono text-brand-ink-soft mt-1">
              {formatCOP(product.price)}
            </p>
          </div>
          <div className="shrink-0">
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
              className="border border-brand-ink text-brand-ink rounded-full px-4 py-1.5 text-xs font-medium hover:bg-brand-ink hover:text-white transition-colors disabled:opacity-40"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
