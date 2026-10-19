"use client";

import { StoreImage } from "@/components/storefront/store-image";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";

const FRAME_CLASS = { square: "aspect-square", portrait: "aspect-[4/5]" } as const;

/// La foto de la tarjeta de producto con la forma que eligió la marca en
/// Diseño → Listado de productos (theme.productListing.imageRatio): por
/// defecto cada foto con su forma, sin recortar; cuadrada o vertical
/// recortan lo que sobre para que las tarjetas queden parejas. Ver
/// conversación del 2026-10-19 ("las imágenes se cortan").
export function CardPhoto({ src, alt, sizes }: { src: string | null; alt: string; sizes: string }) {
  const { imageRatio } = useStorefrontTheme().productListing;
  if (imageRatio === "natural") {
    return src ? <StoreImage src={src} alt={alt} natural reserve={[1000, 1000]} sizes={sizes} /> : <div className="w-full aspect-square" />;
  }
  return (
    <div className={`relative w-full ${FRAME_CLASS[imageRatio]}`}>
      {src && <StoreImage src={src} alt={alt} className="object-cover" sizes={sizes} />}
    </div>
  );
}
