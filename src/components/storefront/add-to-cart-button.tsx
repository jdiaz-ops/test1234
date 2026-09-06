"use client";

import { useState } from "react";
import { useCart } from "@/components/storefront/cart-context";

type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number | null;
};

export function AddToCartButton({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const outOfStock = product.stock != null && product.stock <= 0;

  function handleClick() {
    if (outOfStock) return;
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={outOfStock}
      className={
        className ??
        "w-full bg-brand-accent text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
      }
    >
      {outOfStock ? "Agotado" : added ? "Agregado ✓" : "Agregar al carrito"}
    </button>
  );
}
