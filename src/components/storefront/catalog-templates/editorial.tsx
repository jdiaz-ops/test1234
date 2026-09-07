import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { formatCOP, type CatalogProduct } from "./types";

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
        <div className="w-full aspect-[16/10] rounded-3xl overflow-hidden bg-brand-accent-soft">
          {featured.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
            <img
              src={featured.imageUrl}
              alt={featured.name}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
          )}
        </div>
        <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
          <div>
            {featured.type === "SERVICE" && (
              <p className="text-xs font-mono text-brand-accent mb-1">
                SERVICIO
              </p>
            )}
            <p className="font-display text-2xl font-semibold text-brand-ink">
              {featured.name}
            </p>
            <p className="font-mono text-brand-ink-soft mt-1">
              {formatCOP(featured.price)}
            </p>
          </div>
          <AddToCartButton
            product={{
              id: featured.id,
              slug: featured.slug ?? "",
              name: featured.name,
              price: featured.price,
              imageUrl: featured.imageUrl,
              stock: featured.stock,
              type: featured.type,
            }}
            className="bg-brand-accent text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          />
        </div>
      </Link>

      {rest.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {rest.map((product) => (
            <div key={product.id} className="flex flex-col gap-1.5">
              <Link
                href={`${basePath}/${product.slug}`}
                className="block aspect-square rounded-xl overflow-hidden bg-brand-accent-soft"
              >
                {product.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </Link>
              <Link href={`${basePath}/${product.slug}`}>
                <p className="text-[11px] text-brand-ink leading-snug line-clamp-2">
                  {product.name}
                </p>
              </Link>
              <p className="text-[11px] font-mono text-brand-ink-soft">
                {formatCOP(product.price)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
