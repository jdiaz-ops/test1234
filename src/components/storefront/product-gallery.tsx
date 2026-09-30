"use client";

import { useState } from "react";

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
        {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca */}
        <img
          src={images[active] ?? images[0]}
          alt={alt}
          className="w-full aspect-square object-contain bg-brand-surface"
        />
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
              {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
