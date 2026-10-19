"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COLOR_FAMILIES, colorFamilySwatch } from "@/lib/color-families";

/// Herramienta del administrador (solo con "Entrar como"): la IA mira la
/// foto de cada producto y propone su familia de color (nudes, rosados,
/// verdes…); acá se revisa, se corrige a mano y se guarda. Con eso cada
/// colección muestra sola el filtro "Familia de color". Ver
/// color-family-service.ts y conversación del 2026-10-19.

type Candidate = { id: string; name: string; imageUrl: string | null; family: string | null; hasVariants: boolean; collections: string[] };
type Proposal = { productId: string; family: string | null; reason: "ia" | "sin-color" | "sin-foto" | "sin-respuesta" };

const API = "/api/marca/tienda/productos/colores";
const BATCH = 10;
const CONCURRENCY = 2;
const PAGE = 60;

const REASON_LABEL: Record<Proposal["reason"], string> = {
  ia: "IA",
  "sin-color": "IA: sin color propio",
  "sin-foto": "sin foto que leer",
  "sin-respuesta": "la IA no respondió",
};

function Swatch({ family }: { family: string | null }) {
  const swatch = family ? colorFamilySwatch(family) : null;
  if (!swatch) return <span aria-hidden className="w-3.5 h-3.5 shrink-0 rounded-full border border-dashed border-brand-line" />;
  return <span aria-hidden className="w-3.5 h-3.5 shrink-0 rounded-full border border-brand-line" style={{ background: swatch }} />;
}

export function ColorFamiliesTool() {
  const router = useRouter();
  const [products, setProducts] = useState<Candidate[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [collection, setCollection] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [proposals, setProposals] = useState<Record<string, Proposal>>({});
  const [draft, setDraft] = useState<Record<string, string | null>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const stop = useRef(false);

  async function load() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(API);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo revisar.");
      setProducts(body.products);
      setAvailable(body.available);
      setDraft({});
      setProposals({});
      setShown(PAGE);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo revisar.");
    } finally {
      setBusy(false);
    }
  }

  const collections = useMemo(() => Array.from(new Set((products ?? []).flatMap((p) => p.collections))).sort((a, b) => a.localeCompare(b, "es")), [products]);
  const visible = useMemo(
    () => (products ?? []).filter((p) => (!collection || p.collections.includes(collection)) && (!onlyMissing || !p.family)),
    [products, collection, onlyMissing],
  );
  // Lo que dijo la IA cuenta solo si de verdad miró la foto; si no la pudo
  // leer, queda lo que ya tenía (y se puede reintentar).
  const answered = (id: string) => proposals[id] && (proposals[id].reason === "ia" || proposals[id].reason === "sin-color");
  const valueOf = (p: Candidate) => (p.id in draft ? draft[p.id] : answered(p.id) ? proposals[p.id].family : p.family);
  const changes = (products ?? []).filter((p) => (valueOf(p) ?? null) !== (p.family ?? null));
  const toAnalyze = visible.filter((p) => p.imageUrl && (!proposals[p.id] || proposals[p.id].reason === "sin-respuesta"));

  async function analyze() {
    const ids = toAnalyze.map((p) => p.id);
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
    stop.current = false;
    setNotice(null);
    setProgress({ done: 0, total: ids.length });
    let done = 0;
    let failed = 0;
    let next = 0;
    async function worker() {
      while (next < batches.length && !stop.current) {
        const batch = batches[next++];
        try {
          const res = await fetch(`${API}/analizar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productIds: batch }) });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "La IA no respondió.");
          setProposals((prev) => {
            const copy = { ...prev };
            for (const p of body.proposals as Proposal[]) copy[p.productId] = p;
            return copy;
          });
        } catch (err) {
          failed += batch.length;
          setNotice(err instanceof Error ? err.message : "La IA no respondió.");
          // Sin llave o sin permiso no tiene sentido seguir.
          if (err instanceof Error && /configurada|administrador/.test(err.message)) stop.current = true;
        }
        done += batch.length;
        setProgress({ done, total: ids.length });
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setProgress(null);
    if (failed > 0) setNotice(`${failed} productos no se pudieron analizar — vuelve a "Analizar" para reintentarlos.`);
  }

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const assignments = changes.map((p) => ({ productId: p.id, family: valueOf(p) ?? null }));
      const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assignments }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo guardar.");
      setProducts((prev) => (prev ?? []).map((p) => (changes.some((c) => c.id === p.id) ? { ...p, family: valueOf(p) ?? null } : p)));
      setDraft({});
      setProposals({});
      setNotice(
        `Listo: ${body.saved} productos con familia${body.removed > 0 ? ` y ${body.removed} sin familia` : ""}. Las colecciones ya muestran el filtro "Familia de color".`,
      );
      router.refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    const v = valueOf(p);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  return (
    <div className="rounded-xl border border-dashed border-brand-line p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-brand-ink">
            Familias de color con IA <span className="text-xs font-normal text-brand-ink-soft">(solo admin)</span>
          </p>
          <p className="text-xs text-brand-ink-soft">
            La IA mira la foto de cada producto y le pone su familia de color — nudes, rosados, verdes, glitter… Revisas, corriges lo que haga falta y
            guardas: cada colección muestra sola el filtro &quot;Familia de color&quot;.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy || progress != null}
          className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
        >
          {busy && !products ? "Un momento…" : products ? "Volver a cargar" : "Revisar productos"}
        </button>
      </div>
      {notice && <p className="text-sm text-brand-ink">{notice}</p>}
      {products && (
        <div className="space-y-3">
          <p className="text-sm text-brand-ink-soft">
            {products.length} productos · {products.filter((p) => p.family).length} con familia · {products.filter((p) => !p.imageUrl).length} sin foto
          </p>
          {!available && <p className="text-sm text-amber-700">La IA no está configurada en este servidor: puedes poner las familias a mano.</p>}
          <div className="flex flex-wrap items-end gap-3">
            {collections.length > 0 && (
              <label className="text-xs text-brand-ink-soft">
                Colección
                <select value={collection} onChange={(e) => { setCollection(e.target.value); setShown(PAGE); }} className="input text-sm mt-1 block">
                  <option value="">Todas</option>
                  {collections.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-brand-ink pb-2">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => { setOnlyMissing(e.target.checked); setShown(PAGE); }} />
              Solo los que no tienen familia
            </label>
            {available && (
              progress ? (
                <button type="button" onClick={() => (stop.current = true)} className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft">
                  Detener ({progress.done} de {progress.total})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={analyze}
                  disabled={busy || toAnalyze.length === 0}
                  className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Analizar {toAnalyze.length} con IA
                </button>
              )
            )}
            {changes.length > 0 && !progress && (
              <button type="button" onClick={save} disabled={busy} className="bg-brand-ink text-brand-bg rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {busy ? "Guardando…" : `Guardar ${changes.length} cambios`}
              </button>
            )}
          </div>
          {progress && (
            <div className="h-1.5 rounded-full bg-brand-accent-soft overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
              <div className="h-full bg-brand-accent transition-[width]" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          )}
          {counts.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {COLOR_FAMILIES.filter((f) => counts.has(f.name)).map((f) => (
                <span key={f.name} className="inline-flex items-center gap-1.5 rounded-full border border-brand-line px-2.5 py-1 text-xs text-brand-ink">
                  <Swatch family={f.name} /> {f.name} <span className="text-brand-ink-soft tabular-nums">{counts.get(f.name)}</span>
                </span>
              ))}
            </div>
          )}
          {visible.length === 0 ? (
            <p className="text-sm text-brand-ink-soft">{onlyMissing ? "Todos estos productos ya tienen familia." : "No hay productos acá."}</p>
          ) : (
            <ul className="divide-y divide-brand-line rounded-lg border border-brand-line max-h-[32rem] overflow-y-auto">
              {visible.slice(0, shown).map((p) => {
                const value = valueOf(p) ?? null;
                const proposal = proposals[p.id];
                const changed = value !== (p.family ?? null);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura del producto
                      <img src={p.imageUrl} alt="" className="w-11 h-11 shrink-0 rounded-md object-cover bg-brand-accent-soft" loading="lazy" />
                    ) : (
                      <span className="w-11 h-11 shrink-0 rounded-md bg-brand-accent-soft" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-brand-ink truncate">{p.name}</p>
                      <p className="text-[11px] text-brand-ink-soft truncate">
                        {proposal ? REASON_LABEL[proposal.reason] : p.family ? "guardada" : "sin familia"}
                        {changed ? " · por guardar" : ""}
                        {p.hasVariants ? " · con variantes: aplica a todo el producto" : ""}
                      </p>
                    </div>
                    <Swatch family={value} />
                    <select
                      value={value ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [p.id]: e.target.value || null }))}
                      aria-label={`Familia de color de ${p.name}`}
                      className="input text-sm w-44 shrink-0"
                    >
                      <option value="">Sin familia</option>
                      {COLOR_FAMILIES.map((f) => (
                        <option key={f.name} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
          {visible.length > shown && (
            <button type="button" onClick={() => setShown((s) => s + PAGE)} className="text-xs font-medium text-brand-accent hover:underline">
              Ver {Math.min(PAGE, visible.length - shown)} más de {visible.length - shown}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
