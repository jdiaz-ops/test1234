"use client";

import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";

/// La burbuja de descuento sobre la foto ("20% OFF"), arriba a la
/// izquierda y del color de los botones, como en la tienda Shopify de
/// Beauty Solution. Antes era un "-20%" suelto en la esquina derecha que se
/// perdía encima de las fotos (pedido del 2026-10-19: "no le aparece en la
/// imagen una burbuja"). El texto sale de Diseño → Página de colecciones.
/// Va dentro de un contenedor `relative`.
export function DiscountPill({ percent }: { percent: number }) {
  const { discountBadge } = useStorefrontTheme().productListing;
  if (discountBadge === "hidden") return null;
  return (
    <span className="absolute top-2 left-2 z-[1] rounded-full bg-brand-button text-brand-button-text px-2.5 py-1 text-[11px] sm:text-xs font-bold leading-none shadow-sm">
      {discountBadge === "minus" ? `-${percent}%` : `${percent}% OFF`}
    </span>
  );
}
