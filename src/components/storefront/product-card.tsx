import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { formatCOP } from "@/components/storefront/catalog-templates/types";

export type CardProduct = {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  stock: number | null;
  type: "PHYSICAL" | "SERVICE" | "DIGITAL";
};

/// Clases compartidas por los botones de las tarjetas (agregar al carrito,
/// ver producto) — rectangulares, de ancho completo y en mayúsculas, como
/// el botón de compra de Shopify que la marca tomó de referencia.
export const CARD_BUTTON_CLASS =
  "w-full rounded-lg px-3 py-2.5 text-xs font-bold uppercase tracking-wide";

/// % de descuento cuando hay un precio tachado mayor al real — null si
/// el producto no está en oferta.
export function discountPercent(price: number, compareAtPrice: number | null | undefined) {
  if (compareAtPrice == null || compareAtPrice <= 0 || compareAtPrice <= price) return null;
  const percent = Math.round((1 - price / compareAtPrice) * 100);
  return percent > 0 ? percent : null;
}

/// Precio con el tachado al lado cuando hay oferta — como en Shopify:
/// primero el precio viejo tachado, después el de oferta resaltado en el
/// color de la marca. `className` fija el tamaño base (el tachado sale un
/// poco más chico). Ver conversación del 2026-09-30 ("mire como se ve en
/// shopify versus en marcolini").
export function ProductPrice({
  price,
  compareAtPrice,
  className = "text-base",
}: {
  price: number;
  compareAtPrice: number | null;
  className?: string;
}) {
  const onSale = discountPercent(price, compareAtPrice) != null;
  return (
    <p className={`${className} flex items-baseline gap-1.5 flex-wrap`}>
      {onSale && (
        <span className="text-[0.85em] line-through text-brand-ink-soft">
          {formatCOP(compareAtPrice!)}
        </span>
      )}
      <span className={`font-bold ${onSale ? "text-brand-accent" : "text-brand-ink"}`}>
        {formatCOP(price)}
      </span>
    </p>
  );
}

/// Sello "-26%" en la esquina de la foto — solo cuando hay oferta. Va
/// dentro de un contenedor `relative`.
export function DiscountBadge({ price, compareAtPrice }: { price: number; compareAtPrice: number | null }) {
  const percent = discountPercent(price, compareAtPrice);
  if (percent == null) return null;
  return (
    <span className="absolute top-2 right-2 rounded-full bg-brand-accent text-white text-[11px] font-bold px-2 py-0.5 shadow">
      -{percent}%
    </span>
  );
}

/// La tarjeta estándar de producto — la misma en el catálogo Clásico, en
/// Colección destacada y en Destacados/Novedades/Ofertas, así todas las
/// secciones se ven igual. Sin caja ni borde alrededor: la foto ocupa
/// todo el ancho de su columna y debajo van nombre, precio y el botón de
/// ancho completo — la marca comparó con su tienda Shopify y ahí las
/// fotos se veían "mucho más grandes", la caja con relleno se las comía.
/// Ver conversación del 2026-09-30. `className` trae el ancho cuando va
/// dentro de un carrusel.
export function ProductCard({
  product,
  basePath,
  className = "",
}: {
  product: CardProduct;
  basePath: string;
  className?: string;
}) {
  const href = `${basePath}/${product.slug}`;
  return (
    <div className={`flex flex-col ${className}`}>
      <Link href={href} className="relative block overflow-hidden rounded-lg bg-brand-accent-soft">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca
          <img src={product.imageUrl} alt={product.name} className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square" />
        )}
        <DiscountBadge price={product.price} compareAtPrice={product.compareAtPrice} />
      </Link>
      <div className="pt-2.5 flex flex-col gap-1.5 flex-1">
        <Link href={href}>
          {product.type === "SERVICE" && (
            <p className="text-[10px] font-mono text-brand-accent mb-0.5">SERVICIO</p>
          )}
          {product.type === "DIGITAL" && (
            <p className="text-[10px] font-mono text-brand-accent mb-0.5">DIGITAL</p>
          )}
          <p className="text-sm font-semibold text-brand-ink leading-snug line-clamp-2">{product.name}</p>
        </Link>
        <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} />
        <div className="mt-auto pt-1">
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
            className={`${CARD_BUTTON_CLASS} bg-brand-accent text-white hover:opacity-90 disabled:opacity-40`}
          />
        </div>
      </div>
    </div>
  );
}
