"use client";

import { useState } from "react";
import { useCart } from "@/components/storefront/cart-context";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";

type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  type?: "PHYSICAL" | "SERVICE" | "DIGITAL";
  /// Solo cuando el producto tiene variantes — ver variant-picker.tsx, que
  /// es quien calcula cuál está seleccionada.
  variantId?: string | null;
  variantLabel?: string | null;
};

export function AddToCartButton({
  product,
  className,
  disabled,
}: {
  product: Product;
  className?: string;
  /// Ej. producto con variantes y todavía no elige ninguna combinación
  /// completa.
  disabled?: boolean;
  /// Ya no hace falta para theme.cart.quickCart.actionOnAdd = "openCart"
  /// (ahora abre el drawer del carrito en vez de navegar) — se deja en
  /// el tipo sin desestructurar para no tener que tocar cada lugar que
  /// todavía lo manda.
  basePath?: string;
}) {
  const { addItem, openDrawer } = useCart();
  const { cart } = useStorefrontTheme();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isService = product.type === "SERVICE";
  const outOfStock = product.stock != null && product.stock <= 0;

  function handleClick() {
    if (outOfStock || disabled) return;
    const result = addItem({
      productId: product.id,
      variantId: product.variantId ?? null,
      variantLabel: product.variantLabel ?? null,
      slug: product.slug,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
      type: product.type ?? "PHYSICAL",
    });
    if (!result.ok) {
      setError(result.error);
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (cart.quickCart.enabled && cart.quickCart.actionOnAdd === "openCart") {
      openDrawer();
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={outOfStock || disabled}
        className={
          className ??
          "w-full bg-brand-accent text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
        }
      >
        {outOfStock
          ? isService
            ? "Sin cupos"
            : "Agotado"
          : added
            ? "Agregado ✓"
            : isService
              ? "Reservar"
              : "Agregar al carrito"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
