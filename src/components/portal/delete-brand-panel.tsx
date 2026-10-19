"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Preview = { brand: { id: string; name: string; slug: string | null }; blockers: string[]; willDelete: string[] };

/// Panel para borrar una marca desde Admin → Marcas (solo el Propietario).
/// Muestra qué se borra o por qué no se puede, y pide escribir el nombre
/// de la marca para confirmar. Ver admin-brand-delete-service.ts.
export function DeleteBrandPanel({ brandId, onClose }: { brandId: string; onClose: () => void }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/marcas/borrar?brandId=${encodeURIComponent(brandId)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) setError(body?.error ?? "No se pudo revisar la marca.");
        else setPreview(body as Preview);
      })
      .catch(() => alive && setError("No se pudo revisar la marca."));
    return () => {
      alive = false;
    };
  }, [brandId]);

  const matches = preview ? name.replace(/\s+/g, " ").trim().toLowerCase() === preview.brand.name.replace(/\s+/g, " ").trim().toLowerCase() : false;

  async function confirm() {
    if (!preview || !matches) return;
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/admin/marcas/borrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, confirmName: name }),
    });
    const body = await res.json().catch(() => null);
    setDeleting(false);
    if (!res.ok) {
      setError(body?.error ?? "No se pudo borrar la marca.");
      return;
    }
    onClose();
    router.refresh();
  }

  if (error && !preview) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error}{" "}
        <button type="button" onClick={onClose} className="text-xs text-brand-ink-soft hover:underline ml-2">
          Cerrar
        </button>
      </div>
    );
  }
  if (!preview) return <p className="text-xs text-brand-ink-soft">Revisando la marca…</p>;

  if (preview.blockers.length > 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
        <p className="font-medium">{preview.brand.name} no se puede borrar porque tiene historial de plata:</p>
        <ul className="list-disc pl-5">
          {preview.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p>Esos registros se guardan por ley. Si quieres sacarla de la plataforma, usa «Pausar».</p>
        <button type="button" onClick={onClose} className="text-xs text-brand-ink-soft hover:underline">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 space-y-3">
      <p className="font-medium">
        Se va a borrar {preview.brand.name}
        {preview.brand.slug ? ` y su tienda ${preview.brand.slug}.marcolini.lat` : ""} con todo lo suyo. No se puede deshacer.
      </p>
      <ul className="list-disc pl-5 text-red-800">
        {preview.willDelete.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <label className="block text-xs text-red-800">
        Para confirmar, escribe el nombre de la marca: <strong>{preview.brand.name}</strong>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input text-sm mt-1 w-full max-w-sm"
          autoComplete="off"
          aria-label="Nombre de la marca para confirmar"
        />
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={confirm}
          disabled={!matches || deleting}
          className="bg-red-700 text-white text-xs font-medium rounded-full px-4 py-2 disabled:opacity-40"
        >
          {deleting ? "Borrando…" : "Borrar marca para siempre"}
        </button>
        <button type="button" onClick={onClose} disabled={deleting} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
