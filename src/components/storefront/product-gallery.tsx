"use client";

import { useState } from "react";
import { StoreImage } from "@/components/storefront/store-image";

/// Galería simple: foto grande + tira de miniaturas debajo (clic para
/// cambiar la principal). Con una sola foto (o ninguna) se ve igual que
/// antes, sin miniaturas.
export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="w-full aspect-square bg-brand-accent-soft rounded-2xl" />;
  }

  // En celular: foto grande y la tira de miniaturas debajo, deslizable de
  // lado (un producto importado de Shopify puede traer 20+ fotos y sin
  // esto la fila empujaba el ancho de toda la página). En computador las
  // miniaturas van en columna a la izquierda de la foto, como en la
  // tienda Shopify de referencia. Ver conversación del 2026-09-30.
  return (
    <div className="min-w-0 flex flex-col sm:flex-row-reverse gap-3">
      <div className="flex-1 min-w-0">
        <div className="relative w-full aspect-square bg-brand-surface">
          <StoreImage
            key={images[active] ?? images[0]}
            src={images[active] ?? images[0]}
            alt={alt}
            className="object-contain"
            sizes="(min-width: 640px) 45vw, 100vw"
            priority={active === 0}
          />
        </div>
      </div>
      {images.length > 1 && (
        <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-x-visible sm:overflow-y-auto sm:max-h-[640px] pb-1 sm:pb-0 sm:pr-1 shrink-0">
          {images.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={() => setActive(idx)}
              className={`w-14 h-14 shrink-0 overflow-hidden border ${
                idx === active ? "border-brand-ink" : "border-brand-line"
              }`}
            >
              <span className="relative block w-full h-full">
                <StoreImage src={url} alt="" className="object-cover" sizes="56px" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
