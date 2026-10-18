"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  countExternalImages,
  rehostAllImages,
  type RehostProgress,
  type RehostSummary,
} from "@/lib/rehost-images-client";

/// Aviso en Mi tienda → Productos cuando hay fotos que todavía viven en
/// otro servidor (las importadas de Shopify quedan enlazadas a
/// cdn.shopify.com): un botón las copia a Marcolini (ver
/// image-rehost-service.ts). Para las tiendas que se importaron antes de
/// que el importador lo hiciera solo. Ver conversación del 2026-10-18.
export function RehostImagesNotice() {
  const router = useRouter();
  const [total, setTotal] = useState<number | null>(null);
  const [progress, setProgress] = useState<RehostProgress | null>(null);
  const [summary, setSummary] = useState<RehostSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    countExternalImages()
      .then((n) => {
        if (alive) setTotal(n);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!total && !summary) return null;

  async function run() {
    setError(null);
    setSummary(null);
    try {
      const result = await rehostAllImages(setProgress);
      setSummary(result);
      setTotal(result.failed.length);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar las fotos.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      {summary ? (
        <>
          <p className="text-sm text-amber-900">
            Listo: {summary.saved} {summary.saved === 1 ? "foto guardada" : "fotos guardadas"} en Marcolini.
            {summary.failed.length > 0 &&
              ` ${summary.failed.length} no se pudieron copiar (ya no existen en Shopify o no son imágenes): esos productos quedaron sin esa foto, súbela desde Editar.`}
          </p>
          {summary.failed.length > 0 && (
            <ul className="text-xs text-amber-800 list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
              {summary.failed.slice(0, 10).map((f) => (
                <li key={f.url} className="truncate">
                  {f.url}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : progress ? (
        <p className="text-sm text-amber-900">
          Guardando las fotos en Marcolini… {progress.done} de {progress.total}. No cierres esta página.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-900">
            {total === 1
              ? "1 foto de tu catálogo todavía está en el servidor de Shopify."
              : `${total} fotos de tu catálogo todavía están en el servidor de Shopify.`}{" "}
            Si esa tienda se cierra, desaparecen. Guárdalas en Marcolini para que nada se rompa.
          </p>
          <button
            type="button"
            onClick={run}
            className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90"
          >
            Guardar las fotos en Marcolini
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
