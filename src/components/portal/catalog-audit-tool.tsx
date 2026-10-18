"use client";

import { useState } from "react";

/// Herramienta del administrador (solo con "Entrar como"): el diagnóstico
/// del catálogo, sección por sección, como lista de trabajo para dejarle
/// la tienda bien armada a una marca. Ver catalog-audit-service.ts.

type Audit = {
  products: number;
  collections: number;
  sections: { key: string; title: string; why: string; count: number; items: { id: string; name: string; slug: string | null; note?: string }[] }[];
};

export function CatalogAuditTool({ storeUrl }: { storeUrl?: string | null }) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/diagnostico");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo revisar.");
      setAudit(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revisar.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const pending = audit?.sections.filter((s) => s.count > 0) ?? [];
  const clean = audit?.sections.filter((s) => s.count === 0) ?? [];

  return (
    <div className="rounded-xl border border-dashed border-brand-line p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-brand-ink">
            Diagnóstico del catálogo <span className="text-xs font-normal text-brand-ink-soft">(solo admin)</span>
          </p>
          <p className="text-xs text-brand-ink-soft">
            Qué hay que arreglar para que la tienda se vea bien armada: descripciones, fotos, agotados, pesos, colecciones, nombres y familias.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
        >
          {busy ? "Revisando…" : audit ? "Revisar otra vez" : "Revisar catálogo"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {audit && (
        <div className="space-y-2">
          <p className="text-sm text-brand-ink-soft">
            {audit.products} productos · {audit.collections} colecciones · {pending.length} puntos por revisar
            {clean.length > 0 ? ` · en orden: ${clean.map((s) => s.title.toLowerCase()).join(", ")}` : ""}
          </p>
          <ul className="space-y-2">
            {pending.map((s) => (
              <li key={s.key} className="rounded-lg border border-brand-line">
                <button type="button" onClick={() => toggle(s.key)} className="w-full text-left px-3 py-2 flex items-start justify-between gap-3">
                  <span>
                    <span className="text-sm font-medium text-brand-ink">
                      {s.title} <span className="font-mono text-xs text-brand-accent">{s.count}</span>
                    </span>
                    <span className="block text-xs text-brand-ink-soft">{s.why}</span>
                  </span>
                  <span className="text-brand-ink-soft text-sm shrink-0">{open.has(s.key) ? "−" : "+"}</span>
                </button>
                {open.has(s.key) && (
                  <ul className="border-t border-brand-line px-3 py-2 text-xs text-brand-ink-soft space-y-0.5 max-h-72 overflow-y-auto">
                    {s.items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-2">
                        <span>
                          {it.name}
                          {it.note ? <span className="text-brand-ink-soft/70"> · {it.note}</span> : null}
                        </span>
                        {storeUrl && it.slug && !s.key.startsWith("collections") && s.key !== "small-collections" && s.key !== "drafts" && (
                          <a href={`${storeUrl}/${it.slug}`} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline shrink-0">
                            Ver
                          </a>
                        )}
                      </li>
                    ))}
                    {s.count > s.items.length && <li>… y {s.count - s.items.length} más</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
