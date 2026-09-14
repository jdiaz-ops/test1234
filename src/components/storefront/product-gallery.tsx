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

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto subida por la marca */}
      <img
        src={images[active] ?? images[0]}
        alt={alt}
        className="w-full aspect-square object-cover rounded-2xl border border-brand-line"
      />
      {images.length > 1 && (
        <div className="flex gap-2 mt-3">
          {images.map((url, idx) => (
            <button
              key={url + idx}
              type="button"
              onClick={() => setActive(idx)}
              className={`w-14 h-14 rounded-lg overflow-hidden border ${
                idx === active ? "border-brand-accent" : "border-brand-line"
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
