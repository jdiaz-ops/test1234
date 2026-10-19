"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lineProductName } from "@/lib/product-lines";

/// Herramienta del administrador (solo con "Entrar como"): cambia de una vez
/// el comienzo del nombre de todos los productos de una línea — "Gel Polish
/// Blancos, Negros y Grises – SUPER BLACK" → "Gel Polish – SUPER BLACK".
/// Ver product-lines-service.ts y conversación del 2026-10-19.

type Line = { line: string; count: number; samples: string[] };

export function ProductLinesTool() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [titleCase, setTitleCase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/nombres");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo revisar.");
      setLines(body.lines);
      setNames(Object.fromEntries((body.lines as Line[]).map((l) => [l.line, l.line])));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo revisar.");
    } finally {
      setBusy(false);
    }
  }

  const changes = (lines ?? []).filter((l) => {
    const next = (names[l.line] ?? l.line).trim();
    return next.length >= 2 && (next !== l.line || titleCase);
  });
  const total = changes.reduce((sum, l) => sum + l.count, 0);

  async function apply() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/nombres", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes: changes.map((l) => ({ line: l.line, newLine: names[l.line] ?? l.line })), titleCase }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo cambiar.");
      setNotice(`Listo: ${body.renamed} productos con su nombre nuevo.`);
      setTitleCase(false);
      await load();
      router.refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo cambiar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-brand-line p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-brand-ink">
            Nombres por línea <span className="text-xs font-normal text-brand-ink-soft">(solo admin)</span>
          </p>
          <p className="text-xs text-brand-ink-soft">
            Cambia de una vez el comienzo del nombre de todos los productos de una línea: &quot;Gel Polish Blancos, Negros y Grises – SUPER
            BLACK&quot; → &quot;Gel Polish – SUPER BLACK&quot;. El link de cada producto y sus filtros quedan igual.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
        >
          {busy && !lines ? "Un momento…" : lines ? "Volver a cargar" : "Revisar nombres"}
        </button>
      </div>
      {notice && <p className="text-sm text-brand-ink">{notice}</p>}
      {lines && (
        <div className="space-y-3">
          {lines.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">No hay productos con nombres del tipo &quot;Línea – Referencia&quot;.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-brand-ink">
                  <input type="checkbox" checked={titleCase} onChange={(e) => setTitleCase(e.target.checked)} />
                  Referencia con mayúscula inicial (SUPER BLACK → Super Black)
                </label>
                {total > 0 && (
                  <button
                    type="button"
                    onClick={apply}
                    disabled={busy}
                    className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? "Cambiando…" : `Cambiar ${total} nombres`}
                  </button>
                )}
              </div>
              <ul className="divide-y divide-brand-line rounded-lg border border-brand-line max-h-[30rem] overflow-y-auto">
                {lines.map((l) => {
                  const value = names[l.line] ?? l.line;
                  const changed = value.trim() !== l.line || titleCase;
                  return (
                    <li key={l.line} className="p-3 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-brand-ink-soft min-w-0 break-words">
                          {l.line} · {l.count} productos
                        </p>
                        {value !== l.line && (
                          <button type="button" onClick={() => setNames((prev) => ({ ...prev, [l.line]: l.line }))} className="text-xs text-brand-ink-soft hover:underline">
                            Dejar como estaba
                          </button>
                        )}
                      </div>
                      <input
                        value={value}
                        onChange={(e) => setNames((prev) => ({ ...prev, [l.line]: e.target.value }))}
                        aria-label={`Nombre nuevo de la línea ${l.line}`}
                        className="input text-sm w-full"
                      />
                      <p className={`text-xs ${changed ? "text-brand-ink" : "text-brand-ink-soft"}`}>
                        {changed ? "Quedará: " : "Así se ve: "}
                        {l.samples.map((rest) => lineProductName(value.trim() || l.line, rest, titleCase)).join(" · ")}
                        {l.count > l.samples.length ? " · …" : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
