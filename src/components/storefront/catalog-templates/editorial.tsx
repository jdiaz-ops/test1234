import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { DiscountBadge, ProductPrice } from "@/components/storefront/product-card";
import type { CatalogProduct } from "./types";

/// Hero grande para el primer producto (el que la marca destaca primero al
/// listarlos) + grid más chico para el resto — tipo revista, no catálogo
/// parejo. El primero lleva el peso visual; los demás son secundarios.
export function EditorialTemplate({
  products,
  basePath,
}: {
  products: CatalogProduct[];
  basePath: string;
}) {
  const [featured, ...rest] = products;
  if (!featured) return null;

  return (
    <div>
      <Link href={`${basePath}/${featured.slug}`} className="block mb-10 group">
        <div className="relative w-full aspect-[16/10] rounded-3xl overflow-hidden bg-brand-accent-soft">
          {featured.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
            <img
              src={featured.imageUrl}
              alt={featured.name}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          )}
          <DiscountBadge price={featured.price} compareAtPrice={featured.compareAtPrice} />
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
          <div>
            {featured.type === "SERVICE" && (
              <p className="text-xs font-mono text-brand-accent mb-1">
                SERVICIO
              </p>
            )}
            {featured.type === "DIGITAL" && (
              <p className="text-xs font-mono text-brand-accent mb-1">
                DIGITAL
              </p>
            )}
            <p className="font-display text-2xl font-semibold text-brand-ink">
              {featured.name}
            </p>
            <ProductPrice
              price={featured.price}
              compareAtPrice={featured.compareAtPrice}
              className="text-lg mt-1"
            />
          </div>
          <AddToCartButton
            basePath={basePath}
            product={{
              id: featured.id,
              slug: featured.slug ?? "",
              name: featured.name,
              price: featured.price,
              imageUrl: featured.imageUrl,
              stock: featured.stock,
              type: featured.type,
            }}
            className="bg-brand-button text-brand-button-text rounded-full px-6 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          />
        </div>
      </Link>

      {rest.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {rest.map((product) => (
            <div key={product.id} className="flex flex-col gap-1.5">
              <Link
                href={`${basePath}/${product.slug}`}
                className="relative block aspect-square rounded-xl overflow-hidden bg-brand-accent-soft"
              >
                {product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                )}
                <DiscountBadge price={product.price} compareAtPrice={product.compareAtPrice} />
              </Link>
              <Link href={`${basePath}/${product.slug}`}>
                <p className="text-[11px] text-brand-ink leading-snug line-clamp-2">
                  {product.name}
                </p>
              </Link>
              <ProductPrice
                price={product.price}
                compareAtPrice={product.compareAtPrice}
                className="text-xs"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
