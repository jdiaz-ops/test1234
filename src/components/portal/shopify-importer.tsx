"use client";

import { useState } from "react";
import {
  parseShopifyProductsCsv,
  ShopifyCsvError,
  slugify,
  type ShopifyCsvParseResult,
  type ShopifyCsvStats,
  type ShopifyImportProduct,
} from "@/lib/shopify-csv";
import { MAX_PAGES, PAGE_SIZE, type ShopifyImportCollection } from "@/lib/shopify-products-json";
import type { ProposedCollection } from "@/lib/shopify-categorize";
import type { ShopifyThemeInfo } from "@/lib/shopify-theme";

type ImportResult = {
  handle: string;
  name: string;
  action: "created" | "updated" | "error";
  error?: string;
};

type Source = "link" | "csv";

/// Lo que se leyó de la tienda además de los productos (solo por link).
type LinkExtras = {
  storeUrl: string;
  collections: ShopifyImportCollection[];
  /// Categorías propuestas cuando Shopify no tiene colecciones.
  proposed: { collections: ProposedCollection[]; source: "ia" | "reglas" } | null;
  theme: ShopifyThemeInfo | null;
  /// Avisos de lectura (algo que no se pudo leer y se siguió sin eso).
  notes: string[];
};

type ImportOptions = { products: boolean; collections: boolean; design: boolean };

type ExtrasResult = {
  collections: { created: number; updated: number; errors: number; linked: number } | null;
  menu: { items: number; replaced: boolean } | null;
  design: { colors: boolean; fonts: boolean; published: boolean; logo: string; favicon: string } | null;
  errors: string[];
};

const BATCH_SIZE = 10;
const PROPOSE_BATCH = 150;
const API_READ = "/api/marca/tienda/productos/leer-shopify";
const API_IMPORT = "/api/marca/tienda/productos/importar-shopify";
const API_PROPOSE = "/api/marca/tienda/colecciones/proponer";
const API_COLLECTIONS = "/api/marca/tienda/colecciones/importar-shopify";
const API_DESIGN = "/api/marca/tienda/diseno/importar-shopify";

function failed(product: ShopifyImportProduct, error: string): ImportResult {
  return { handle: product.handle, name: product.name, action: "error", error };
}

function message(err: unknown) {
  return err instanceof Error ? err.message : "Algo falló. Intenta de nuevo.";
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? "No pudimos completar este paso. Intenta de nuevo.");
  return data;
}

function emptyStats(): ShopifyCsvStats {
  return { products: 0, withVariants: 0, images: 0, unknownStock: 0, draft: 0 };
}

const IMAGE_OUTCOME: Record<string, string> = {
  subido: "subido",
  "ya-tenia": "ya tenías uno, no se cambió",
  omitido: "no se encontró en Shopify",
  error: "no se pudo subir",
};

/// Importar el catálogo completo desde Shopify — la marca no vuelve a
/// escribir producto por producto. Dos caminos que terminan en la misma
/// lista (ShopifyImportProduct) y el mismo envío por lotes a
/// /api/marca/tienda/productos/importar-shopify:
///   · Por el link de la tienda (2026-10-17): el servidor lee el catálogo
///     público página por página (ver shopify-store-reader.ts) y, de
///     paso, las colecciones con sus productos, el menú y el diseño
///     (colores, letra, logo) de la portada. Si la tienda no tiene
///     colecciones, se proponen categorías (ver
///     shopify-categorize-service.ts). Es el camino por defecto porque no
///     le pide nada a la marca: la tienda queda armada.
///   · Por el CSV exportado desde Shopify, leído acá en el navegador (ver
///     shopify-csv.ts). Sirve cuando la tienda tiene contraseña o hay
///     productos en borrador que el link no trae.
/// Los dos usan el mismo id por handle, así repetir con cualquiera de los
/// dos actualiza en vez de duplicar.
export function ShopifyImporter({
  onImported,
  onClose,
}: {
  /// Se llama al terminar (haya o no errores) para recargar la lista.
  onImported: () => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<Source>("link");
  const [storeUrl, setStoreUrl] = useState("");
  const [readingStep, setReadingStep] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ShopifyCsvParseResult | null>(null);
  const [extras, setExtras] = useState<LinkExtras | null>(null);
  const [options, setOptions] = useState<ImportOptions>({ products: true, collections: true, design: true });
  const [parseError, setParseError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "importing" | "done">("pick");
  const [progress, setProgress] = useState(0);
  const [extraStep, setExtraStep] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [extrasResult, setExtrasResult] = useState<ExtrasResult | null>(null);

  function switchSource(next: Source) {
    setSource(next);
    setParsed(null);
    setExtras(null);
    setParseError(null);
  }

  async function handleFile(file: File | null) {
    setParsed(null);
    setParseError(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    try {
      const text = await file.text();
      setParsed(parseShopifyProductsCsv(text));
    } catch (err) {
      setParseError(
        err instanceof ShopifyCsvError
          ? err.message
          : "No se pudo leer el archivo — revisa que sea el CSV exportado desde Shopify.",
      );
    }
  }

  /// Lee toda la tienda por el link: productos, colecciones (o propone
  /// categorías), diseño y menú. Cada pieza que falle después de los
  /// productos deja un aviso y no frena el resto.
  async function readStore() {
    setParsed(null);
    setExtras(null);
    setParseError(null);
    const products: ShopifyImportProduct[] = [];
    const seen = new Set<string>();
    const warnings: string[] = [];
    const notes: string[] = [];
    const stats = emptyStats();
    const url = storeUrl;
    try {
      let resolvedUrl = "";
      for (let page = 1; page <= MAX_PAGES; page++) {
        setReadingStep(`Leyendo productos… página ${page}`);
        const body = await postJson(API_READ, { url, part: "productos", page });
        for (const product of body.products as ShopifyImportProduct[]) {
          if (seen.has(product.handle)) continue;
          seen.add(product.handle);
          products.push(product);
          stats.products++;
          stats.images += product.images.length;
          if (product.hasVariants) stats.withVariants++;
          if (product.status === "DRAFT") stats.draft++;
        }
        warnings.push(...(body.warnings as string[]));
        resolvedUrl = body.storeUrl as string;
        if (!body.hasMore) break;
        if (page === MAX_PAGES) {
          warnings.push(
            `La tienda tiene más de ${MAX_PAGES * PAGE_SIZE} productos: se leyeron los primeros ${products.length}. Para el resto, usa el CSV.`,
          );
        }
      }
      // El link nunca trae cantidades de inventario.
      stats.unknownStock = stats.products;

      let collections: ShopifyImportCollection[] = [];
      try {
        setReadingStep("Leyendo colecciones…");
        const list = (await postJson(API_READ, { url, part: "colecciones" })).collections as ShopifyImportCollection[];
        for (let i = 0; i < list.length; i++) {
          setReadingStep(`Leyendo colecciones… ${i + 1} de ${list.length}`);
          const handles: string[] = [];
          for (let page = 1; page <= MAX_PAGES; page++) {
            const body = await postJson(API_READ, { url, part: "coleccion", handle: list[i].handle, page });
            handles.push(...(body.handles as string[]));
            if (!body.hasMore) break;
          }
          const known = handles.filter((h) => seen.has(h));
          if (known.length > 0) collections.push({ ...list[i], productHandles: known });
        }
      } catch (err) {
        notes.push(`No se pudieron leer las colecciones de Shopify: ${message(err)}`);
        collections = [];
      }

      let proposed: LinkExtras["proposed"] = null;
      if (collections.length === 0 && products.length > 0) {
        try {
          setReadingStep("Organizando los productos en categorías…");
          const catalogNames = products.map((p) => p.name);
          const merged = new Map<string, ProposedCollection>();
          let categories: string[] | undefined;
          let aiSource: "ia" | "reglas" = "reglas";
          for (let i = 0; i < products.length; i += PROPOSE_BATCH) {
            const chunk = products.slice(i, i + PROPOSE_BATCH).map((p) => ({
              handle: p.handle,
              name: p.name,
              type: p.collectionName,
              tags: p.tags ?? [],
            }));
            const body = await postJson(API_PROPOSE, {
              products: chunk,
              ...(categories ? { categories } : { catalogNames }),
            });
            aiSource = body.source;
            for (const c of body.collections as ProposedCollection[]) {
              const key = c.name.trim().toLowerCase();
              const group = merged.get(key) ?? { name: c.name, productHandles: [] };
              group.productHandles.push(...c.productHandles);
              merged.set(key, group);
            }
            categories = Array.from(merged.values()).map((c) => c.name);
          }
          const list = Array.from(merged.values()).filter((c) => c.productHandles.length > 0);
          if (list.length > 0) proposed = { collections: list, source: aiSource };
          else notes.push("Shopify no tiene colecciones y no pudimos proponer categorías: los productos entran sin colección.");
        } catch (err) {
          notes.push(`No pudimos proponer categorías: ${message(err)}`);
        }
      }

      let theme: ShopifyThemeInfo | null = null;
      try {
        setReadingStep("Leyendo diseño y menú…");
        theme = (await postJson(API_READ, { url, part: "tema" })).theme as ShopifyThemeInfo;
      } catch (err) {
        notes.push(`No se pudo leer el diseño de la tienda: ${message(err)}`);
      }

      setParsed({ products, warnings, stats });
      setExtras({ storeUrl: resolvedUrl, collections, proposed, theme, notes });
      setOptions({
        products: true,
        collections: collections.length > 0 || Boolean(proposed),
        design: Boolean(theme && (theme.colors || theme.fonts || theme.logoUrl)),
      });
    } catch (err) {
      setParseError(message(err));
    } finally {
      setReadingStep(null);
    }
  }

  async function startImport() {
    if (!parsed) return;
    setPhase("importing");
    setProgress(0);
    setResults([]);
    setExtrasResult(null);
    const all: ImportResult[] = [];
    const byLink = source === "link" && extras !== null;
    const withCollections =
      byLink && options.collections && (extras.collections.length > 0 || extras.proposed !== null);
    // Con colecciones de verdad no se arma además una por Tipo de producto.
    const products = parsed.products.map((p) => (withCollections ? { ...p, collectionName: null } : p));

    if (!byLink || options.products) {
      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        try {
          const res = await fetch(API_IMPORT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ products: batch }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            all.push(...batch.map((p) => failed(p, body?.error ?? "No se pudo guardar este lote.")));
          } else {
            all.push(...(body.results as ImportResult[]));
          }
        } catch {
          all.push(...batch.map((p) => failed(p, "Sin conexión — este lote no se guardó.")));
        }
        setProgress(Math.min(products.length, i + BATCH_SIZE));
        setResults([...all]);
      }
    }

    if (byLink) {
      const result: ExtrasResult = { collections: null, menu: null, design: null, errors: [] };
      if (withCollections) {
        setExtraStep("Creando colecciones y menú…");
        try {
          const payload =
            extras.collections.length > 0
              ? extras.collections.map((c) => ({
                  handle: c.handle,
                  name: c.name,
                  description: c.description || null,
                  imageUrl: c.imageUrl,
                  sortOrder: c.sortOrder,
                  productHandles: c.productHandles,
                }))
              : extras.proposed!.collections.map((c) => ({
                  handle: slugify(c.name) || "coleccion",
                  name: c.name,
                  productHandles: c.productHandles,
                }));
          const body = await postJson(API_COLLECTIONS, {
            collections: payload,
            menu: { links: extras.theme?.menu ?? [], replace: true },
          });
          const rows = body.collections as { action: string; linked: number }[];
          result.collections = {
            created: rows.filter((r) => r.action === "created").length,
            updated: rows.filter((r) => r.action === "updated").length,
            errors: rows.filter((r) => r.action === "error").length,
            linked: rows.reduce((n, r) => n + r.linked, 0),
          };
          result.menu = body.menu;
        } catch (err) {
          result.errors.push(`Colecciones y menú: ${message(err)}`);
        }
      }
      if (options.design && extras.theme) {
        setExtraStep("Aplicando el diseño…");
        try {
          const t = extras.theme;
          result.design = await postJson(API_DESIGN, {
            colors: t.colors,
            fonts: t.fonts ? { headingFont: t.fonts.headingFont, bodyFont: t.fonts.bodyFont } : null,
            logoUrl: t.logoUrl,
            faviconUrl: t.faviconUrl,
            publish: true,
          });
        } catch (err) {
          result.errors.push(`Diseño: ${message(err)}`);
        }
      }
      setExtrasResult(result);
      setExtraStep(null);
    }

    setPhase("done");
    onImported();
  }

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const errors = results.filter((r) => r.action === "error");
  const reading = readingStep !== null;
  const theme = extras?.theme ?? null;
  const canImport =
    parsed !== null &&
    (source === "csv" ? parsed.products.length > 0 : options.products || options.collections || options.design);

  const importButtonLabel = (() => {
    if (!parsed) return "Importar";
    if (source === "csv" || !extras) return `Importar ${parsed.stats.products} productos`;
    const parts: string[] = [];
    if (options.products) parts.push(`${parsed.stats.products} productos`);
    if (options.collections && (extras.collections.length > 0 || extras.proposed)) parts.push("colecciones y menú");
    if (options.design && theme) parts.push("diseño");
    return parts.length ? `Importar ${parts.join(" + ")}` : "Importar";
  })();

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-ink">Importar desde Shopify</p>
        {phase !== "importing" && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-brand-ink-soft hover:underline"
          >
            {phase === "done" ? "Cerrar" : "Cancelar"}
          </button>
        )}
      </div>

      {phase === "pick" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["link", "Desde el link de tu tienda"],
                ["csv", "Desde el archivo CSV"],
              ] as [Source, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => switchSource(key)}
                disabled={reading}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  source === key
                    ? "bg-brand-ink text-white"
                    : "border border-brand-line text-brand-ink-soft hover:text-brand-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {source === "link" ? (
            <>
              <div className="text-xs text-brand-ink-soft space-y-1.5">
                <p>
                  Pega el link de tu tienda Shopify, con tu dominio propio o el de Shopify
                  (tumarca.myshopify.com). Leemos tu catálogo público: productos con sus precios,
                  variantes, SKU, peso y fotos; tus colecciones y en cuál va cada producto; el menú; y
                  el diseño (colores, letra, logo).
                </p>
                <p>
                  No trae los productos en borrador ni el inventario. Si tu tienda tiene contraseña,
                  usa el archivo CSV.
                </p>
              </div>
              <form
                className="flex flex-col sm:flex-row gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reading && storeUrl.trim()) void readStore();
                }}
              >
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  placeholder="https://tumarca.myshopify.com"
                  disabled={reading}
                  className="input flex-1"
                />
                <button
                  type="submit"
                  disabled={reading || !storeUrl.trim()}
                  className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
                >
                  {reading ? "Leyendo…" : "Leer la tienda"}
                </button>
              </form>
              {reading && <p className="text-xs text-brand-ink-soft">{readingStep}</p>}
            </>
          ) : (
            <>
              <div className="text-xs text-brand-ink-soft space-y-1.5">
                <p>
                  En Shopify ve a <strong>Productos → Exportar</strong>, elige{" "}
                  <strong>Todos los productos</strong> y el formato{" "}
                  <strong>CSV para Excel, Numbers u otros programas</strong>. Sube aquí
                  el archivo que te llega (products_export.csv).
                </p>
                <p>
                  Traemos nombre, descripción, precios, variantes, SKU, peso y fotos, y
                  armamos una colección por cada Tipo de producto. Si un producto ya se
                  importó antes, se actualiza en vez de duplicarse.
                </p>
              </div>

              <label className="block rounded-xl border border-dashed border-brand-line px-4 py-6 text-center text-sm text-brand-ink-soft cursor-pointer hover:bg-brand-accent-soft">
                {fileName ? (
                  <span className="text-brand-ink">{fileName}</span>
                ) : (
                  "Elegir el archivo CSV de productos"
                )}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </>
          )}

          {parseError && <p className="text-sm text-red-600">{parseError}</p>}

          {parsed && (
            <div className="space-y-3">
              {extras && (
                <p className="text-xs text-brand-ink-soft">
                  Leído de {extras.storeUrl}
                  {theme?.storeName ? ` (${theme.storeName})` : ""}. Marca lo que quieres traer:
                </p>
              )}

              <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                  {extras && (
                    <input
                      type="checkbox"
                      checked={options.products}
                      onChange={(e) => setOptions({ ...options, products: e.target.checked })}
                      className="mt-1"
                    />
                  )}
                  <span>
                    {parsed.stats.products} productos
                    {parsed.stats.withVariants > 0 && ` · ${parsed.stats.withVariants} con variantes`}
                    {` · ${parsed.stats.images} fotos`}
                  </span>
                </label>
                {parsed.stats.unknownStock > 0 && (
                  <p className="text-xs text-brand-ink-soft">
                    {source === "link"
                      ? "El link no trae cantidades de inventario, así que el stock queda sin definir: "
                      : "La exportación de Shopify no trae cantidades de inventario, así que el stock queda sin definir: "}
                    los productos sin variantes se venden sin control de stock, y las variantes
                    aparecen agotadas hasta que les pongas stock desde Editar.
                  </p>
                )}
                {parsed.stats.draft > 0 && (
                  <p className="text-xs text-brand-ink-soft">
                    {parsed.stats.draft} de estos productos están despublicados,
                    archivados o sin precio en Shopify: si son nuevos acá entran
                    como borrador (no se ven en la tienda hasta que los actives).
                  </p>
                )}
                <p className="text-xs text-brand-ink-soft">
                  Los productos que ya existen en Marcolini se actualizan (datos,
                  fotos, inventario) pero conservan su estado actual: si están
                  activos, siguen activos.
                </p>
                {parsed.warnings.length > 0 && (
                  <ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5">
                    {parsed.warnings.slice(0, 8).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                    {parsed.warnings.length > 8 && (
                      <li>y {parsed.warnings.length - 8} avisos más</li>
                    )}
                  </ul>
                )}
              </div>

              {extras && (extras.collections.length > 0 || extras.proposed) && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.collections}
                      onChange={(e) => setOptions({ ...options, collections: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      {extras.collections.length > 0
                        ? `${extras.collections.length} colecciones de Shopify y el menú`
                        : `${extras.proposed!.collections.length} categorías propuestas y el menú`}
                    </span>
                  </label>
                  {extras.collections.length === 0 && extras.proposed && (
                    <p className="text-xs text-brand-ink-soft">
                      Tu tienda no tiene colecciones en Shopify.{" "}
                      {extras.proposed.source === "ia"
                        ? "Las organizamos con inteligencia artificial a partir de los nombres, tipos y etiquetas de tus productos."
                        : "Las armamos a partir del tipo y el nombre de cada producto."}{" "}
                      Después puedes renombrarlas o mover productos en Colecciones.
                    </p>
                  )}
                  <ul className="text-xs text-brand-ink-soft space-y-0.5">
                    {(extras.collections.length > 0
                      ? extras.collections.map((c) => ({ name: c.name, count: c.productHandles.length }))
                      : extras.proposed!.collections.map((c) => ({ name: c.name, count: c.productHandles.length }))
                    )
                      .slice(0, 15)
                      .map((c) => (
                        <li key={c.name}>
                          {c.name} <span className="font-mono opacity-70">{c.count}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="text-xs text-brand-ink-soft">
                    {theme && theme.menu.length > 0
                      ? `Menú: ${theme.menu.map((m) => m.label).join(" · ")}.`
                      : "Menú: una entrada por colección."}{" "}
                    Reemplaza el menú actual de tu tienda. Los enlaces a páginas o blogs de Shopify no se traen.
                  </p>
                </div>
              )}

              {extras && theme && (theme.colors || theme.fonts || theme.logoUrl) && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.design}
                      onChange={(e) => setOptions({ ...options, design: e.target.checked })}
                      className="mt-1"
                    />
                    <span>Diseño: colores, letra y logo</span>
                  </label>
                  {theme.colors ? (
                    <div className="flex flex-wrap gap-3 text-xs text-brand-ink-soft">
                      {(
                        [
                          ["Fondo", theme.colors.fondo],
                          ["Texto", theme.colors.texto],
                          ["Botones", theme.colors.botones],
                          ["Principal", theme.colors.principal],
                        ] as [string, string][]
                      ).map(([label, hex]) => (
                        <span key={label} className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block w-5 h-5 rounded border border-brand-line"
                            style={{ background: hex }}
                          />
                          {label} <span className="font-mono">{hex}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-brand-ink-soft">No pudimos leer los colores de tu tema.</p>
                  )}
                  {theme.fonts ? (
                    <p className="text-xs text-brand-ink-soft">
                      Letra: títulos {theme.fonts.headingFont}
                      {!theme.fonts.headingExact && theme.fonts.headingFamily
                        ? ` (la más parecida a ${theme.fonts.headingFamily})`
                        : ""}{" "}
                      · cuerpo {theme.fonts.bodyFont}
                      {!theme.fonts.bodyExact && theme.fonts.bodyFamily
                        ? ` (la más parecida a ${theme.fonts.bodyFamily})`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-brand-ink-soft">No pudimos leer la letra de tu tema.</p>
                  )}
                  {theme.logoUrl ? (
                    <div className="flex items-center gap-3 text-xs text-brand-ink-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element -- logo leído de Shopify */}
                      <img src={theme.logoUrl} alt="Logo" className="h-10 w-auto max-w-[140px] object-contain" />
                      <span>Logo {theme.faviconUrl ? "y favicon" : ""} (si ya tienes uno, no se cambia)</span>
                    </div>
                  ) : (
                    <p className="text-xs text-brand-ink-soft">No encontramos el logo en la portada.</p>
                  )}
                  <p className="text-xs text-brand-ink-soft">
                    Los colores y la letra se aplican en Diseño y se publican de una vez en tu tienda.
                  </p>
                </div>
              )}

              {extras && extras.notes.length > 0 && (
                <ul className="text-xs text-amber-700 list-disc pl-4 space-y-0.5">
                  {extras.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={startImport}
            disabled={!canImport}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {importButtonLabel}
          </button>
        </>
      )}

      {phase === "importing" && parsed && (
        <div className="space-y-2">
          {extraStep ? (
            <p className="text-sm text-brand-ink">{extraStep}</p>
          ) : (
            <p className="text-sm text-brand-ink">
              Importando {progress} de {parsed.stats.products}…
            </p>
          )}
          <div className="h-2 rounded-full bg-brand-bg overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all"
              style={{
                width: `${
                  extraStep || parsed.stats.products === 0
                    ? 100
                    : Math.round((progress / parsed.stats.products) * 100)
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-brand-ink-soft">
            No cierres esta pantalla hasta que termine.
          </p>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-3">
          {(results.length > 0 || !extrasResult) && (
            <p className="text-sm text-brand-ink">
              Productos: {created} creados · {updated} actualizados
              {errors.length > 0 && ` · ${errors.length} con error`}
            </p>
          )}
          {errors.length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5 max-h-60 overflow-y-auto">
              {errors.map((r) => (
                <li key={r.handle}>
                  {r.name}: {r.error}
                </li>
              ))}
            </ul>
          )}
          {extrasResult?.collections && (
            <p className="text-sm text-brand-ink">
              Colecciones: {extrasResult.collections.created} nuevas · {extrasResult.collections.updated} ya
              existían · {extrasResult.collections.linked} productos ubicados
              {extrasResult.collections.errors > 0 && ` · ${extrasResult.collections.errors} con error`}
            </p>
          )}
          {extrasResult?.menu && (
            <p className="text-sm text-brand-ink">
              Menú: {extrasResult.menu.items} enlaces{extrasResult.menu.replaced ? " (reemplazó el anterior)" : ""}
            </p>
          )}
          {extrasResult?.design && (
            <p className="text-sm text-brand-ink">
              Diseño:{" "}
              {[
                extrasResult.design.colors ? "colores" : null,
                extrasResult.design.fonts ? "letra" : null,
              ]
                .filter(Boolean)
                .join(" y ") || "sin cambios"}
              {extrasResult.design.published ? " publicados" : ""} · logo{" "}
              {IMAGE_OUTCOME[extrasResult.design.logo] ?? extrasResult.design.logo}
              {extrasResult.design.favicon !== "omitido" &&
                ` · favicon ${IMAGE_OUTCOME[extrasResult.design.favicon] ?? extrasResult.design.favicon}`}
            </p>
          )}
          {extrasResult && extrasResult.errors.length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5">
              {extrasResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
            >
              Ver mis productos
            </button>
            {extrasResult?.collections && (
              <a href="/marca/tienda/colecciones" className="text-sm text-brand-ink-soft hover:underline">
                Ver colecciones
              </a>
            )}
            {extrasResult?.design && (
              <a href="/marca/tienda/diseno" className="text-sm text-brand-ink-soft hover:underline">
                Ver diseño
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
