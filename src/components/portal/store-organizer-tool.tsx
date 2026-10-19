"use client";

import { useEffect, useState } from "react";

/// Herramienta del administrador (solo con "Entrar como"): el organizador
/// automático de tienda. "Ver propuesta" arma el plan (colecciones,
/// orden, menú, portada y nombres) sin tocar nada; "Aplicar" lo deja
/// puesto y guarda una copia para "Deshacer". Ver
/// store-organizer-service.ts y conversación del 2026-10-19.

type PlannedCollection = {
  key: string;
  existingId: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  productIds: string[];
  demand: number;
  sold: number;
  children: PlannedCollection[];
};

type MenuItem = { label: string; url: string; children: MenuItem[] };

export type OrganizerPlanView = {
  source: "ia" | "reglas";
  collections: PlannedCollection[];
  removedCollections: { id: string; name: string; slug: string; count: number; movedTo: string | null }[];
  productNames: { id: string; from: string; to: string }[];
  menu: MenuItem[];
  home: { type: string; title?: string; label?: string; heading?: string }[];
  announcement?: string | null;
  notes?: string | null;
  /// Productos sin ficha: solo para esos la IA escribe una.
  productsWithoutDescription: string[];
  productDescriptions: { id: string; html: string; summary: string }[];
  collectionBanners: boolean;
  settings: {
    purchaseInfo: boolean;
    lowStock: boolean;
    cartSuggestions: boolean;
    footerContact: boolean;
    footerPages: boolean;
  };
  stats: {
    products: number;
    active: number;
    soldOut: number;
    withSales: number;
    collectionsBefore: number;
    collectionsAfter: number;
    subcollections: number;
    renamed: number;
    discounted: number;
  };
};

export type OrganizerSummary = {
  source: "ia" | "reglas";
  collections: { created: number; updated: number; removed: number; subcollections: number };
  products: { placed: number; renamed: number };
  menu: number;
  home: number;
  families: number;
  kept?: number;
  banners?: number;
  announcement?: boolean;
  descriptions?: number;
  collectionBanners?: number;
  settings?: string[];
};

type LastRun = { id: string; status: "APPLIED" | "REVERTED"; source: string; createdAt: string; summary: OrganizerSummary } | null;

const SECTION_LABEL: Record<string, string> = {
  BANNER: "Banner de la colección estrella (pintado con el estilo de la tienda)",
  KEEP: "Se conserva",
  CATEGORY_GRID: "Compra por categoría",
  CATEGORY_BANNERS: "Banners de categorías",
  FEATURED_COLLECTION: "Colección destacada",
  FEATURED_PRODUCTS: "Los más vendidos / Destacados",
  ON_SALE_PRODUCTS: "Ofertas",
  NEW_PRODUCTS: "Novedades",
  TEXT: "Texto de bienvenida",
  SHIPPING_INFO_BANNERS: "Sellos de confianza (envíos, pagos, cambios)",
  INSTAGRAM_CTA: "Instagram",
  PRODUCT_CATALOG: "Todos los productos",
};

function sectionLabel(s: OrganizerPlanView["home"][number]) {
  const base = SECTION_LABEL[s.type] ?? s.type;
  if (s.type === "KEEP" && s.label) return `${base}: ${s.label}`;
  if (s.type === "FEATURED_COLLECTION" && s.title) return `${base}: ${s.title}`;
  if (s.type === "BANNER" && s.title) return `Banner de ${s.title} (pintado con el estilo de la tienda)`;
  if (s.type === "TEXT" && s.heading) return `${base}: "${s.heading}"`;
  return base;
}

const API = "/api/marca/tienda/organizar";

/// Una petición al organizador. La página de error de Vercel (cuando una
/// función se pasa del tiempo) no es JSON: se traduce a algo entendible.
export async function organizerRequest(body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = null;
  }
  if (!res.ok || !data?.ok) {
    const error = typeof data?.error === "string" ? data.error : null;
    throw new Error(error ?? (res.status === 504 || /An error o/.test(text) ? "El servidor tardó demasiado en este paso. Intenta de nuevo." : "No se pudo completar este paso."));
  }
  return data;
}

type DefinedCollection = { name: string; description: string; children: string[] };
type Assignment = { id: string; collection: string; child: string | null };

const CLASSIFY_CONCURRENCY = 3;
const DESCRIBE_BATCH = 8;

/// Fichas por tandas, solo para los productos que no tienen ninguna
/// (después del plan, con la colección en la que queda cada uno). Una
/// tanda que falla dos veces se salta: esos quedan sin ficha.
async function describeProducts(plan: OrganizerPlanView, onStep: (step: string) => void): Promise<{ descriptions: OrganizerPlanView["productDescriptions"]; kept: number }> {
  const items: { id: string; collection: string }[] = [];
  const without = new Set(plan.productsWithoutDescription ?? []);
  const seen = new Set<string>();
  const walk = (list: PlannedCollection[], parent?: string) => {
    for (const c of list) {
      for (const id of c.productIds) {
        if (!without.has(id) || seen.has(id)) continue;
        seen.add(id);
        items.push({ id, collection: parent ? `${parent} / ${c.name}` : c.name });
      }
      walk(c.children, c.name);
    }
  };
  walk(plan.collections);
  if (items.length === 0) return { descriptions: [], kept: 0 };
  const queue: { id: string; collection: string }[][] = [];
  for (let i = 0; i < items.length; i += DESCRIBE_BATCH) queue.push(items.slice(i, i + DESCRIBE_BATCH));
  const descriptions: OrganizerPlanView["productDescriptions"] = [];
  let kept = 0;
  let done = 0;
  onStep(`Escribiendo las fichas de los productos que no tienen… 0 de ${items.length}`);
  async function worker() {
    while (queue.length > 0) {
      const batch = queue.shift()!;
      const describe = () => organizerRequest({ action: "describe", items: batch }) as Promise<unknown>;
      let result = await describe().catch(() => null);
      if (!result) result = await describe().catch(() => null);
      if (result) {
        const r = result as { descriptions: OrganizerPlanView["productDescriptions"]; kept: number };
        descriptions.push(...r.descriptions);
        kept += r.kept;
      }
      done += batch.length;
      onStep(`Escribiendo las fichas de los productos que no tienen… ${Math.min(done, items.length)} de ${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: CLASSIFY_CONCURRENCY }, worker));
  return { descriptions, kept };
}

/// Arma el plan por pasos: "prepare" (con IA define las colecciones; sin
/// IA ya devuelve el plan), "classify" por tandas en paralelo, y "plan".
/// Si una tanda falla dos veces, todo se arma por reglas.
export async function buildOrganizerPlan(onStep: (step: string) => void): Promise<{ plan: OrganizerPlanView; lastRun: LastRun }> {
  onStep("Leyendo el catálogo, las ventas y las reseñas, y definiendo las colecciones con la IA…");
  const prepared = (await organizerRequest({ action: "prepare" })) as unknown as
    | { mode: "reglas"; plan: OrganizerPlanView; lastRun: LastRun }
    | { mode: "ia"; collections: DefinedCollection[]; batches: string[][]; total: number; lastRun: LastRun };
  if (prepared.mode === "reglas") return { plan: prepared.plan, lastRun: prepared.lastRun };
  const ia = prepared;

  const queue = ia.batches.slice();
  const assignments: Assignment[] = [];
  const productNames: { id: string; name: string }[] = [];
  let done = 0;
  let failed = false;
  onStep(`Colecciones: ${ia.collections.map((c) => c.name).join(", ")}. Clasificando productos… 0 de ${ia.total}`);
  async function worker() {
    while (queue.length > 0 && !failed) {
      const ids = queue.shift()!;
      const classify = () => organizerRequest({ action: "classify", collections: ia.collections, ids }) as Promise<unknown>;
      let result = await classify().catch(() => null);
      if (!result) result = await classify().catch(() => null);
      if (!result) {
        failed = true;
        return;
      }
      const r = result as { assignments: Assignment[]; productNames: { id: string; name: string }[] };
      assignments.push(...r.assignments);
      productNames.push(...r.productNames);
      done += ids.length;
      onStep(`Clasificando productos con la IA… ${Math.min(done, ia.total)} de ${ia.total}`);
    }
  }
  await Promise.all(Array.from({ length: CLASSIFY_CONCURRENCY }, worker));
  if (failed) {
    onStep("La IA no respondió en alguna tanda: se arma por reglas…");
    const rules = (await organizerRequest({ action: "plan", mode: "reglas" })) as unknown as { plan: OrganizerPlanView; lastRun: LastRun };
    return { plan: rules.plan, lastRun: rules.lastRun };
  }
  onStep("Armando el plan: orden, menú y portada…");
  const planned = (await organizerRequest({ action: "plan", mode: "ia", definitions: ia.collections, assignments, productNames })) as unknown as { plan: OrganizerPlanView; lastRun: LastRun };
  const described = await describeProducts(planned.plan, onStep);
  return { plan: { ...planned.plan, productDescriptions: described.descriptions }, lastRun: planned.lastRun };
}

export function summaryText(s: OrganizerSummary) {
  const rest = [
    s.descriptions ? `${s.descriptions} fichas de producto reescritas` : "",
    s.collectionBanners ? `${s.collectionBanners} ${s.collectionBanners === 1 ? "banner de colección pintado" : "banners de colección pintados"}` : "",
    s.settings?.length ? `ajustes: ${s.settings.join(", ")}` : "",
  ]
    .filter(Boolean)
    .map((t) => ` · ${t}`)
    .join("");
  const home = [
    `portada con ${s.home} secciones`,
    s.kept ? `${s.kept} ${s.kept === 1 ? "importada conservada" : "importadas conservadas"}` : "",
    s.banners ? `${s.banners} ${s.banners === 1 ? "banner pintado" : "banners pintados"} con el estilo de la tienda` : "",
    s.announcement ? "barra de anuncio puesta" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `${s.collections.created + s.collections.updated} colecciones (${s.collections.created} nuevas, ${s.collections.updated} conservadas, ${s.collections.removed} quitadas${s.collections.subcollections > 0 ? `, ${s.collections.subcollections} subcolecciones` : ""}) · ${s.products.placed} productos ubicados · ${s.products.renamed} nombres arreglados · menú de ${s.menu} enlaces · ${home}${rest}${s.families > 0 ? ` · ${s.families} familias` : ""} · estructura por ${s.source === "ia" ? "IA" : "reglas"}`;
}

/// Los ajustes del plan, en palabras.
function settingsText(settings: OrganizerPlanView["settings"]) {
  return [
    settings.purchaseInfo ? "sellos de confianza en la ficha de producto" : "",
    settings.lowStock ? "aviso de últimas unidades con el inventario real" : "",
    settings.cartSuggestions ? "sugerencias en el carrito" : "",
    settings.footerContact ? "contacto en el pie de página" : "",
    settings.footerPages ? "páginas de información en el pie de página" : "",
  ].filter(Boolean);
}

export function StoreOrganizerTool({ onApplied }: { onApplied?: () => void }) {
  const [plan, setPlan] = useState<OrganizerPlanView | null>(null);
  const [lastRun, setLastRun] = useState<LastRun>(null);
  useEffect(() => {
    fetch(API)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => body && setLastRun(body.lastRun as LastRun))
      .catch(() => {});
  }, []);
  const [busy, setBusy] = useState<"preview" | "apply" | "undo" | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [showCopies, setShowCopies] = useState(false);

  async function preview() {
    setBusy("preview");
    setError(null);
    setNotice(null);
    try {
      const built = await buildOrganizerPlan(setStep);
      setPlan(built.plan);
      setLastRun(built.lastRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo armar el plan.");
    } finally {
      setBusy(null);
      setStep(null);
    }
  }

  async function apply() {
    if (!plan) return;
    setBusy("apply");
    setError(null);
    try {
      const body = await organizerRequest({ action: "apply", plan });
      setNotice(`Listo: ${summaryText(body.summary as OrganizerSummary)}.`);
      setLastRun(body.lastRun as LastRun);
      setPlan(null);
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar.");
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    setBusy("undo");
    setError(null);
    try {
      const body = await organizerRequest({ action: "undo" });
      const restored = body.restored as { collections: number; menu: number; sections: number; products: number; descriptions?: number };
      setNotice(
        `Se volvió a como estaba: ${restored.collections} colecciones, ${restored.menu} enlaces del menú, ${restored.sections} secciones, ${restored.products} nombres${restored.descriptions ? `, ${restored.descriptions} fichas` : ""} y los ajustes del tema.`,
      );
      setLastRun(body.lastRun as LastRun);
      setPlan(null);
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshacer.");
    } finally {
      setBusy(null);
    }
  }

  const canUndo = lastRun?.status === "APPLIED";

  return (
    <div className="rounded-xl border border-dashed border-brand-line p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-brand-ink">
            Organizar la tienda <span className="text-xs font-normal text-brand-ink-soft">(solo admin)</span>
          </p>
          <p className="text-xs text-brand-ink-soft">
            Arma la tienda para vender: pocas colecciones claras con nombres bien puestos, cada producto en la suya, lo más vendido
            arriba y lo agotado al final, el menú en orden de demanda y una portada completa (conserva los banners y videos
            importados que aportan y pinta el banner principal con los colores y la letra de la tienda). Todo se puede deshacer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={preview}
            disabled={busy !== null}
            className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
          >
            {busy === "preview" ? "Armando el plan…" : plan ? "Armar otra vez" : "Ver propuesta"}
          </button>
          {canUndo && (
            <button
              type="button"
              onClick={undo}
              disabled={busy !== null}
              className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
            >
              {busy === "undo" ? "Deshaciendo…" : "Deshacer la última"}
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-green-700">{notice}</p>}
      {busy === "preview" && <p className="text-xs text-brand-ink-soft">{step ?? "Armando el plan…"} Una tienda grande tarda unos minutos.</p>}
      {plan && (
        <div className="space-y-3 text-sm text-brand-ink">
          <p>
            {plan.stats.products} productos ({plan.stats.active} activos, {plan.stats.soldOut} agotados
            {plan.stats.withSales > 0 ? `, ${plan.stats.withSales} con ventas` : ", sin ventas todavía"}) ·{" "}
            {plan.stats.collectionsBefore} colecciones hoy → {plan.stats.collectionsAfter}
            {plan.stats.subcollections > 0 ? ` (+${plan.stats.subcollections} subcolecciones)` : ""} ·{" "}
            {plan.stats.renamed} nombres por arreglar · estructura por {plan.source === "ia" ? "IA" : "reglas (sin llave de IA)"}
          </p>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink-soft mb-1">Colecciones, en el orden en que irán</p>
            <ol className="space-y-1 list-decimal pl-5">
              {plan.collections.map((c) => (
                <li key={c.key}>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-brand-ink-soft">
                    {" "}
                    · {c.productIds.length} productos{c.sold > 0 ? ` · ${c.sold} vendidos` : ""}
                    {c.existingId ? "" : " · nueva"}
                    {c.imageUrl ? "" : " · sin foto"}
                  </span>
                  {c.description && <p className="text-xs text-brand-ink-soft">{c.description}</p>}
                  {c.children.length > 0 && (
                    <p className="text-xs text-brand-ink-soft">Subcolecciones: {c.children.map((ch) => `${ch.name} (${ch.productIds.length})`).join(", ")}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
          {plan.removedCollections.length > 0 && (
            <p className="text-xs text-brand-ink-soft">
              Se quitan {plan.removedCollections.length} colecciones:{" "}
              {plan.removedCollections
                .slice(0, 12)
                .map((r) => `${r.name}${r.movedTo ? ` → ${r.movedTo}` : ""}`)
                .join(", ")}
              {plan.removedCollections.length > 12 ? "…" : ""}. Sus links viejos llevan a la colección que recibió sus productos.
            </p>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink-soft mb-1">Menú</p>
            <p className="text-xs">
              {plan.menu
                .map((m) => (m.children.length > 0 ? `${m.label} (${m.children.map((ch) => ch.label).join(", ")})` : m.label))
                .join(" · ")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink-soft mb-1">Portada</p>
            <ol className="text-xs space-y-0.5 list-decimal pl-5">
              {plan.home.map((s, i) => (
                <li key={i}>{sectionLabel(s)}</li>
              ))}
            </ol>
            {plan.announcement && (
              <p className="text-xs mt-1">
                Barra de anuncio: <span className="font-medium">{plan.announcement}</span>{" "}
                <span className="text-brand-ink-soft">(solo si la tienda no tiene una)</span>
              </p>
            )}
            {plan.notes && <p className="text-xs text-brand-ink-soft mt-1">Criterio de la IA: {plan.notes}</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink-soft mb-1">Fichas de producto</p>
            {plan.productDescriptions.length > 0 ? (
              <>
                <p className="text-xs">
                  {plan.productDescriptions.length} productos sin ficha reciben una escrita con la línea directiva (qué es, qué gana quien compra, qué incluye,
                  cómo se usa, datos reales). Las fichas que ya existen no se tocan.{" "}
                  <button type="button" onClick={() => setShowCopies((v) => !v)} className="font-medium text-brand-accent hover:underline">
                    {showCopies ? "Ocultar ejemplos" : "Ver ejemplos"}
                  </button>
                </p>
                {showCopies && (
                  <ul className="mt-1 text-xs text-brand-ink-soft space-y-1 max-h-60 overflow-y-auto">
                    {plan.productDescriptions.slice(0, 8).map((d) => (
                      <li key={d.id}>
                        <span className="text-brand-ink">{plan.productNames.find((n) => n.id === d.id)?.to ?? d.id}</span>: {d.summary}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-xs text-brand-ink-soft">
                {plan.source === "ia"
                  ? plan.productsWithoutDescription.length > 0
                    ? `${plan.productsWithoutDescription.length} productos no tienen ficha y la IA no alcanzó a escribirla; las demás no se tocan.`
                    : "Todos los productos ya tienen ficha: no se toca ninguna."
                  : "Sin llave de IA las fichas no se tocan."}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink-soft mb-1">Colecciones y ajustes</p>
            <p className="text-xs">
              {plan.collectionBanners ? "Banner pintado con el estilo de la tienda para cada colección principal que no tenga uno. " : ""}
              {settingsText(plan.settings).length > 0 ? `Ajustes: ${settingsText(plan.settings).join(" · ")}.` : ""}
            </p>
          </div>
          {plan.productNames.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowNames((v) => !v)} className="text-xs font-medium text-brand-accent hover:underline">
                {showNames ? "Ocultar" : "Ver"} los {plan.productNames.length} nombres que cambian
              </button>
              {showNames && (
                <ul className="mt-1 text-xs text-brand-ink-soft space-y-0.5 max-h-60 overflow-y-auto">
                  {plan.productNames.map((n) => (
                    <li key={n.id}>
                      {n.from} → <span className="text-brand-ink">{n.to}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={busy !== null}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy === "apply" ? "Aplicando…" : "Aplicar esta organización"}
          </button>
        </div>
      )}
    </div>
  );
}
