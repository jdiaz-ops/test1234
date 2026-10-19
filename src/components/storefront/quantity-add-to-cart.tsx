"use client";

import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { useCart } from "@/components/storefront/cart-context";
import { usePurchaseQuantity } from "@/components/storefront/purchase-quantity";
import { CARD_BUTTON_CLASS, CARD_PRIMARY_BUTTON_CLASS } from "@/components/storefront/product-card";
import { cartLineKey } from "@/lib/storefront-cart";

type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  type?: "PHYSICAL" | "SERVICE" | "DIGITAL";
  variantId?: string | null;
  variantLabel?: string | null;
};

/// La fila de compra de la ficha de producto, como en Shopify: selector
/// de cantidad (− 1 +) en una caja con borde y, al lado, el botón
/// rectangular ancho "AGREGAR AL CARRITO" con el color de botones de la
/// marca (el mismo de las tarjetas). Ver conversación del 2026-09-30.
///
/// `floating` es la versión de la barra flotante: redonda como su botón
/// (pedido del 2026-10-19: "a la izquierda las unidades… −1+"). El
/// máximo es lo que todavía se puede agregar: el inventario menos lo que
/// ya está en el carrito.
export function QuantityAddToCart({
  product,
  disabled,
  disabledLabel,
  floating = false,
}: {
  product: Product;
  disabled?: boolean;
  /// Ver AddToCartButton.
  disabledLabel?: string;
  floating?: boolean;
}) {
  const [quantity, setQuantity] = usePurchaseQuantity();
  const { items } = useCart();
  const key = cartLineKey({ productId: product.id, variantId: product.variantId ?? null });
  const inCart = items.find((i) => cartLineKey(i) === key)?.quantity ?? 0;
  const soldOut = product.stock != null && product.stock <= 0;
  const max = product.stock != null ? Math.max(0, product.stock - inCart) : Infinity;
  const allInCart = !soldOut && max <= 0;
  const canBuy = !disabled && !soldOut && !allInCart;
  // Si el carrito cambió (o la variante) y ya no caben, se muestra lo que sí cabe.
  const shown = Math.max(1, Math.min(quantity, max));

  const cell = floating ? "w-9" : "w-11";
  return (
    <div className="flex items-stretch gap-3">
      <div
        className={`flex items-stretch border border-brand-line text-brand-ink shrink-0 ${floating ? "rounded-full" : ""} ${
          canBuy ? "" : "opacity-40"
        }`}
      >
        <button
          type="button"
          aria-label="Menos"
          onClick={() => setQuantity(Math.max(1, shown - 1))}
          disabled={!canBuy || shown <= 1}
          className={`${cell} flex items-center justify-center text-lg disabled:opacity-40 ${floating ? "" : "border-r border-brand-line"}`}
        >
          −
        </button>
        <span className={`${floating ? "w-7" : "w-12"} flex items-center justify-center text-sm font-mono`}>{shown}</span>
        <button
          type="button"
          aria-label="Más"
          onClick={() => setQuantity(Math.min(max, shown + 1))}
          disabled={!canBuy || shown >= max}
          className={`${cell} flex items-center justify-center text-lg disabled:opacity-40 ${floating ? "" : "border-l border-brand-line"}`}
        >
          +
        </button>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <AddToCartButton
          product={product}
          disabled={disabled || allInCart}
          disabledLabel={allInCart ? (inCart === 1 ? "Ya está en tu carrito" : `Ya tienes las ${inCart} en tu carrito`) : disabledLabel}
          quantity={shown}
          className={
            floating
              ? "w-full h-full rounded-full bg-brand-button text-brand-button-text px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
              : `${CARD_BUTTON_CLASS} ${CARD_PRIMARY_BUTTON_CLASS} h-full min-h-[48px]`
          }
        />
      </div>
    </div>
  );
}
