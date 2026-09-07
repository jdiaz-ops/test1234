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
  type?: "PHYSICAL" | "SERVICE";
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
  const [error, setError] = useState<string | null>(null);

  const isService = product.type === "SERVICE";
  const outOfStock = product.stock != null && product.stock <= 0;

  function handleClick() {
    if (outOfStock) return;
    const result = addItem({
      productId: product.id,
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
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={outOfStock}
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
