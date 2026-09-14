"use client";

import { useState } from "react";

/// Galería del formulario de producto — subir varias fotos (antes solo
/// dejaba una), reordenar (la primera es la portada) y quitar. Reusa el
/// mismo endpoint de subida que ya existía, una llamada por archivo.
export function ProductImageUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/marca/tienda/productos/imagen", {
          method: "POST",
          body: form,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error ?? "No se pudo subir una de las imágenes.");
          continue;
        }
        uploaded.push(body.url);
      }
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
    } catch {
      setError("No se pudo subir — revisa tu conexión.");
    } finally {
      setUploading(false);
    }
  }

  function remove(idx: number) {
    onChange(images.filter((_, i) => i !== idx));
  }

  function makeCover(idx: number) {
    if (idx === 0) return;
    const next = [...images];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    onChange(next);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((url, idx) => (
          <div key={url + idx} className="relative w-20 h-20 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto estática subida por la marca */}
            <img
              src={url}
              alt=""
              className={`w-20 h-20 rounded-lg object-cover border-2 ${
                idx === 0 ? "border-brand-accent" : "border-brand-line"
              }`}
            />
            {idx === 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-brand-accent text-white text-[9px] font-mono font-medium rounded-full px-1.5 py-0.5">
                PORTADA
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(idx)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-ink text-white text-xs leading-none flex items-center justify-center"
              aria-label="Quitar imagen"
            >
              ×
            </button>
            {idx !== 0 && (
              <button
                type="button"
                onClick={() => makeCover(idx)}
                className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] py-0.5 rounded-b-lg"
              >
                Usar como portada
              </button>
            )}
          </div>
        ))}
        <label className="w-20 h-20 shrink-0 rounded-lg border border-dashed border-brand-line flex items-center justify-center text-xs text-brand-ink-soft cursor-pointer hover:bg-brand-accent-soft text-center px-1">
          {uploading ? "Subiendo..." : "+ Agregar"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
