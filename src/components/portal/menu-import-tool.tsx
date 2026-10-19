"use client";

import { useState } from "react";

/// Diseño → Menú, solo admin con "Entrar como": lee el menú de la tienda
/// original (sin tocar productos ni nada más), muestra qué quedaría y lo
/// reemplaza. Ver storefront-menu-import-service.ts.

type Item = { label: string; url: string; children: Item[] };
type Preview = { storeUrl: string; read: number; items: Item[]; dropped: { label: string; href: string }[]; current: number; applied?: { items: number; replaced: boolean } };

function countItems(items: Item[]): number {
  return items.reduce((n, i) => n + 1 + countItems(i.children), 0);
}

function Tree({ items, depth }: { items: Item[]; depth: number }) {
  return (
    <ul className={depth > 0 ? "ml-4 border-l border-brand-line pl-3 space-y-0.5" : "space-y-0.5"}>
      {items.map((item, i) => (
        <li key={`${depth}-${i}-${item.label}`} className="text-xs text-brand-ink">
          <span className={depth === 0 ? "font-medium" : ""}>{item.label}</span>{" "}
          <span className="font-mono text-[11px] text-brand-ink-soft">{item.url === "#" ? "(solo abre el submenú)" : item.url}</span>
          {item.children.length > 0 && <Tree items={item.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export function MenuImportTool({ defaultUrl, onApplied }: { defaultUrl: string; onApplied: () => Promise<void> | void }) {
  const [url, setUrl] = useState(defaultUrl);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"read" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function call(apply: boolean) {
    setBusy(apply ? "apply" : "read");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/menu/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, apply }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo leer el menú.");
      setPreview(body);
      if (apply) {
        setNotice(`Listo: el menú quedó con ${body.applied.items} ítems${body.applied.replaced ? " (reemplazó el anterior)" : ""}.`);
        await onApplied();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el menú.");
    } finally {
      setBusy(null);
    }
  }

  const total = preview ? countItems(preview.items) : 0;

  return (
    <div className="rounded-xl border border-dashed border-brand-line p-4 mb-4 space-y-3">
      <div className="max-w-xl">
        <p className="text-sm font-medium text-brand-ink">
          Traer el menú de la tienda original <span className="text-xs font-normal text-brand-ink-soft">(solo admin)</span>
        </p>
        <p className="text-xs text-brand-ink-soft">
          Lee solo el menú de la tienda vieja, con sus submenús, y lo apunta a las colecciones, productos y páginas que ya están en
          Marcolini. No toca productos ni nada más. Reemplaza el menú actual.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tienda.com"
          className="input text-sm flex-1 min-w-[16rem]"
        />
        <button
          type="button"
          onClick={() => call(false)}
          disabled={busy !== null || url.trim().length < 4}
          className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
        >
          {busy === "read" ? "Leyendo…" : "Leer menú"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}
      {preview && (
        <div className="space-y-3">
          <p className="text-sm text-brand-ink-soft">
            {preview.read} links en el menú de {preview.storeUrl.replace(/^https?:\/\//, "")} · {total} quedarían en Marcolini · hoy hay{" "}
            {preview.current}
            {preview.dropped.length > 0 ? ` · ${preview.dropped.length} sin equivalente` : ""}
          </p>
          {preview.items.length > 0 ? (
            <div className="max-h-80 overflow-y-auto rounded-lg border border-brand-line p-3">
              <Tree items={preview.items} depth={0} />
            </div>
          ) : (
            <p className="text-sm text-red-600">No se encontró un menú con links que existan en Marcolini.</p>
          )}
          {preview.dropped.length > 0 && (
            <details className="text-xs text-brand-ink-soft">
              <summary className="cursor-pointer">Sin equivalente en Marcolini ({preview.dropped.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {preview.dropped.map((d, i) => (
                  <li key={`${i}-${d.href}`}>
                    {d.label} <span className="font-mono text-[11px]">{d.href}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {preview.items.length > 0 && !preview.applied && (
            <button
              type="button"
              onClick={() => call(true)}
              disabled={busy !== null}
              className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy === "apply" ? "Reemplazando…" : `Reemplazar el menú con estos ${total} ítems`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
