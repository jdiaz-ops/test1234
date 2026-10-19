"use client";

import { useState } from "react";

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
  home: { type: string; title?: string }[];
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
};

type LastRun = { id: string; status: "APPLIED" | "REVERTED"; source: string; createdAt: string; summary: OrganizerSummary } | null;

const SECTION_LABEL: Record<string, string> = {
  BANNER: "Banner de la colección estrella",
  CATEGORY_GRID: "Compra por categoría",
  FEATURED_PRODUCTS: "Los más vendidos / Destacados",
  ON_SALE_PRODUCTS: "Ofertas",
  NEW_PRODUCTS: "Novedades",
  SHIPPING_INFO_BANNERS: "Sellos de confianza (envíos, pagos, cambios, WhatsApp)",
  INSTAGRAM_CTA: "Instagram",
  PRODUCT_CATALOG: "Todos los productos",
};

export function summaryText(s: OrganizerSummary) {
  return `${s.collections.created + s.collections.updated} colecciones (${s.collections.created} nuevas, ${s.collections.updated} conservadas, ${s.collections.removed} quitadas${s.collections.subcollections > 0 ? `, ${s.collections.subcollections} subcolecciones` : ""}) · ${s.products.placed} productos ubicados · ${s.products.renamed} nombres arreglados · menú de ${s.menu} enlaces · portada con ${s.home} secciones${s.families > 0 ? ` · ${s.families} familias` : ""} · estructura por ${s.source === "ia" ? "IA" : "reglas"}`;
}

export function StoreOrganizerTool({ onApplied }: { onApplied?: () => void }) {
  const [plan, setPlan] = useState<OrganizerPlanView | null>(null);
  const [lastRun, setLastRun] = useState<LastRun>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);

  async function preview() {
    setBusy("preview");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/marca/tienda/organizar");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo armar el plan.");
      setPlan(body.plan);
      setLastRun(body.lastRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo armar el plan.");
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!plan) return;
    setBusy("apply");
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/organizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", plan }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo aplicar.");
      setNotice(`Listo: ${summaryText(body.summary as OrganizerSummary)}.`);
      setLastRun(body.lastRun);
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
      const res = await fetch("/api/marca/tienda/organizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo deshacer.");
      setNotice(`Se volvió a como estaba: ${body.restored.collections} colecciones, ${body.restored.menu} enlaces del menú, ${body.restored.sections} secciones y ${body.restored.products} nombres.`);
      setLastRun(body.lastRun);
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
            arriba y lo agotado al final, el menú en orden de demanda y una portada completa. Todo se puede deshacer.
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
      {busy === "preview" && (
        <p className="text-xs text-brand-ink-soft">Leyendo el catálogo, las ventas y las reseñas, y pidiéndole a la IA la estructura… puede tardar hasta un minuto.</p>
      )}
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
            <p className="text-xs">{plan.home.map((s) => SECTION_LABEL[s.type] ?? s.type).join(" → ")}</p>
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
