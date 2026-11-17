"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InventoryPreview, InventoryPreviewLine } from "@/server/services/inventory-file-service";

const pesos = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Activo", DRAFT: "Borrador", UNLISTED: "Oculto" };

type ApplyResult = { updated: number; published: number; failed: { name: string; error: string }[] };

/// Actualizar inventario y precio de promoción con el archivo de la marca
/// (CSV o Excel). Primero muestra qué va a cambiar en cada producto y las
/// novedades (no existe, borrador, varios coinciden…); aplica cuando la
/// marca confirma. Solo H la Cosedora. Ver inventory-file-service.ts.
export function InventoryFileUpdater() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<InventoryPreview | null>(null);
  const [choices, setChoices] = useState<Record<number, string>>({});
  const [publishDrafts, setPublishDrafts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);

  async function send(next: { file: File; choices: Record<number, string>; publishDrafts: boolean; apply?: boolean }) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", next.file);
    form.set("choices", JSON.stringify(next.choices));
    if (next.publishDrafts) form.set("publishDrafts", "1");
    if (next.apply) form.set("apply", "1");
    try {
      const res = await fetch("/api/marca/tienda/productos/inventario-archivo", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "No se pudo leer el archivo.");
        return;
      }
      if (next.apply) {
        setResult(body.result);
        setPreview(null);
        router.refresh();
      } else {
        setPreview(body.preview);
      }
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function pickFile(picked: File | null) {
    if (!picked) return;
    setFile(picked);
    setChoices({});
    setResult(null);
    void send({ file: picked, choices: {}, publishDrafts });
  }

  function choose(line: number, productId: string) {
    const next = { ...choices, [line]: productId };
    setChoices(next);
    if (file) void send({ file, choices: next, publishDrafts });
  }

  function togglePublish(value: boolean) {
    setPublishDrafts(value);
    if (file) void send({ file, choices, publishDrafts: value });
  }

  function reset() {
    setOpen(false);
    setFile(null);
    setPreview(null);
    setChoices({});
    setPublishDrafts(false);
    setError(null);
    setResult(null);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-brand-line rounded-full px-4 py-2 text-sm text-brand-ink hover:bg-brand-accent-soft"
      >
        Actualizar inventario con un archivo
      </button>
    );
  }

  const changes = preview?.lines.filter((l) => l.willChange).length ?? 0;
  const withNotes = preview?.lines.filter((l) => l.notes.length > 0).length ?? 0;
  const hasDrafts = preview?.lines.some((l) => l.product?.status === "DRAFT") ?? false;

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-brand-ink">Actualizar inventario y precios de promoción con un archivo</p>
        {!busy && (
          <button type="button" onClick={reset} className="text-xs text-brand-ink-soft hover:underline">
            Cerrar
          </button>
        )}
      </div>

      {result ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-brand-ink">
            Listo: {result.updated} {result.updated === 1 ? "producto actualizado" : "productos actualizados"}
            {result.published > 0 ? `, ${result.published} ${result.published === 1 ? "publicado" : "publicados"}` : ""}.
          </p>
          {result.failed.map((f) => (
            <p key={f.name} className="text-xs text-red-600">
              {f.name}: {f.error}
            </p>
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-brand-ink-soft">
            Sube el Excel (.xlsx) o CSV con una columna <strong>Producto</strong> y otra de <strong>Unidades</strong> y/o{" "}
            <strong>Precio en oferta</strong>. Antes de cambiar nada te mostramos qué va a pasar con cada producto. El precio en
            oferta queda como precio de promoción: el normal se ve tachado.
          </p>
          <label className="block rounded-xl border border-dashed border-brand-line px-4 py-6 text-center text-sm text-brand-ink-soft cursor-pointer hover:bg-brand-accent-soft">
            {file ? <span className="text-brand-ink">{file.name}</span> : "Elige el archivo"}
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {busy && <p className="text-xs text-brand-ink-soft">Revisando el archivo...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {preview && (
            <div className="space-y-4">
              <p className="text-sm text-brand-ink">
                <strong>{changes}</strong> {changes === 1 ? "producto cambia" : "productos cambian"} · <strong>{withNotes}</strong>{" "}
                {withNotes === 1 ? "fila con novedad" : "filas con novedad"} · {preview.lines.length} filas en el archivo
              </p>
              <ul className="divide-y divide-brand-line rounded-xl border border-brand-line bg-brand-bg px-4">
                {preview.lines.map((line) => (
                  <PreviewRow key={line.line} line={line} disabled={busy} onChoose={(id) => choose(line.line, id)} />
                ))}
              </ul>

              {preview.notInFile.length > 0 && (
                <details className="rounded-xl border border-brand-line px-4 py-3 text-sm">
                  <summary className="cursor-pointer text-brand-ink">
                    {preview.notInFile.length} {preview.notInFile.length === 1 ? "producto de la tienda no está" : "productos de la tienda no están"} en el
                    archivo (no se tocan)
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-brand-ink-soft">
                    {preview.notInFile.map((p) => (
                      <li key={p.id}>
                        {p.name}
                        {p.status !== "ACTIVE" ? ` · ${STATUS_LABEL[p.status]}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {hasDrafts && (
                <label className="flex items-start gap-2 text-sm text-brand-ink">
                  <input
                    type="checkbox"
                    checked={publishDrafts}
                    disabled={busy}
                    onChange={(e) => togglePublish(e.target.checked)}
                    className="mt-0.5"
                  />
                  Publicar también los que están en borrador
                </label>
              )}

              <button
                type="button"
                disabled={busy || changes === 0 || !file}
                onClick={() => file && send({ file, choices, publishDrafts, apply: true })}
                className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Un momento..." : changes === 0 ? "No hay cambios para aplicar" : `Aplicar ${changes} ${changes === 1 ? "cambio" : "cambios"}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PreviewRow({ line, disabled, onChoose }: { line: InventoryPreviewLine; disabled: boolean; onChoose: (productId: string) => void }) {
  return (
    <li className="py-3 text-sm space-y-1">
      <p className="text-brand-ink">
        <span className="font-medium">{line.name}</span>
        {line.product && <span className="text-brand-ink-soft"> → {line.product.name}</span>}
        <span className="ml-2 text-[11px] text-brand-ink-soft">fila {line.line}</span>
      </p>
      {line.candidates.length > 0 && (
        <select value="" disabled={disabled} onChange={(e) => onChoose(e.target.value)} className="input text-sm">
          <option value="" disabled>
            Elige el producto...
          </option>
          {line.candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status !== "ACTIVE" ? ` (${STATUS_LABEL[c.status]})` : ""}
            </option>
          ))}
        </select>
      )}
      {line.stock && (
        <p className="text-xs text-brand-ink tabular-nums">
          Unidades: {line.stock.from ?? "sin control"} → <strong>{line.stock.to}</strong>
        </p>
      )}
      {line.price && (
        <p className="text-xs text-brand-ink tabular-nums">
          Precio de promoción: {line.price.promoFrom != null ? pesos(line.price.promoFrom) : "ninguno"} →{" "}
          <strong>{pesos(line.price.promoTo)}</strong> <span className="text-brand-ink-soft">(normal {pesos(line.price.regular)}, tachado)</span>
        </p>
      )}
      {line.product && !line.willChange && line.notes.length === 0 && <p className="text-xs text-brand-ink-soft">Ya está así: no cambia nada.</p>}
      {line.notes.map((note) => (
        <p key={note} className="text-xs text-amber-800">
          {note}
        </p>
      ))}
    </li>
  );
}
