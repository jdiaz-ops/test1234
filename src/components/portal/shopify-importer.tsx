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
import {
  POLICY_TITLES,
  type ShopifyHomeSection,
  type ShopifyPolicyKind,
  type ShopifyThemeInfo,
} from "@/lib/shopify-theme";
import { menuForProposal, type MergeProposal } from "@/lib/collection-merge";
import { cleanCatalogTitles, cleanTitle } from "@/lib/store-titles";
import {
  buildShippingZones,
  type ProposedShippingZone,
  type RatesByRegion,
  type ThresholdResult,
} from "@/lib/shopify-shipping";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import { rehostAllImages, type RehostSummary } from "@/lib/rehost-images-client";
import {
  categoriesToCollections,
  menuHrefToShopify,
  toShopifyImport,
  type ScrapedProduct,
  type StorePlatform,
} from "@/lib/store-scrape";
import type { ScanResult, ScanStep } from "@/server/services/other-store-reader";
import { CatalogFilesReader, type FilesRead } from "@/components/portal/catalog-files-reader";

type ImportResult = {
  handle: string;
  name: string;
  action: "created" | "updated" | "error";
  error?: string;
};

type Source = "link" | "csv" | "files";

type ProbeVariant = { variantId: number; unitPrice: number; productName: string };

/// Fletes leídos probando carritos (ver shopify-shipping.ts).
type ShippingRead = {
  variant: ProbeVariant;
  subtotal: number;
  rates: RatesByRegion;
  errors: Record<string, string>;
  thresholds: Record<string, ThresholdResult | null>;
  zones: ProposedShippingZone[];
  uncovered: string[];
};

/// Una página o política leída de Shopify, lista para crearse.
type PageRead = { handle: string; title: string; body: string; kind: "page" | "policy"; chars: number };

/// Lo que se leyó de la tienda además de los productos (solo por link).
type LinkExtras = {
  storeUrl: string;
  pages: PageRead[];
  collections: ShopifyImportCollection[];
  /// Categorías propuestas cuando Shopify no tiene colecciones.
  proposed: { collections: ProposedCollection[]; source: "ia" | "reglas" } | null;
  /// Menos colecciones cuando la tienda trae de más (ver
  /// collection-merge.ts); la administradora elige en la vista previa.
  merge: MergeProposal | null;
  theme: ShopifyThemeInfo | null;
  shipping: ShippingRead | null;
  /// Avisos de lectura (algo que no se pudo leer y se siguió sin eso).
  notes: string[];
};

type ImportOptions = {
  products: boolean;
  pages: boolean;
  collections: boolean;
  home: boolean;
  design: boolean;
  shipping: boolean;
  photos: boolean;
};

type DesignResult = {
  colors: boolean;
  fonts: boolean;
  announcements: boolean;
  published: boolean;
  logo: string;
  favicon: string;
  profileFields: string[];
};

type ExtrasResult = {
  pages: { created: number; existing: number; errors: number; footerEnabled: boolean } | null;
  collections: { created: number; updated: number; errors: number; linked: number } | null;
  menu: { items: number; replaced: boolean } | null;
  home: { created: number; skipped: number; errors: number; removed: number } | null;
  design: DesignResult | null;
  shipping: { created: number; errors: number; removed: number } | null;
  photos: RehostSummary | null;
  errors: string[];
};

const BATCH_SIZE = 10;
const PROPOSE_BATCH = 150;
const SHIPPING_BATCH = 11;
const API_READ = "/api/marca/tienda/productos/leer-shopify";
const API_READ_OTHER = "/api/marca/tienda/productos/leer-otra-tienda";
/// Pasos de lectura de una tienda que no es Shopify que van a la vez.
const OTHER_STORE_CONCURRENCY = 3;
const PLATFORM_LABEL: Record<StorePlatform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  tiendanube: "Tiendanube",
  generic: "otra plataforma",
};
const API_IMPORT = "/api/marca/tienda/productos/importar-shopify";
const API_PROPOSE = "/api/marca/tienda/colecciones/proponer";
const API_REORGANIZE = "/api/marca/tienda/colecciones/reorganizar";
const API_COLLECTIONS = "/api/marca/tienda/colecciones/importar-shopify";
const API_DESIGN = "/api/marca/tienda/diseno/importar-shopify";
const API_SHIPPING = "/api/marca/tienda/envios/importar-shopify";
const API_PAGES = "/api/marca/tienda/paginas/importar-shopify";
const API_SECTIONS = "/api/marca/tienda/secciones/importar-shopify";
/// Políticas que se buscan siempre, aunque la portada no las enlace.
const DEFAULT_POLICIES: ShopifyPolicyKind[] = ["shipping-policy", "refund-policy", "privacy-policy", "terms-of-service"];

const SECTION_LABEL: Record<ShopifyHomeSection["type"], string> = {
  BANNER: "Banner",
  FEATURED_COLLECTION: "Colección destacada",
  TEXT: "Texto",
  CATEGORY_GRID: "Categorías",
  VIDEO: "Video",
  FEATURED_PRODUCTS: "Productos destacados",
  INFO_COLUMNS: "Columnas informativas",
};

function sectionSummary(section: ShopifyHomeSection) {
  switch (section.type) {
    case "BANNER":
      return `${SECTION_LABEL.BANNER}${section.title ? ` «${section.title}»` : ""} (${section.images.length} ${section.images.length === 1 ? "foto" : "fotos"})`;
    case "FEATURED_COLLECTION":
      return `${SECTION_LABEL.FEATURED_COLLECTION}: ${section.title || section.collectionHandle}`;
    case "TEXT":
      return `${SECTION_LABEL.TEXT}${section.heading ? ` «${section.heading}»` : ""}`;
    case "CATEGORY_GRID":
      return `${SECTION_LABEL.CATEGORY_GRID} (${section.items.length})`;
    case "VIDEO":
      return SECTION_LABEL.VIDEO;
    case "FEATURED_PRODUCTS":
      return `${SECTION_LABEL.FEATURED_PRODUCTS} (${section.productHandles.length})`;
    case "INFO_COLUMNS":
      return `${SECTION_LABEL.INFO_COLUMNS} (${section.items.length})`;
  }
}

function textLength(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/// Aviso cuando los títulos traían el nombre de la tienda (ver store-titles.ts).
function suffixNote(suffix: string) {
  return `Los títulos traían el nombre de la tienda al final («${suffix}»), como texto para Google: se quitó de los nombres.`;
}

function failed(product: ShopifyImportProduct, error: string): ImportResult {
  return { handle: product.handle, name: product.name, action: "error", error };
}

function message(err: unknown) {
  return err instanceof Error ? err.message : "Algo falló. Intenta de nuevo.";
}

function cop(value: number) {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
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
  omitido: "no se encontró en la tienda",
  error: "no se pudo subir",
};

const PROFILE_FIELD_LABEL: Record<string, string> = {
  metaPixelId: "píxel de Meta",
  tiktokPixelId: "píxel de TikTok",
  googleAnalyticsId: "Google Analytics",
  instagramHandle: "Instagram",
  tiktokHandle: "TikTok",
  phone: "teléfono",
};

/// Importar la tienda completa desde Shopify — la marca no vuelve a
/// escribir nada. Dos caminos que terminan en la misma lista de productos
/// (ShopifyImportProduct) y el mismo envío por lotes a
/// /api/marca/tienda/productos/importar-shopify:
///   · Por el link de la tienda (2026-10-17): el servidor lee el catálogo
///     público página por página (ver shopify-store-reader.ts) y, de
///     paso, las colecciones con sus productos, el menú, el diseño
///     (colores, letra, logo, píxeles, redes, barra de anuncio) y los
///     fletes probando carritos (2026-10-18). Si la tienda no tiene
///     colecciones, se proponen categorías (ver
///     shopify-categorize-service.ts). Es el camino por defecto porque no
///     le pide nada a la marca: la tienda queda armada.
///   · Por el CSV exportado desde Shopify, leído acá en el navegador (ver
///     shopify-csv.ts). Sirve cuando la tienda tiene contraseña o hay
///     productos en borrador que el link no trae.
/// En los dos, al final las fotos se copian a Marcolini (ver
/// image-rehost-service.ts) para que nada dependa de Shopify. Los dos
/// usan el mismo id por handle, así repetir actualiza en vez de duplicar.
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
  /// Con una propuesta para unir colecciones: cuál se importa.
  const [collectionChoice, setCollectionChoice] = useState<"original" | "proposed">("proposed");
  const [options, setOptions] = useState<ImportOptions>({
    products: true,
    pages: true,
    collections: true,
    home: true,
    design: true,
    shipping: true,
    photos: true,
  });
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
      const read = parseShopifyProductsCsv(text);
      const cleaned = cleanCatalogTitles(read.products, []);
      if (cleaned.suffix) read.warnings.push(suffixNote(cleaned.suffix));
      setParsed({ ...read, products: cleaned.products });
    } catch (err) {
      setParseError(
        err instanceof ShopifyCsvError
          ? err.message
          : "No se pudo leer el archivo — revisa que sea el CSV exportado desde Shopify.",
      );
    }
  }

  /// Propone categorías (con IA o con reglas, ver
  /// shopify-categorize-service.ts) para una tienda que no tiene: en
  /// Shopify, cuando no hay colecciones; en otras plataformas, cuando no
  /// muestran categorías.
  async function proposeCategories(
    products: ShopifyImportProduct[],
    notes: string[],
    emptyNote: string,
  ): Promise<LinkExtras["proposed"]> {
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
      if (list.length > 0) return { collections: list, source: aiSource };
      notes.push(emptyNote);
    } catch (err) {
      notes.push(`No pudimos proponer categorías: ${message(err)}`);
    }
    return null;
  }

  /// Cuando la tienda trae colecciones de más (una por color, repetidas…)
  /// se propone unirlas (ver collection-merge.ts); la administradora elige
  /// en la vista previa. null si no hay nada que simplificar.
  async function proposeMerge(
    collections: ShopifyImportCollection[],
    products: ShopifyImportProduct[],
    notes: string[],
  ): Promise<MergeProposal | null> {
    if (collections.length < 2) return null;
    try {
      setReadingStep("Revisando si las colecciones se pueden simplificar…");
      const nameByHandle = new Map(products.map((p) => [p.handle, p.name]));
      const body = await postJson(API_REORGANIZE, {
        collections: collections.map((c) => ({
          handle: c.handle,
          name: c.name,
          productHandles: c.productHandles,
          sampleNames: c.productHandles
            .slice(0, 3)
            .map((h) => nameByHandle.get(h))
            .filter((n): n is string => Boolean(n)),
        })),
      });
      return (body.proposal as MergeProposal | null) ?? null;
    } catch (err) {
      notes.push(`No se pudo revisar si las colecciones se pueden simplificar: ${message(err)}`);
      return null;
    }
  }

  /// Lo leído de los archivos de una marca sin web (catalog-files-reader.tsx)
  /// entra a la misma vista previa que el link.
  function handleFilesRead(read: FilesRead) {
    setParseError(null);
    setParsed(read.parsed);
    setExtras({
      storeUrl: "los archivos de la marca",
      pages: [],
      collections: read.collections,
      proposed: null,
      merge: null,
      theme: read.theme,
      shipping: null,
      notes: read.notes,
    });
    setOptions({
      products: true,
      pages: false,
      collections: read.collections.length > 0,
      home: false,
      design: Boolean(read.theme && (read.theme.colors || read.theme.logoUrl)),
      shipping: false,
      photos: false,
    });
  }

  /// Tienda que no es Shopify (WooCommerce, Tiendanube o cualquier otra,
  /// ver other-store-reader.ts): se leen productos y categorías por pasos
  /// y se convierten al mismo shape que lo de Shopify, así la importación
  /// (productos, colecciones, fotos a Marcolini) es la misma. También se
  /// leen el diseño, el menú y las páginas informativas de la portada; los
  /// fletes no (solo Shopify deja consultarlos desde afuera).
  async function readOtherStore(first: ScanResult) {
    const origin = first.origin;
    const byHandle = new Map<string, ScrapedProduct>();
    const warnings = [...first.warnings];
    const queue: ScanStep[] = [...first.next];
    let platform = first.platform;
    let failedSteps = 0;
    let done = 0;
    let total = queue.length;
    async function worker() {
      while (queue.length > 0) {
        const step = queue.shift()!;
        try {
          const r = (await postJson(API_READ_OTHER, { origin, step })) as ScanResult;
          for (const p of r.products) if (!byHandle.has(p.handle)) byHandle.set(p.handle, p);
          if (platform === "generic" && r.platform !== "generic") platform = r.platform;
          warnings.push(...r.warnings);
          queue.push(...r.next);
          total += r.next.length;
        } catch {
          failedSteps++;
        }
        done++;
        setReadingStep(
          `Leyendo productos de ${PLATFORM_LABEL[platform]}… ${byHandle.size} encontrados (${done} de ${total})`,
        );
      }
    }
    // Un paso puede traer más pasos mientras los otros trabajan: se repite
    // hasta que la cola quede vacía de verdad.
    while (queue.length > 0) {
      await Promise.all(Array.from({ length: OTHER_STORE_CONCURRENCY }, worker));
    }

    const scraped = Array.from(byHandle.values());
    if (scraped.length === 0) throw new Error("No pudimos leer ningún producto de esa tienda.");
    const products = scraped.map(toShopifyImport);
    const stats = emptyStats();
    for (const p of products) {
      stats.products++;
      stats.images += p.images.length;
      if (p.hasVariants) stats.withVariants++;
      if (p.status === "DRAFT") stats.draft++;
    }
    stats.unknownStock = products.filter((p) => p.stock == null || p.hasVariants).length;
    const collections = categoriesToCollections(scraped);
    const notes: string[] = [];

    // Páginas informativas (envíos, cambios, privacidad, quiénes somos…).
    const pages: PageRead[] = [];
    for (const [i, link] of first.infoPages.entries()) {
      setReadingStep(`Leyendo páginas y políticas… ${i + 1} de ${first.infoPages.length}`);
      try {
        const body = (await postJson(API_READ_OTHER, { origin, step: { step: "page", url: link.url } })) as ScanResult;
        const html = body.page?.bodyHtml ?? "";
        if (textLength(html) > 0) {
          pages.push({ handle: link.handle, title: body.page?.title || link.label, body: html, kind: link.kind, chars: textLength(html) });
        }
      } catch {
        // Una página que no se pudo leer no frena el resto.
      }
    }

    // Diseño, menú, redes y píxeles: el lector de la portada sirve para
    // cualquier tienda. El menú se traduce a la forma de Shopify para que
    // la importación del menú lo entienda; las páginas y políticas de
    // Shopify (/pages, /policies) no aplican acá.
    let theme: ShopifyThemeInfo | null = null;
    try {
      setReadingStep("Leyendo diseño, menú y redes…");
      const read = (await postJson(API_READ, { url: origin, part: "tema" })).theme as ShopifyThemeInfo;
      const pageHandles = new Set(pages.map((p) => p.handle));
      const menu = read.menu
        .map((link) => ({ ...link, href: menuHrefToShopify(link.href, origin, pageHandles) }))
        .filter((link): link is { label: string; href: string } => link.href !== null);
      theme = { ...read, menu, pageLinks: [], policyLinks: [] };
    } catch (err) {
      notes.push(`No se pudo leer el diseño de la tienda: ${message(err)}`);
    }

    notes.unshift(
      `Esta tienda es ${PLATFORM_LABEL[platform]}: se leyeron los productos, sus categorías${pages.length > 0 ? ", las páginas informativas" : ""}${theme ? ", el diseño y el menú" : ""}. Los fletes solo se pueden leer de tiendas Shopify: configúralos en Envíos.`,
    );
    if (theme && !theme.colors) notes.push("No reconocimos los colores del tema: ajústalos en Diseño.");
    if (failedSteps > 0) notes.push(`${failedSteps} partes de la tienda no se pudieron leer.`);
    const noWeight = products.filter((p) => !p.weight && !p.variants.some((v) => v.weight)).length;
    if (noWeight > 0) notes.push(`${noWeight} productos sin peso (la tienda no lo publica): agrégalo desde Editar para que el envío se calcule bien.`);
    const currencies = Array.from(new Set(scraped.map((p) => p.currency).filter((c): c is string => Boolean(c) && c !== "COP")));
    if (currencies.length > 0) notes.push(`Los precios están en ${currencies.join(", ")}: se importan tal cual, sin convertir a pesos.`);
    const proposed =
      collections.length === 0
        ? await proposeCategories(products, notes, "La tienda no muestra categorías y no pudimos proponerlas: los productos entran sin colección.")
        : null;
    const cleaned = cleanCatalogTitles(products, collections, theme?.storeName);
    if (cleaned.suffix) notes.push(suffixNote(cleaned.suffix));
    const merge = await proposeMerge(cleaned.collections, cleaned.products, notes);
    setParsed({ products: cleaned.products, warnings, stats });
    setExtras({ storeUrl: origin, pages, collections: cleaned.collections, proposed, merge, theme, shipping: null, notes });
    setCollectionChoice(merge ? "proposed" : "original");
    setOptions({
      products: true,
      pages: pages.length > 0,
      collections: collections.length > 0 || Boolean(proposed),
      home: Boolean(theme && theme.homeSections.length > 0),
      design: Boolean(theme && (theme.colors || theme.fonts || theme.logoUrl)),
      shipping: false,
      photos: true,
    });
  }

  /// Lee toda la tienda por el link: productos, colecciones (o propone
  /// categorías), diseño y menú, y fletes. Cada pieza que falle después de
  /// los productos deja un aviso y no frena el resto.
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
      // ¿Es Shopify? Si no, va por el lector de otras plataformas. Si esta
      // revisión falla, se sigue como Shopify (su lector explica el error).
      setReadingStep("Revisando la tienda…");
      const detected = (await postJson(API_READ_OTHER, { origin: null, step: { step: "detect", url } }).catch(
        () => null,
      )) as ScanResult | null;
      if (detected && detected.platform !== "shopify") {
        await readOtherStore(detected);
        return;
      }

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

      const proposed =
        collections.length === 0 && products.length > 0
          ? await proposeCategories(
              products,
              notes,
              "Shopify no tiene colecciones y no pudimos proponer categorías: los productos entran sin colección.",
            )
          : null;

      let theme: ShopifyThemeInfo | null = null;
      try {
        setReadingStep("Leyendo diseño, menú y pagos…");
        theme = (await postJson(API_READ, { url, part: "tema" })).theme as ShopifyThemeInfo;
      } catch (err) {
        notes.push(`No se pudo leer el diseño de la tienda: ${message(err)}`);
      }

      // Nombres sin el "| Tienda" que muchas ponen para Google (ver store-titles.ts).
      const cleaned = cleanCatalogTitles(products, collections, theme?.storeName);
      if (cleaned.suffix) notes.push(suffixNote(cleaned.suffix));
      // ¿Colecciones de más? Se propone unirlas (ver collection-merge.ts).
      const merge = await proposeMerge(cleaned.collections, cleaned.products, notes);

      // Páginas enlazadas en la portada y políticas (las de siempre se
      // buscan aunque no estén enlazadas; Shopify responde 404 si no hay).
      const pages: PageRead[] = [];
      if (theme) {
        try {
          const links = theme.pageLinks.slice(0, 15);
          const policies = Array.from(new Set<ShopifyPolicyKind>([...theme.policyLinks, ...DEFAULT_POLICIES]));
          const total = links.length + policies.length;
          let n = 0;
          for (const pageLink of links) {
            n++;
            setReadingStep(`Leyendo páginas y políticas… ${n} de ${total}`);
            const body = await postJson(API_READ, { url, part: "pagina", handle: pageLink.handle });
            const html = String(body.bodyHtml ?? "");
            if (body.found && textLength(html) > 0) {
              pages.push({ handle: pageLink.handle, title: String(body.title || pageLink.label), body: html, kind: "page", chars: textLength(html) });
            }
          }
          for (const policy of policies) {
            n++;
            setReadingStep(`Leyendo páginas y políticas… ${n} de ${total}`);
            const body = await postJson(API_READ, { url, part: "politica", policy });
            const html = String(body.bodyHtml ?? "");
            if (body.found && textLength(html) > 0) {
              pages.push({ handle: policy, title: String(body.title || POLICY_TITLES[policy]), body: html, kind: "policy", chars: textLength(html) });
            }
          }
        } catch (err) {
          notes.push(`No se pudieron leer las páginas: ${message(err)}`);
        }
      }

      let shipping: ShippingRead | null = null;
      try {
        const regions = [...COLOMBIA_REGIONS];
        const rates: RatesByRegion = {};
        const errors: Record<string, string> = {};
        let variant: ProbeVariant | null = null;
        let subtotal = 0;
        for (let i = 0; i < regions.length; i += SHIPPING_BATCH) {
          setReadingStep(
            `Probando fletes con un carrito… ${Math.min(i + SHIPPING_BATCH, regions.length)} de ${regions.length} departamentos`,
          );
          const body = await postJson(API_READ, {
            url,
            part: "envios",
            step: "tarifas",
            regions: regions.slice(i, i + SHIPPING_BATCH),
            variant,
          });
          variant = body.variant as ProbeVariant;
          subtotal = body.subtotal as number;
          Object.assign(rates, body.rates as RatesByRegion);
          Object.assign(errors, body.errors as Record<string, string>);
        }
        // Envío gratis: se busca en un departamento por cada precio
        // distinto (hasta 3), subiendo la cantidad del carrito.
        const thresholds: Record<string, ThresholdResult | null> = {};
        if (variant) {
          const byPrice = new Map<number, string>();
          for (const [region, list] of Object.entries(rates)) {
            if (list.length > 0 && list[0].price > 0 && !byPrice.has(list[0].price)) byPrice.set(list[0].price, region);
          }
          const representatives = Array.from(byPrice.values()).slice(0, 3);
          const maxQuantity = Math.max(1, Math.min(40, Math.ceil(600_000 / variant.unitPrice)));
          for (const [k, region] of representatives.entries()) {
            if (maxQuantity <= 1) break;
            setReadingStep(`Buscando desde cuánto es gratis el envío… ${k + 1} de ${representatives.length}`);
            try {
              thresholds[region] = (await postJson(API_READ, {
                url,
                part: "envios",
                step: "umbral",
                region,
                variant,
                maxQuantity,
              })) as ThresholdResult;
            } catch (err) {
              notes.push(`No se pudo probar el envío gratis en ${region}: ${message(err)}`);
            }
          }
        }
        const built = buildShippingZones(rates, thresholds);
        if (variant && built.zones.length > 0) {
          shipping = { variant, subtotal, rates, errors, thresholds, zones: built.zones, uncovered: built.uncovered };
        } else {
          notes.push("No se pudieron leer los fletes de Shopify: ningún departamento devolvió tarifa.");
        }
      } catch (err) {
        notes.push(`No se pudieron leer los fletes: ${message(err)}`);
      }

      if (shipping) {
        shipping = { ...shipping, variant: { ...shipping.variant, productName: cleanTitle(shipping.variant.productName, cleaned.suffix) } };
      }
      setParsed({ products: cleaned.products, warnings, stats });
      setExtras({ storeUrl: resolvedUrl, pages, collections: cleaned.collections, proposed, merge, theme, shipping, notes });
      setCollectionChoice(merge ? "proposed" : "original");
      setOptions({
        products: true,
        pages: pages.length > 0,
        collections: collections.length > 0 || Boolean(proposed),
        home: Boolean(theme && theme.homeSections.length > 0),
        design: Boolean(theme && (theme.colors || theme.fonts || theme.logoUrl)),
        shipping: Boolean(shipping),
        // Siempre: también hay fotos en la portada y en las páginas.
        photos: true,
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
    // "Desde archivos" también deja extras (colecciones y diseño) y sigue
    // el mismo camino que el link.
    const byLink = source !== "csv" && extras !== null;
    const withCollections =
      byLink && options.collections && (extras.collections.length > 0 || extras.proposed !== null);
    // Con colecciones de verdad no se arma además una por Tipo de producto.
    const products = parsed.products.map((p) => (withCollections ? { ...p, collectionName: null } : p));
    const importProducts = !byLink || options.products;

    if (importProducts) {
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

    const result: ExtrasResult = {
      pages: null,
      collections: null,
      menu: null,
      home: null,
      design: null,
      shipping: null,
      photos: null,
      errors: [],
    };
    const pageLinks: { handle: string; slug: string }[] = [];
    const collectionSlugByHandle: Record<string, string> = {};

    if (byLink && options.pages && extras.pages.length > 0) {
      setExtraStep("Creando páginas y políticas…");
      try {
        const body = await postJson(API_PAGES, {
          pages: extras.pages.map((p) => ({ handle: p.handle, title: p.title.slice(0, 100), body: p.body, kind: p.kind })),
        });
        const rows = body.pages as { handle: string; slug: string; action: string }[];
        for (const row of rows) if (row.action !== "error" && row.slug) pageLinks.push({ handle: row.handle, slug: row.slug });
        result.pages = {
          created: rows.filter((r) => r.action === "created").length,
          existing: rows.filter((r) => r.action === "existing").length,
          errors: rows.filter((r) => r.action === "error").length,
          footerEnabled: Boolean(body.footerEnabled),
        };
      } catch (err) {
        result.errors.push(`Páginas: ${message(err)}`);
      }
    }

    // Con la propuesta elegida se crean las colecciones unidas; las
    // originales de cada grupo apuntan a la unida en el menú y la portada.
    const merge = byLink && extras.merge && collectionChoice === "proposed" ? extras.merge : null;
    if (byLink && withCollections) {
      setExtraStep("Creando colecciones y menú…");
      try {
        const sourceByHandle = new Map(extras.collections.map((c) => [c.handle, c]));
        const payload = merge
          ? merge.collections.map((m) => {
              const first = sourceByHandle.get(m.sourceHandles[0]);
              const single = m.sourceHandles.length === 1 ? first : undefined;
              return {
                handle: m.handle,
                name: m.name,
                description: single?.description || null,
                imageUrl: first?.imageUrl ?? null,
                sortOrder: single?.sortOrder ?? "MANUAL",
                productHandles: m.productHandles,
              };
            })
          : extras.collections.length > 0
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
        const menuLinks = merge ? menuForProposal(extras.theme?.menu ?? [], merge) : (extras.theme?.menu ?? []);
        // Los links viejos de las colecciones unidas también deben llegar
        // a la colección nueva (ver storefront-redirect-service.ts).
        const aliases = merge
          ? Object.fromEntries(
              merge.collections
                .filter((m) => m.sourceHandles.some((h) => h !== m.handle))
                .map((m) => [m.handle, m.sourceHandles.filter((h) => h !== m.handle)]),
            )
          : undefined;
        const body = await postJson(API_COLLECTIONS, {
          collections: payload,
          menu: { links: menuLinks, replace: true },
          pageLinks,
          aliases,
        });
        const rows = body.collections as { handle: string; slug: string; action: string; linked: number }[];
        for (const row of rows) if (row.action !== "error" && row.slug) collectionSlugByHandle[row.handle] = row.slug;
        if (merge) {
          for (const m of merge.collections) {
            const slug = collectionSlugByHandle[m.handle];
            if (slug) for (const h of m.sourceHandles) collectionSlugByHandle[h] = slug;
          }
        }
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

    if (byLink && options.home && extras.theme && extras.theme.homeSections.length > 0) {
      setExtraStep("Armando la página de inicio…");
      try {
        const body = await postJson(API_SECTIONS, {
          sections: extras.theme.homeSections,
          replace: true,
          collectionSlugByHandle,
          pageSlugByHandle: Object.fromEntries(pageLinks.map((l) => [l.handle, l.slug])),
        });
        const rows = body.sections as { action: string }[];
        result.home = {
          created: rows.filter((r) => r.action === "created").length,
          skipped: rows.filter((r) => r.action === "skipped").length,
          errors: rows.filter((r) => r.action === "error").length,
          removed: body.removed as number,
        };
      } catch (err) {
        result.errors.push(`Portada: ${message(err)}`);
      }
    }

    if (byLink && options.design && extras.theme) {
      setExtraStep("Aplicando el diseño y los datos de la marca…");
      try {
        const t = extras.theme;
        result.design = (await postJson(API_DESIGN, {
          colors: t.colors,
          fonts: t.fonts ? { headingFont: t.fonts.headingFont, bodyFont: t.fonts.bodyFont } : null,
          logoUrl: t.logoUrl,
          faviconUrl: t.faviconUrl,
          pixels: {
            metaPixelId: t.pixels.metaPixelId,
            tiktokPixelId: t.pixels.tiktokPixelId,
            googleAnalyticsId: t.pixels.googleAnalyticsId,
          },
          social: {
            instagram: t.social.instagram,
            tiktok: t.social.tiktok,
            whatsapp: t.social.whatsapp,
            phone: t.social.phone,
          },
          announcements: t.announcements,
          publish: true,
        })) as DesignResult;
      } catch (err) {
        result.errors.push(`Diseño: ${message(err)}`);
      }
    }

    if (byLink && options.shipping && extras.shipping) {
      setExtraStep("Configurando las zonas de envío…");
      try {
        const body = await postJson(API_SHIPPING, { zones: extras.shipping.zones, replace: true });
        const rows = body.zones as { action: string }[];
        result.shipping = {
          created: rows.filter((r) => r.action === "created").length,
          errors: rows.filter((r) => r.action === "error").length,
          removed: body.removed as number,
        };
      } catch (err) {
        result.errors.push(`Envíos: ${message(err)}`);
      }
    }

    if (!byLink || options.photos) {
      setExtraStep("Guardando las fotos en Marcolini…");
      try {
        result.photos = await rehostAllImages((p) =>
          setExtraStep(`Guardando las fotos en Marcolini… ${p.done} de ${p.total}`),
        );
      } catch (err) {
        result.errors.push(`Fotos: ${message(err)}`);
      }
    }

    setExtrasResult(result);
    setExtraStep(null);
    setPhase("done");
    onImported();
  }

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const errors = results.filter((r) => r.action === "error");
  const reading = readingStep !== null;
  const theme = extras?.theme ?? null;
  /// Lo que se ve (y se importa) en el bloque de colecciones: la propuesta
  /// elegida, las de la tienda, o las categorías propuestas si no tenía.
  const chosenCollections: { name: string; count: number; merges: string[] }[] = !extras
    ? []
    : extras.merge && collectionChoice === "proposed"
      ? extras.merge.collections.map((m) => ({
          name: m.name,
          count: m.productHandles.length,
          merges:
            m.sourceHandles.length > 1
              ? m.sourceHandles.map((h) => extras.collections.find((c) => c.handle === h)?.name ?? h)
              : [],
        }))
      : extras.collections.length > 0
        ? extras.collections.map((c) => ({ name: c.name, count: c.productHandles.length, merges: [] }))
        : (extras.proposed?.collections ?? []).map((c) => ({ name: c.name, count: c.productHandles.length, merges: [] }));
  const shipping = extras?.shipping ?? null;
  const canImport =
    parsed !== null &&
    (source === "csv"
      ? parsed.products.length > 0
      : options.products || options.pages || options.collections || options.home || options.design || options.shipping);

  const importButtonLabel = (() => {
    if (!parsed) return "Importar";
    if (source === "csv" || !extras) return `Importar ${parsed.stats.products} productos`;
    const parts: string[] = [];
    if (options.products) parts.push(`${parsed.stats.products} productos`);
    if (options.pages && extras.pages.length > 0) parts.push("páginas");
    if (options.collections && (extras.collections.length > 0 || extras.proposed)) parts.push("colecciones y menú");
    if (options.home && theme && theme.homeSections.length > 0) parts.push("portada");
    if (options.design && theme) parts.push("diseño");
    if (options.shipping && shipping) parts.push("envíos");
    return parts.length ? `Importar ${parts.join(" + ")}` : "Importar";
  })();

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-brand-ink">Duplicar tienda</p>
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
                ["files", "Desde archivos (sin web)"],
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
                  variantes, SKU, peso y fotos; tus colecciones y en cuál va cada producto; el menú;
                  el diseño (colores, letra, logo); la portada; tus páginas y políticas; los medios de
                  pago; y los fletes, probando un carrito por cada departamento. Las fotos se copian a
                  Marcolini.
                </p>
                <p>
                  También funciona con WooCommerce, Tiendanube o cualquier otra tienda: de esas se
                  traen los productos (precios, variantes, SKU, peso y fotos), sus categorías, el
                  diseño, el menú y las páginas informativas. Los fletes solo se leen de Shopify.
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
          ) : source === "files" ? (
            <CatalogFilesReader
              onRead={handleFilesRead}
              handedOff={parsed !== null}
              onEdit={() => {
                setParsed(null);
                setExtras(null);
              }}
            />
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
                  importó antes, se actualiza en vez de duplicarse. Las fotos se copian a
                  Marcolini al terminar.
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
                      : source === "files"
                        ? "Los archivos no dicen cuántas unidades hay, así que el stock queda sin definir: "
                        : "La exportación de Shopify no trae cantidades de inventario, así que el stock queda sin definir: "}
                    los productos sin variantes se venden sin control de stock, y las variantes
                    también se venden sin control hasta que les pongas inventario desde Editar.
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
                {extras && (
                  <label className="flex items-start gap-2 text-xs text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.photos}
                      onChange={(e) => setOptions({ ...options, photos: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span>
                      Guardar en Marcolini las fotos de productos
                      {parsed.stats.images > 0 ? ` (${parsed.stats.images})` : ""}, portada y páginas. Quedan en
                      nuestro servidor para que nada se rompa si la marca cierra su Shopify.
                    </span>
                  </label>
                )}
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

              {extras && extras.pages.length > 0 && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.pages}
                      onChange={(e) => setOptions({ ...options, pages: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      {plural(extras.pages.filter((p) => p.kind === "page").length, "página", "páginas")} y{" "}
                      {plural(extras.pages.filter((p) => p.kind === "policy").length, "política", "políticas")}
                    </span>
                  </label>
                  <ul className="text-xs text-brand-ink-soft space-y-0.5">
                    {extras.pages.slice(0, 20).map((p) => (
                      <li key={`${p.kind}-${p.handle}`}>
                        {p.title} <span className="font-mono opacity-70">{p.chars.toLocaleString("es-CO")} caracteres</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-brand-ink-soft">
                    Entran como Páginas y se enlazan en la columna «Información» del pie de página. Las que ya
                    existan no se tocan.
                  </p>
                </div>
              )}

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
                        ? `${chosenCollections.length} colecciones y el menú`
                        : `${extras.proposed!.collections.length} categorías propuestas y el menú`}
                    </span>
                  </label>
                  {extras.merge && (
                    <div className="space-y-1.5 text-sm">
                      <p className="text-xs text-brand-ink-soft">
                        Varias colecciones parecen ser la misma categoría. Elige cómo dejarlas en tu tienda:
                      </p>
                      <label className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="collection-choice"
                          checked={collectionChoice === "proposed"}
                          onChange={() => setCollectionChoice("proposed")}
                          className="mt-1"
                        />
                        <span>
                          <span className="font-medium text-brand-ink">Propuesta de Marcolini ({extras.merge.collections.length})</span>{" "}
                          <span className="text-xs text-brand-ink-soft">
                            {extras.merge.source === "ia"
                              ? "· organizada con inteligencia artificial"
                              : "· unimos las colecciones pequeñas que empiezan igual"}
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="collection-choice"
                          checked={collectionChoice === "original"}
                          onChange={() => setCollectionChoice("original")}
                          className="mt-1"
                        />
                        <span className="font-medium text-brand-ink">Como está en la tienda ({extras.collections.length})</span>
                      </label>
                    </div>
                  )}
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
                    {chosenCollections.slice(0, 20).map((c) => (
                      <li key={c.name}>
                        {c.name} <span className="font-mono opacity-70">{c.count}</span>
                        {c.merges.length > 1 && <span className="block pl-3 opacity-80">une: {c.merges.join(" · ")}</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-brand-ink-soft">
                    {theme && theme.menu.length > 0
                      ? `Menú: ${(extras.merge && collectionChoice === "proposed" ? menuForProposal(theme.menu, extras.merge) : theme.menu)
                          .map((m) => m.label)
                          .join(" · ")}.`
                      : "Menú: una entrada por colección."}{" "}
                    Reemplaza el menú actual de tu tienda. Los enlaces a blogs de Shopify no se traen.
                  </p>
                </div>
              )}

              {extras && theme && theme.homeSections.length > 0 && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.home}
                      onChange={(e) => setOptions({ ...options, home: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      {theme.homeSections.length} {theme.homeSections.length === 1 ? "sección" : "secciones"} de la portada
                    </span>
                  </label>
                  <ul className="text-xs text-brand-ink-soft space-y-0.5">
                    {theme.homeSections.map((section, i) => (
                      <li key={i}>{sectionSummary(section)}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-brand-ink-soft">
                    Se arman en Diseño → Página de inicio con tus colecciones y productos ya importados. Reemplaza
                    las secciones actuales de tu página de inicio.
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
                    <span>Diseño y datos de la marca</span>
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
                  {theme.announcements.length > 0 && (
                    <p className="text-xs text-brand-ink-soft">
                      Barra de anuncio: {theme.announcements.map((t) => `«${t}»`).join(" · ")}
                    </p>
                  )}
                  {(theme.pixels.metaPixelId || theme.pixels.tiktokPixelId || theme.pixels.googleAnalyticsId) && (
                    <p className="text-xs text-brand-ink-soft">
                      Píxeles:{" "}
                      {[
                        theme.pixels.metaPixelId ? `Meta ${theme.pixels.metaPixelId}` : null,
                        theme.pixels.tiktokPixelId ? `TikTok ${theme.pixels.tiktokPixelId}` : null,
                        theme.pixels.googleAnalyticsId ? `Google Analytics ${theme.pixels.googleAnalyticsId}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {(theme.social.instagram || theme.social.tiktok || theme.social.whatsapp || theme.social.phone) && (
                    <p className="text-xs text-brand-ink-soft">
                      Redes y contacto:{" "}
                      {[
                        theme.social.instagram ? `Instagram @${theme.social.instagram}` : null,
                        theme.social.tiktok ? `TikTok @${theme.social.tiktok}` : null,
                        theme.social.whatsapp ? `WhatsApp +${theme.social.whatsapp}` : null,
                        !theme.social.whatsapp && theme.social.phone ? `Teléfono ${theme.social.phone}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-brand-ink-soft">
                    Los colores, la letra y la barra de anuncio se aplican en Diseño y se publican de una vez.
                    Píxeles, redes y teléfono se guardan solo si estaban vacíos.
                  </p>
                </div>
              )}

              {extras && theme && (theme.payments.methods.length > 0 || theme.payments.gateways.length > 0) && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-1.5">
                  <p className="text-sm font-medium text-brand-ink">Pagos (solo informativo)</p>
                  {theme.payments.methods.length > 0 && (
                    <p className="text-xs text-brand-ink-soft">
                      Medios que muestra hoy: {theme.payments.methods.join(", ")}.
                    </p>
                  )}
                  {theme.payments.gateways.length > 0 && (
                    <p className="text-xs text-brand-ink-soft">
                      Pasarelas detectadas: {theme.payments.gateways.join(", ")}.
                    </p>
                  )}
                  <p className="text-xs text-brand-ink-soft">
                    En Marcolini la tienda cobra con Wompi (tarjetas, PSE, Nequi y Bancolombia). La marca
                    pega sus llaves en Configuración → Pagos de la tienda.
                  </p>
                </div>
              )}

              {extras && shipping && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.shipping}
                      onChange={(e) => setOptions({ ...options, shipping: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      {shipping.zones.length} {shipping.zones.length === 1 ? "zona de envío" : "zonas de envío"}
                    </span>
                  </label>
                  <p className="text-xs text-brand-ink-soft">
                    Probamos un carrito con «{shipping.variant.productName}» ({cop(shipping.subtotal)}) en los 33
                    departamentos y Shopify respondió:
                  </p>
                  <ul className="text-xs text-brand-ink-soft space-y-0.5">
                    {shipping.zones.map((zone) => {
                      const base = zone.rates.find((r) => r.condition === "NONE");
                      const free = zone.rates.find((r) => r.condition === "MIN_ORDER_AMOUNT");
                      return (
                        <li key={zone.name}>
                          <strong className="font-medium text-brand-ink">{zone.name}:</strong>{" "}
                          {base ? (base.price === 0 ? "envío gratis" : `${base.name} ${cop(base.price)}`) : ""}
                          {free?.conditionValue ? ` · gratis desde ${cop(free.conditionValue)}` : ""}
                          {zone.otherRates.length > 0 &&
                            ` (también ofrecía ${zone.otherRates.map((r) => `${r.name} ${cop(r.price)}`).join(", ")})`}
                        </li>
                      );
                    })}
                  </ul>
                  {Object.values(shipping.thresholds).some((t) => t?.threshold != null && t.paidBelow != null) && (
                    <p className="text-xs text-brand-ink-soft">
                      El umbral exacto del envío gratis está entre el último carrito que pagó envío y el primero
                      que salió gratis (
                      {Object.entries(shipping.thresholds)
                        .filter(([, t]) => t?.threshold != null && t.paidBelow != null)
                        .map(([region, t]) => `${region}: ${cop(t!.paidBelow!)} a ${cop(t!.threshold!)}`)
                        .join("; ")}
                      ). Configuramos el valor seguro; ajústalo en Envíos si la marca te confirma otro.
                    </p>
                  )}
                  {shipping.uncovered.length > 0 && (
                    <p className="text-xs text-amber-700">
                      Shopify no ofrece envío a: {shipping.uncovered.join(", ")}. Esos departamentos quedan sin zona.
                    </p>
                  )}
                  {Object.keys(shipping.errors).length > 0 && (
                    <p className="text-xs text-amber-700">
                      No se pudo leer la tarifa de {Object.keys(shipping.errors).length}{" "}
                      {Object.keys(shipping.errors).length === 1 ? "departamento" : "departamentos"} (
                      {Object.keys(shipping.errors).slice(0, 5).join(", ")}
                      {Object.keys(shipping.errors).length > 5 ? "…" : ""}).
                    </p>
                  )}
                  <p className="text-xs text-brand-ink-soft">Reemplaza las zonas de envío actuales de tu tienda.</p>
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

          {/* En "Desde archivos" el botón aparece cuando ya se revisó la tabla. */}
          {(source !== "files" || parsed) && (
            <button
              type="button"
              onClick={startImport}
              disabled={!canImport}
              className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {importButtonLabel}
            </button>
          )}
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
          {results.length > 0 && (
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
          {extrasResult?.pages && (
            <p className="text-sm text-brand-ink">
              Páginas: {extrasResult.pages.created} nuevas · {extrasResult.pages.existing} ya existían
              {extrasResult.pages.errors > 0 && ` · ${extrasResult.pages.errors} con error`}
              {extrasResult.pages.footerEnabled && " · enlazadas en el pie de página"}
            </p>
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
          {extrasResult?.home && (
            <p className="text-sm text-brand-ink">
              Portada: {extrasResult.home.created} secciones creadas
              {extrasResult.home.removed > 0 && ` (reemplazaron ${extrasResult.home.removed})`}
              {extrasResult.home.skipped > 0 && ` · ${extrasResult.home.skipped} sin su colección o producto`}
              {extrasResult.home.errors > 0 && ` · ${extrasResult.home.errors} con error`}
            </p>
          )}
          {extrasResult?.design && (
            <p className="text-sm text-brand-ink">
              Diseño:{" "}
              {[
                extrasResult.design.colors ? "colores" : null,
                extrasResult.design.fonts ? "letra" : null,
                extrasResult.design.announcements ? "barra de anuncio" : null,
              ]
                .filter(Boolean)
                .join(", ") || "sin cambios"}
              {extrasResult.design.published ? " (publicado)" : ""} · logo{" "}
              {IMAGE_OUTCOME[extrasResult.design.logo] ?? extrasResult.design.logo}
              {extrasResult.design.favicon !== "omitido" &&
                ` · favicon ${IMAGE_OUTCOME[extrasResult.design.favicon] ?? extrasResult.design.favicon}`}
              {extrasResult.design.profileFields.length > 0 &&
                ` · guardados: ${extrasResult.design.profileFields.map((f) => PROFILE_FIELD_LABEL[f] ?? f).join(", ")}`}
            </p>
          )}
          {extrasResult?.shipping && (
            <p className="text-sm text-brand-ink">
              Envíos: {extrasResult.shipping.created} zonas creadas
              {extrasResult.shipping.removed > 0 && ` (reemplazaron ${extrasResult.shipping.removed})`}
              {extrasResult.shipping.errors > 0 && ` · ${extrasResult.shipping.errors} con error`}
            </p>
          )}
          {extrasResult?.photos && (
            <p className="text-sm text-brand-ink">
              Fotos: {extrasResult.photos.saved} guardadas en Marcolini
              {extrasResult.photos.failed.length > 0 &&
                ` · ${extrasResult.photos.failed.length} no se pudieron copiar (esos productos quedaron sin esa foto)`}
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
            {extrasResult?.pages && (
              <a href="/marca/tienda/paginas" className="text-sm text-brand-ink-soft hover:underline">
                Ver páginas
              </a>
            )}
            {(extrasResult?.design || extrasResult?.home) && (
              <a href="/marca/tienda/diseno" className="text-sm text-brand-ink-soft hover:underline">
                Ver diseño
              </a>
            )}
            {extrasResult?.shipping && (
              <a href="/marca/tienda/envios" className="text-sm text-brand-ink-soft hover:underline">
                Ver envíos
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
