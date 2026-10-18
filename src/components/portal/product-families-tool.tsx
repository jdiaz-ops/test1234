"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Herramienta del administrador (solo con "Entrar como"): revisa y aplica
/// las familias de productos — los que son el mismo en otro aroma, tono o
/// tamaño — para que la página de cada uno ofrezca los demás. Ver
/// product-family-service.ts y conversación del 2026-10-18.

type Preview = {
  total: number;
  grouped: number;
  skipped: number;
  families: { group: string; axes: string[]; how: string; members: { id: string; name: string; attrs: Record<string, string>; already: boolean }[] }[];
  updates: { id: string }[];
};

export function ProductFamiliesTool() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/familias");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo revisar.");
      setPreview(body);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo revisar.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/familias", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo aplicar.");
      setNotice(`Listo: ${body.products} productos agrupados en ${body.families} familias.`);
      await load();
      router.refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo aplicar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-brand-line p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-brand-ink">
            Familias: otros aromas, tonos y tamaños <span className="text-xs font-normal text-brand-ink-soft">(solo admin)</span>
          </p>
          <p className="text-xs text-brand-ink-soft">
            Agrupa por el nombre los productos que son el mismo en otro aroma, tono o tamaño, para que la página de cada uno ofrezca los
            demás. Se arma sola al importar; acá la revisas y la aplicas a lo que ya estaba.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
        >
          {busy ? "Un momento…" : "Revisar familias"}
        </button>
      </div>
      {notice && <p className="text-sm text-brand-ink">{notice}</p>}
      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-ink-soft">
              {preview.total} productos · {preview.grouped} ya agrupados · {preview.families.length} familias · {preview.updates.length} por agrupar
              {preview.skipped > 0 ? ` · ${preview.skipped} familias no se tocan (ya tienen grupos distintos)` : ""}
            </p>
            {preview.updates.length > 0 && (
              <button
                type="button"
                onClick={apply}
                disabled={busy}
                className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                Aplicar a {preview.updates.length} productos
              </button>
            )}
          </div>
          {preview.families.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">No se reconocen familias por los nombres de estos productos.</p>
          ) : (
            <ul className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
              {preview.families.map((f) => (
                <li key={`${f.group}-${f.how}-${f.members[0]?.id}`} className="rounded-lg border border-brand-line p-3">
                  <p className="text-sm font-medium text-brand-ink">
                    {f.group} <span className="text-xs font-normal text-brand-ink-soft">· {f.axes.join(" + ")} · {f.members.length} productos</span>
                  </p>
                  <ul className="mt-1 text-xs text-brand-ink-soft space-y-0.5">
                    {f.members.map((m) => (
                      <li key={m.id}>
                        {m.name} →{" "}
                        {Object.entries(m.attrs)
                          .filter(([k]) => k !== "Grupo")
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                        {m.already ? " (ya estaba)" : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
