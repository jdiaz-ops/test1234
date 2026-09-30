"use client";

import { useState } from "react";
import { AddToCartButton } from "@/components/storefront/add-to-cart-button";
import { CARD_BUTTON_CLASS, CARD_PRIMARY_BUTTON_CLASS } from "@/components/storefront/product-card";

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
export function QuantityAddToCart({
  product,
  disabled,
}: {
  product: Product;
  disabled?: boolean;
}) {
  const [quantity, setQuantity] = useState(1);
  const max = product.stock != null && product.stock > 0 ? product.stock : Infinity;
  const canBuy = !disabled && !(product.stock != null && product.stock <= 0);

  return (
    <div className="flex items-stretch gap-3">
      <div
        className={`flex items-stretch border border-brand-line text-brand-ink shrink-0 ${
          canBuy ? "" : "opacity-40"
        }`}
      >
        <button
          type="button"
          aria-label="Menos"
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={!canBuy || quantity <= 1}
          className="w-11 flex items-center justify-center text-lg border-r border-brand-line disabled:opacity-40"
        >
          −
        </button>
        <span className="w-12 flex items-center justify-center text-sm font-mono">{quantity}</span>
        <button
          type="button"
          aria-label="Más"
          onClick={() => setQuantity((q) => Math.min(max, q + 1))}
          disabled={!canBuy || quantity >= max}
          className="w-11 flex items-center justify-center text-lg border-l border-brand-line disabled:opacity-40"
        >
          +
        </button>
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <AddToCartButton
          product={product}
          disabled={disabled}
          quantity={quantity}
          className={`${CARD_BUTTON_CLASS} ${CARD_PRIMARY_BUTTON_CLASS} h-full min-h-[48px]`}
        />
      </div>
    </div>
  );
}
