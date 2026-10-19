import Link from "next/link";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CardVariantPicker } from "@/components/storefront/card-variant-picker";
import { CardPhoto } from "@/components/storefront/card-photo";
import { DiscountPill } from "@/components/storefront/discount-badge";
import { formatCOP } from "@/components/storefront/catalog-templates/types";
import { priceRange } from "@/lib/product-price";
import { readProductAttributes } from "@/lib/product-attributes";

export type CardVariant = {
  id: string;
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  /// null = usa el precio base del producto.
  price: number | null;
  imageUrl: string | null;
  /// null = sin control de inventario.
  stock: number | null;
};

export type CardProduct = {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  compareAtPrice: number | null;
  /// Hay variantes más caras que `price`: se muestra "Desde".
  priceFrom?: boolean;
  imageUrl: string | null;
  stock: number | null;
  type: "PHYSICAL" | "SERVICE" | "DIGITAL";
  /// Con variantes la tarjeta deja elegir la combinación antes de agregar
  /// al carrito (ver CardVariantPicker) — antes agregaba el producto sin
  /// variante, como si una placa de 12 tonos fuera uno solo.
  hasVariants?: boolean;
  optionNames?: string[];
  variants?: CardVariant[];
  /// Atributos para los filtros de la colección (ver collection-filters.ts).
  attributes?: Record<string, string>;
};

export { CARD_VARIANT_SELECT, cardProductSelect } from "@/lib/card-product-select";

function readAttributes(value: unknown): Record<string, string> | undefined {
  const out = readProductAttributes(value);
  return Object.keys(out).length > 0 ? out : undefined;
}

/// Las consultas de Prisma traen Decimal — la tarjeta espera números
/// planos. Con los precios de las variantes (si la consulta los trae) se
/// sabe si hay que decir "Desde"; con sus ids, la tarjeta puede dejar
/// elegir la variante.
export function toCardProduct(p: {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  price: unknown;
  compareAtPrice: unknown;
  stock: number | null;
  type: "PHYSICAL" | "SERVICE" | "DIGITAL";
  hasVariants?: boolean;
  optionNames?: string[];
  attributes?: unknown;
  variants?:
    | {
        id?: string;
        option1Value?: string | null;
        option2Value?: string | null;
        option3Value?: string | null;
        price: unknown;
        imageUrl?: string | null;
        stock?: number | null;
      }[]
    | null;
}): CardProduct {
  const price = Number(p.price);
  const range = priceRange(price, p.variants);
  const variants =
    p.variants && p.variants.every((v) => typeof v.id === "string")
      ? p.variants.map((v) => ({
          id: v.id!,
          option1Value: v.option1Value ?? null,
          option2Value: v.option2Value ?? null,
          option3Value: v.option3Value ?? null,
          price: v.price == null ? null : Number(v.price),
          imageUrl: v.imageUrl ?? null,
          stock: v.stock === undefined ? null : v.stock,
        }))
      : undefined;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: p.imageUrl,
    price: range.min,
    priceFrom: range.from,
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    stock: p.stock,
    type: p.type,
    ...(p.hasVariants && variants && variants.length > 0
      ? { hasVariants: true, optionNames: p.optionNames ?? [], variants }
      : {}),
    ...(readAttributes(p.attributes) ? { attributes: readAttributes(p.attributes) } : {}),
  };
}

/// Clases compartidas por los botones de las tarjetas (agregar al carrito,
/// ver producto) — rectangulares, de ancho completo y en mayúsculas, como
/// el botón de compra de Shopify que la marca tomó de referencia.
export const CARD_BUTTON_CLASS =
  "w-full px-3 py-3 text-xs font-bold uppercase tracking-wide";

/// Botón principal de la tarjeta (agregar al carrito): el "Color de
/// botones" de Diseño → Colores, con texto blanco o negro según contraste
/// (ver contrastTextFor en brand-theme.ts). Es el mismo color que usan
/// "Ir al pago", "Pagar" y el resto de botones de compra.
export const CARD_PRIMARY_BUTTON_CLASS =
  "bg-brand-button text-brand-button-text hover:opacity-90 disabled:opacity-40";

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
  from = false,
  className = "text-base",
}: {
  price: number;
  compareAtPrice: number | null;
  /// "Desde": el producto tiene variantes más caras que este precio.
  from?: boolean;
  className?: string;
}) {
  const onSale = discountPercent(price, compareAtPrice) != null;
  return (
    <p className={`${className} flex items-baseline gap-1.5 flex-wrap`}>
      {from && <span className="text-[0.75em] text-brand-ink-soft">Desde</span>}
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

/// La burbuja "20% OFF" sobre la foto, solo cuando hay oferta (ver
/// DiscountPill). Va dentro de un contenedor `relative`.
export function DiscountBadge({ price, compareAtPrice }: { price: number; compareAtPrice: number | null }) {
  const percent = discountPercent(price, compareAtPrice);
  if (percent == null) return null;
  return <DiscountPill percent={percent} />;
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
  const withVariants = Boolean(product.hasVariants && product.variants && product.variants.length > 0);
  const buttonClass = `${CARD_BUTTON_CLASS} ${CARD_PRIMARY_BUTTON_CLASS}`;
  return (
    <div className={`flex flex-col ${className}`}>
      <Link href={href} className="relative block bg-brand-accent-soft">
        <CardPhoto src={product.imageUrl} alt={product.name} sizes="(min-width: 1024px) 400px, (min-width: 640px) 25vw, 50vw" />
        <DiscountBadge price={product.price} compareAtPrice={product.compareAtPrice} />
        {!withVariants && product.stock != null && product.stock <= 0 && (
          // Agotado: el producto se sigue viendo (no se esconde), con la
          // etiqueta sobre la foto y el botón deshabilitado — como en
          // Shopify. Ver conversación del 2026-09-30.
          <span className="absolute bottom-2 left-2 bg-brand-ink text-brand-bg text-[11px] font-bold uppercase tracking-wide px-2 py-1">
            Agotado
          </span>
        )}
      </Link>
      <div className="pt-3 flex flex-col gap-1.5 flex-1">
        <Link href={href}>
          {product.type === "SERVICE" && (
            <p className="text-[10px] font-mono text-brand-accent mb-0.5">SERVICIO</p>
          )}
          {product.type === "DIGITAL" && (
            <p className="text-[10px] font-mono text-brand-accent mb-0.5">DIGITAL</p>
          )}
          <p className="text-sm font-semibold text-brand-ink leading-snug line-clamp-2">{product.name}</p>
        </Link>
        {withVariants ? (
          <CardVariantPicker product={product} basePath={basePath} buttonClassName={buttonClass} />
        ) : (
          <>
            <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} from={product.priceFrom} className="text-lg" />
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
                className={buttonClass}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
