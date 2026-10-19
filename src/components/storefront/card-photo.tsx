"use client";

import { StoreImage } from "@/components/storefront/store-image";
import { useStorefrontTheme } from "@/components/storefront/storefront-theme-context";

const FRAME_CLASS = { square: "aspect-square", portrait: "aspect-[4/5]" } as const;

/// La foto de la tarjeta de producto, con la misma forma en todas las
/// tarjetas: la que eligió la marca en Diseño → Página de colecciones, o
/// en "Automática" la que más usan sus fotos (el layout de la tienda ya la
/// trae resuelta, ver photo-shape-service.ts). Lo que sobre de una foto de
/// otra forma se recorta parejo, centrado. Ver conversación del
/// 2026-10-19 ("las imágenes se cortan" / "esto no podemos tener").
export function CardPhoto({ src, alt, sizes }: { src: string | null; alt: string; sizes: string }) {
  const { imageRatio } = useStorefrontTheme().productListing;
  const frame = imageRatio === "portrait" ? FRAME_CLASS.portrait : FRAME_CLASS.square;
  return (
    <div className={`relative w-full ${frame}`}>
      {src && <StoreImage src={src} alt={alt} className="object-cover" sizes={sizes} />}
    </div>
  );
}
