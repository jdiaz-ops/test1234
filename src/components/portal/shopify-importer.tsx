"use client";

import { useState } from "react";
import {
  parseShopifyProductsCsv,
  ShopifyCsvError,
  type ShopifyCsvParseResult,
  type ShopifyCsvStats,
  type ShopifyImportProduct,
} from "@/lib/shopify-csv";
import { MAX_PAGES, PAGE_SIZE } from "@/lib/shopify-products-json";

type ImportResult = {
  handle: string;
  name: string;
  action: "created" | "updated" | "error";
  error?: string;
};

type Source = "link" | "csv";

const BATCH_SIZE = 10;

function failed(product: ShopifyImportProduct, error: string): ImportResult {
  return { handle: product.handle, name: product.name, action: "error", error };
}

/// Importar el catálogo completo desde Shopify — la marca no vuelve a
/// escribir producto por producto. Dos caminos que terminan en la misma
/// lista (ShopifyImportProduct) y el mismo envío por lotes a
/// /api/marca/tienda/productos/importar-shopify:
///   · Por el link de la tienda (2026-10-17): el servidor lee el catálogo
///     público página por página (ver shopify-store-reader.ts). Es el
///     camino por defecto porque no le pide nada a la marca.
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
  const [storeDomain, setStoreDomain] = useState<string | null>(null);
  const [readingPage, setReadingPage] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ShopifyCsvParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"pick" | "importing" | "done">("pick");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);

  function switchSource(next: Source) {
    setSource(next);
    setParsed(null);
    setParseError(null);
    setStoreDomain(null);
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

  async function readStore() {
    setParsed(null);
    setParseError(null);
    setStoreDomain(null);
    const products: ShopifyImportProduct[] = [];
    const seen = new Set<string>();
    const warnings: string[] = [];
    const stats: ShopifyCsvStats = { products: 0, withVariants: 0, images: 0, unknownStock: 0, draft: 0 };
    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        setReadingPage(page);
        const res = await fetch("/api/marca/tienda/productos/leer-shopify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: storeUrl, page }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? "No pudimos leer la tienda. Intenta de nuevo.");
        }
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
        setStoreDomain(body.storeUrl as string);
        if (!body.hasMore) break;
        if (page === MAX_PAGES) {
          warnings.push(
            `La tienda tiene más de ${MAX_PAGES * PAGE_SIZE} productos: se leyeron los primeros ${products.length}. Para el resto, usa el CSV.`,
          );
        }
      }
      // El link nunca trae cantidades de inventario.
      stats.unknownStock = stats.products;
      setParsed({ products, warnings, stats });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "No pudimos leer la tienda. Intenta de nuevo.");
    } finally {
      setReadingPage(null);
    }
  }

  async function startImport() {
    if (!parsed) return;
    setPhase("importing");
    setProgress(0);
    const all: ImportResult[] = [];
    const products = parsed.products;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch("/api/marca/tienda/productos/importar-shopify", {
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
    setPhase("done");
    onImported();
  }

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const errors = results.filter((r) => r.action === "error");
  const reading = readingPage !== null;

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
                  (tumarca.myshopify.com). Leemos tu catálogo público: nombre, descripción, precios,
                  variantes, SKU, peso y fotos, y armamos una colección por cada Tipo de producto.
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
                  {reading ? `Leyendo… página ${readingPage}` : "Leer la tienda"}
                </button>
              </form>
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
            <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
              <p className="text-sm font-medium text-brand-ink">
                {parsed.stats.products} productos listos para importar
                {parsed.stats.withVariants > 0 && ` · ${parsed.stats.withVariants} con variantes`}
                {` · ${parsed.stats.images} fotos`}
              </p>
              {storeDomain && source === "link" && (
                <p className="text-xs text-brand-ink-soft">Leídos de {storeDomain}</p>
              )}
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
          )}

          <button
            type="button"
            onClick={startImport}
            disabled={!parsed || parsed.products.length === 0}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {parsed ? `Importar ${parsed.stats.products} productos` : "Importar"}
          </button>
        </>
      )}

      {phase === "importing" && parsed && (
        <div className="space-y-2">
          <p className="text-sm text-brand-ink">
            Importando {progress} de {parsed.stats.products}…
          </p>
          <div className="h-2 rounded-full bg-brand-bg overflow-hidden">
            <div
              className="h-full bg-brand-accent transition-all"
              style={{ width: `${Math.round((progress / parsed.stats.products) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-brand-ink-soft">
            No cierres esta pantalla hasta que termine.
          </p>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-3">
          <p className="text-sm text-brand-ink">
            Listo: {created} creados · {updated} actualizados
            {errors.length > 0 && ` · ${errors.length} con error`}
          </p>
          {errors.length > 0 && (
            <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5 max-h-60 overflow-y-auto">
              {errors.map((r) => (
                <li key={r.handle}>
                  {r.name}: {r.error}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={onClose}
            className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90"
          >
            Ver mis productos
          </button>
        </div>
      )}
    </div>
  );
}
