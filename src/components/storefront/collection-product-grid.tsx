import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import type { ThemeConfig } from "@/lib/brand-theme";

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

type CollectionProduct = {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  type: "PHYSICAL" | "SERVICE" | "DIGITAL";
};

/// Tarjeta de producto de las landing de colección — a diferencia del
/// catálogo principal (que usa la plantilla elegida en Plantilla:
/// Clásica/Minimal/Editorial), acá es siempre esta misma tarjeta, fija
/// de a 2 por fila en cualquier pantalla: imagen, título, y los dos
/// botones ("Ver producto" + "Agregar al carrito") — cada elemento se
/// prende/apaga desde Diseño → Colecciones. Ver conversación del
/// 2026-09-14.
export function CollectionProductGrid({
  products,
  basePath,
  config,
}: {
  products: CollectionProduct[];
  basePath: string;
  config: ThemeConfig["collections"];
}) {
  return (
    // Fijo de a 2 en celular (pedido explícito) — en computadora, 3 por
    // fila: con 4 las tarjetas quedan angostas para dos botones apilados
    // ("Ver producto" + "Agregar al carrito"), 3 les deja más aire.
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {products.map((product) => {
        const href = `${basePath}/${product.slug}`;
        return (
          <div
            key={product.id}
            className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden flex flex-col"
          >
            {config.showImage && (
              <Link href={href}>
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
            )}
            <div className="p-3 flex flex-col gap-2 flex-1">
              {config.showTitle && (
                <Link href={href}>
                  {product.type === "SERVICE" && (
                    <p className="text-[10px] font-mono text-brand-accent mb-0.5">SERVICIO</p>
                  )}
                  {product.type === "DIGITAL" && (
                    <p className="text-[10px] font-mono text-brand-accent mb-0.5">DIGITAL</p>
                  )}
                  <p className="text-xs font-medium text-brand-ink leading-snug line-clamp-2">
                    {product.name}
                  </p>
                </Link>
              )}
              <p className="text-xs font-mono text-brand-ink-soft">{formatCOP(product.price)}</p>
              {(config.showViewProductButton || config.showAddToCartButton) && (
                <div className="mt-auto flex flex-col gap-1.5">
                  {config.showViewProductButton && (
                    <Link
                      href={href}
                      className="block text-center w-full border border-brand-ink text-brand-ink rounded-full px-3 py-1.5 text-[11px] font-semibold hover:bg-brand-ink hover:text-white transition-colors"
                    >
                      Ver producto
                    </Link>
                  )}
                  {config.showAddToCartButton && (
                    <AddToCartButton
                      basePath={basePath}
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
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
