"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LINE_SEPARATOR, lineProductName, suggestLineName } from "@/lib/product-lines";

/// Herramienta del administrador (solo con "Entrar como"): cambia de una vez
/// el comienzo del nombre de todos los productos de una línea — "Gel Polish
/// Blancos, Negros y Grises – SUPER BLACK" → "Gel Polish – Super Black".
/// Propone sola el nombre corto (ver suggestLineName) y muestra cada línea
/// con un ejemplo de antes y después: se revisa y se cambia (antes había
/// que escribirlo en cada línea y no se entendía — "no entiendo",
/// 2026-10-19). Ver product-lines-service.ts.

type Line = { line: string; count: number; samples: string[] };

export function ProductLinesTool() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [titleCase, setTitleCase] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch("/api/marca/tienda/productos/nombres");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo revisar.");
      // Primero las que tienen propuesta.
      const list = [...(body.lines as Line[])].sort((a, b) => Number(Boolean(suggestLineName(b.line))) - Number(Boolean(suggestLineName(a.line))));
      setLines(list);
      setNames(Object.fromEntries(list.map((l) => [l.line, suggestLineName(l.line) ?? l.line])));
      setChosen(Object.fromEntries(list.map((l) => [l.line, Boolean(suggestLineName(l.line))])));
      setEditing(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo revisar.");
    } finally {
      setBusy(false);
    }
  }

  const newLine = (l: Line) => (names[l.line] ?? l.line).trim() || l.line;
  const changes = (lines ?? []).filter((l) => chosen[l.line] && newLine(l).length >= 2);
  const total = changes.reduce((sum, l) => sum + l.count, 0);

  async function apply() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/productos/nombres", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes: changes.map((l) => ({ line: l.line, newLine: newLine(l) })), titleCase }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo cambiar.");
      setNotice(`Listo: ${body.renamed} productos con su nombre nuevo.`);
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
            Acorta de una vez el nombre de todos los productos de una línea: &quot;Gel Polish Verdes – ACELERADA&quot; queda &quot;Gel Polish –
            Acelerada&quot;. El link de cada producto y sus filtros quedan igual.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            load();
          }}
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
              <div className="rounded-lg bg-brand-accent-soft/50 px-3 py-2.5 text-sm text-brand-ink">
                {changes.length > 0
                  ? `Te proponemos cómo quedan ${changes.length === 1 ? "1 línea" : `${changes.length} líneas`} (${total} productos). Revisa los ejemplos y dale a “Cambiar”. Las que no quieras tocar, desmárcalas.`
                  : "Marca las líneas que quieres cambiar. Con “Editar” escribes cómo debe empezar el nombre."}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-brand-ink">
                  <input type="checkbox" checked={titleCase} onChange={(e) => setTitleCase(e.target.checked)} />
                  Referencia con mayúscula inicial (SUPER BLACK → Super Black)
                </label>
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy || total === 0}
                  className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Cambiando…" : total > 0 ? `Cambiar ${total} nombres` : "Cambiar"}
                </button>
              </div>
              <ul className="divide-y divide-brand-line rounded-lg border border-brand-line max-h-[30rem] overflow-y-auto">
                {lines.map((l) => {
                  const on = Boolean(chosen[l.line]);
                  const next = newLine(l);
                  const sample = l.samples[0] ?? "";
                  const after = lineProductName(next, sample, titleCase);
                  const same = after === `${l.line}${LINE_SEPARATOR}${sample}`;
                  return (
                    <li key={l.line} className={`p-3 ${on ? "" : "bg-brand-bg/60"}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => setChosen((prev) => ({ ...prev, [l.line]: e.target.checked }))}
                          aria-label={`Cambiar la línea ${l.line}`}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-brand-ink-soft min-w-0 break-words">
                              {l.line} · {l.count} productos
                            </p>
                            <button type="button" onClick={() => setEditing(editing === l.line ? null : l.line)} className="text-xs font-medium text-brand-accent hover:underline">
                              {editing === l.line ? "Listo" : "Editar"}
                            </button>
                          </div>
                          <p className="text-xs text-brand-ink-soft break-words">
                            <span className="inline-block w-16">Antes:</span>
                            {l.line}
                            {LINE_SEPARATOR}
                            {sample}
                          </p>
                          <p className={`text-sm break-words ${on && !same ? "font-medium text-brand-ink" : "text-brand-ink-soft"}`}>
                            <span className="inline-block w-16 text-xs font-normal text-brand-ink-soft">Después:</span>
                            {on ? (same ? "queda igual" : after) : "no se cambia"}
                          </p>
                          {editing === l.line && (
                            <div className="pt-1">
                              <label className="block text-xs text-brand-ink-soft mb-1">Cómo empieza el nombre (antes del –)</label>
                              <input
                                value={names[l.line] ?? l.line}
                                onChange={(e) => {
                                  setNames((prev) => ({ ...prev, [l.line]: e.target.value }));
                                  setChosen((prev) => ({ ...prev, [l.line]: true }));
                                }}
                                aria-label={`Nombre nuevo de la línea ${l.line}`}
                                className="input text-sm w-full"
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </div>
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
