"use client";

import { useState } from "react";
import {
  parseShopifyProductsCsv,
  ShopifyCsvError,
  type ShopifyCsvParseResult,
  type ShopifyCsvStats,
  type ShopifyImportProduct,
} from "@/lib/shopify-csv";
import { htmlToText, MAX_PAGES, PAGE_SIZE, type ShopifyImportCollection } from "@/lib/shopify-products-json";
import { PROFILE_FIELD_LABELS, type ExtractedProfile } from "@/lib/legal-extract";
import { needsIntegration } from "@/lib/payment-gateways";
import {
  POLICY_TITLES,
  type ShopifyHomeSection,
  type ShopifyMenuLink,
  type ShopifyPolicyKind,
  type ShopifyThemeInfo,
} from "@/lib/shopify-theme";
import { cleanCatalogTitles, cleanTitle } from "@/lib/store-titles";
import { CUSTOM_BLOCK_LAYOUT_LABEL } from "@/lib/storefront-sections";
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
  /// Razón social, NIT, dirección… leídos de las políticas.
  profile: ProfileRead | null;
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
  profile: boolean;
};

/// Datos del perfil leídos de las políticas y páginas (ver
/// brand-profile-extract-service.ts).
type ProfileRead = { fields: ExtractedProfile; source: "ia" | "reglas" };

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
  home: { created: number; skipped: number; errors: number; removed: number; basic: number } | null;
  design: DesignResult | null;
  shipping: { created: number; errors: number; removed: number; pendingPrice: number } | null;
  photos: RehostSummary | null;
  profile: { filled: string[] } | null;
  /// Pasarelas que Marcolini no tiene y por las que se avisó al equipo.
  gateways: string[] | null;
  errors: string[];
};

const BATCH_SIZE = 10;
const SHIPPING_BATCH = 11;
const API_READ = "/api/marca/tienda/productos/leer-shopify";
const API_READ_OTHER = "/api/marca/tienda/productos/leer-otra-tienda";
/// Pasos de lectura de una tienda que no es Shopify que van a la vez.
const OTHER_STORE_CONCURRENCY = 3;
const PLATFORM_LABEL: Record<StorePlatform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  tiendanube: "Tiendanube",
  ecometri: "Ecometri",
  generic: "otra plataforma",
};
const API_IMPORT = "/api/marca/tienda/productos/importar-shopify";
const API_COLLECTIONS = "/api/marca/tienda/colecciones/importar-shopify";
const API_DESIGN = "/api/marca/tienda/diseno/importar-shopify";
const API_SHIPPING = "/api/marca/tienda/envios/importar-shopify";
const API_PAGES = "/api/marca/tienda/paginas/importar-shopify";
const API_SECTIONS = "/api/marca/tienda/secciones/importar-shopify";
const API_HOME_COPY = "/api/marca/tienda/secciones/leer-portada";
const API_PROFILE_READ = "/api/marca/tienda/perfil/leer";
const API_PROFILE_IMPORT = "/api/marca/tienda/perfil/importar";
const API_GATEWAYS = "/api/marca/tienda/pagos/pasarelas";
/// Políticas que se buscan siempre, aunque la portada no las enlace.
const DEFAULT_POLICIES: ShopifyPolicyKind[] = ["shipping-policy", "refund-policy", "privacy-policy", "terms-of-service"];

const SECTION_LABEL: Record<ShopifyHomeSection["type"], string> = {
  BANNER: "Banner",
  FEATURED_COLLECTION: "Colección destacada",
  TEXT: "Texto",
  CATEGORY_GRID: "Categorías",
  CATEGORY_BANNERS: "Banners de categorías",
  VIDEO: "Video",
  FEATURED_PRODUCTS: "Productos destacados",
  NEW_PRODUCTS: "Productos nuevos",
  ON_SALE_PRODUCTS: "Productos en oferta",
  PRODUCT_CATALOG: "Catálogo de productos",
  IMAGE_CAROUSEL: "Galería de fotos",
  BRAND_CAROUSEL: "Marcas",
  INSTAGRAM_CTA: "Instagram",
  INFO_COLUMNS: "Columnas informativas",
  PROMO_BANNERS: "Banners promocionales",
  CUSTOM_BLOCK: "Bloque personalizado",
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
    case "CATEGORY_BANNERS":
      return `${SECTION_LABEL.CATEGORY_BANNERS} (${section.items.length})`;
    case "NEW_PRODUCTS":
    case "ON_SALE_PRODUCTS":
    case "PRODUCT_CATALOG":
      return `${SECTION_LABEL[section.type]}${section.title ? ` «${section.title}»` : ""}`;
    case "IMAGE_CAROUSEL":
      return `${SECTION_LABEL.IMAGE_CAROUSEL} (${section.images.length} fotos)`;
    case "BRAND_CAROUSEL":
      return `${SECTION_LABEL.BRAND_CAROUSEL} (${section.items.length})`;
    case "INSTAGRAM_CTA":
      return SECTION_LABEL.INSTAGRAM_CTA;
    case "PROMO_BANNERS":
      return `${SECTION_LABEL.PROMO_BANNERS} (${section.items.length})`;
    case "CUSTOM_BLOCK":
      return `${SECTION_LABEL.CUSTOM_BLOCK}${section.name ? ` «${section.name}»` : ""}: ${CUSTOM_BLOCK_LAYOUT_LABEL[section.layout].toLowerCase()}${
        section.items.length > 0 ? ` (${section.items.length})` : ""
      }`;
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
  if (!res.ok || !data?.ok) {
    throw Object.assign(new Error(data?.error ?? "No pudimos completar este paso. Intenta de nuevo."), { status: res.status });
  }
  return data;
}

/// Qué tan completa viene una lectura de un producto (para quedarse con la
/// mejor cuando el mismo producto llega por varios pasos).
function richness(p: ScrapedProduct) {
  return (p.hasVariants ? 4 : 0) + (p.description ? 2 : 0) + (p.images.length > 0 ? 1 : 0);
}

/// Un 422 del lector de otras tiendas es un motivo concreto ("no
/// encontramos productos", "no pudimos leer esa tienda de Ecometri"):
/// vale más mostrarlo que seguir como Shopify y terminar con el error
/// genérico de ese lector.
function isStoreReadRejection(err: unknown) {
  return err instanceof Error && (err as { status?: number }).status === 422;
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
///     fletes probando carritos (2026-10-18). Es una copia fiel: las
///     colecciones, el menú, la portada, los textos, la letra y los
///     colores quedan como en la tienda original, sin reorganizar nada
///     (pedido del 2026-10-19; el organizador vive aparte en Productos).
///     Es el camino por defecto porque no le pide nada a la marca.
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
  const [options, setOptions] = useState<ImportOptions>({
    products: true,
    pages: true,
    collections: true,
    home: true,
    design: true,
    shipping: true,
    photos: true,
    profile: true,
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

  /// Razón social, NIT, dirección, ciudad, correo, teléfono y descripción
  /// corta, leídos de las políticas y páginas de la tienda (ver
  /// brand-profile-extract-service.ts). null si no hay de dónde leer.
  async function readProfile(
    theme: ShopifyThemeInfo | null,
    pages: PageRead[],
    collections: ShopifyImportCollection[],
    notes: string[],
  ): Promise<ProfileRead | null> {
    const texts = pages
      .slice()
      .sort((a, b) => (a.kind === "policy" ? 0 : 1) - (b.kind === "policy" ? 0 : 1))
      .slice(0, 6)
      .map((p) => ({ title: p.title, text: htmlToText(p.body).slice(0, 60_000) }))
      .filter((t) => t.text.length > 40);
    if (texts.length === 0 && !theme?.metaDescription) return null;
    try {
      setReadingStep("Leyendo los datos de la marca en sus políticas…");
      const body = await postJson(API_PROFILE_READ, {
        storeName: theme?.storeName ?? null,
        metaDescription: theme?.metaDescription ?? null,
        announcements: theme?.announcements ?? [],
        categories: collections.map((c) => c.name).slice(0, 50),
        texts,
      });
      const fields = body.fields as ExtractedProfile;
      return Object.values(fields).some((v) => v) ? { fields, source: body.source } : null;
    } catch (err) {
      notes.push(`No se pudieron leer los datos de la marca: ${message(err)}`);
      return null;
    }
  }

  /// La portada copiada tal cual por la IA (ver secciones/leer-portada y
  /// home-copy.ts): mismas secciones, en el mismo orden, con sus textos,
  /// fotos y links; lo que no existe acá entra como Bloque personalizado.
  /// Sin IA, o si falla, queda la lectura por reglas del tema.
  async function readHomeFaithfully(url: string, theme: ShopifyThemeInfo | null, notes: string[]): Promise<ShopifyThemeInfo | null> {
    if (!theme) return theme;
    try {
      setReadingStep("Copiando la portada tal cual con IA…");
      const body = await postJson(API_HOME_COPY, { url, storeName: theme.storeName ?? null });
      const sections = body.sections as ShopifyHomeSection[] | null;
      if (sections && sections.length > 0) return { ...theme, homeSections: sections, homeSource: "ia" };
      if (body.reason === "sin-respuesta" || body.reason === "error") {
        notes.push("La IA no pudo copiar la portada: se usó la lectura automática de sus secciones.");
      }
    } catch (err) {
      notes.push(`No se pudo copiar la portada con IA (${message(err)}): se usó la lectura automática de sus secciones.`);
    }
    return { ...theme, homeSource: "reglas" };
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
      profile: null,
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
      profile: false,
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
          // El mismo producto puede llegar por varios pasos (en Ecometri,
          // en la lista completa, en cada colección y en su detalle): se
          // queda la versión más completa (variantes > descripción > fotos)
          // y se le suman las colecciones de las demás.
          for (const p of r.products) {
            const prev = byHandle.get(p.handle);
            if (!prev) {
              byHandle.set(p.handle, p);
              continue;
            }
            const [keep, other] = richness(p) > richness(prev) ? [p, prev] : [prev, p];
            for (const name of other.collectionNames) if (!keep.collectionNames.includes(name)) keep.collectionNames.push(name);
            if (!keep.description && other.description) keep.description = other.description;
            if (keep.images.length === 0 && other.images.length > 0) keep.images = other.images;
            byHandle.set(p.handle, keep);
          }
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
    // La foto de cada colección, cuando la plataforma la publica (Ecometri).
    for (const collection of collections) {
      const category = first.categories.find((c) => c.imageUrl && c.name.trim().toLowerCase() === collection.name.trim().toLowerCase());
      if (category?.imageUrl) collection.imageUrl = category.imageUrl;
    }
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
      // Los submenús se traducen igual; un padre sin equivalente acá pero
      // con submenú queda como "#" (solo abre el submenú).
      const translate = (links: ShopifyMenuLink[]): ShopifyMenuLink[] =>
        links.flatMap((link) => {
          const children = link.children ? translate(link.children) : [];
          const href = menuHrefToShopify(link.href, origin, pageHandles) ?? (children.length > 0 ? "#" : null);
          if (href === null) return [];
          return [children.length > 0 ? { label: link.label, href, children } : { label: link.label, href }];
        });
      const menu = translate(read.menu);
      theme = { ...read, menu, pageLinks: [], policyLinks: [] };
      // Lo que la plataforma publica de la tienda manda sobre lo que el
      // lector de la portada adivina: en Ecometri la página trae el logo
      // y las redes de Ecometri, no los de la marca.
      const info = first.storeInfo;
      if (info) {
        theme = {
          ...theme,
          storeName: info.name || theme.storeName,
          metaDescription: info.description || theme.metaDescription,
          logoUrl: info.logoUrl ?? theme.logoUrl,
          social:
            platform === "ecometri"
              ? { instagram: null, tiktok: null, facebook: null, email: null, phone: null, whatsapp: info.whatsapp }
              : { ...theme.social, whatsapp: info.whatsapp ?? theme.social.whatsapp },
        };
      }
    } catch (err) {
      notes.push(`No se pudo leer el diseño de la tienda: ${message(err)}`);
    }

    notes.unshift(
      `Esta tienda es ${PLATFORM_LABEL[platform]}: se leyeron los productos, sus categorías${pages.length > 0 ? `, ${pages.length} páginas (políticas, informativas y las armadas con el constructor)` : ""}${theme ? ", el diseño, el menú y la portada" : ""}. Los fletes solo se pueden leer de tiendas Shopify: configúralos en Envíos.`,
    );
    if (theme && !theme.colors) notes.push("No reconocimos los colores del tema: ajústalos en Diseño.");
    if (failedSteps > 0) notes.push(`${failedSteps} partes de la tienda no se pudieron leer.`);
    const noWeight = products.filter((p) => !p.weight && !p.variants.some((v) => v.weight)).length;
    if (noWeight > 0) notes.push(`${noWeight} productos sin peso (la tienda no lo publica): agrégalo desde Editar para que el envío se calcule bien.`);
    const currencies = Array.from(new Set(scraped.map((p) => p.currency).filter((c): c is string => Boolean(c) && c !== "COP")));
    if (currencies.length > 0) notes.push(`Los precios están en ${currencies.join(", ")}: se importan tal cual, sin convertir a pesos.`);
    // Copia fiel: las categorías son las de la tienda original, sin
    // inventar ni unir ninguna (pedido del 2026-10-19).
    if (collections.length === 0) notes.push("La tienda no muestra categorías: los productos entran sin colección, como en la original.");
    const cleaned = cleanCatalogTitles(products, collections, theme?.storeName);
    if (cleaned.suffix) notes.push(suffixNote(cleaned.suffix));
    const profileRead = await readProfile(theme, pages, cleaned.collections, notes);
    const homeTheme = await readHomeFaithfully(origin, theme, notes);
    setParsed({ products: cleaned.products, warnings, stats });
    setExtras({ storeUrl: origin, pages, collections: cleaned.collections, profile: profileRead, theme: homeTheme, shipping: null, notes });
    setOptions({
      products: true,
      pages: pages.length > 0,
      collections: collections.length > 0,
      home: Boolean(theme),
      design: Boolean(theme && (theme.colors || theme.fonts || theme.logoUrl)),
      shipping: false,
      photos: true,
      profile: Boolean(profileRead),
    });
  }

  /// Lee toda la tienda por el link: productos, colecciones, diseño, menú,
  /// portada y fletes, tal como están en la original. Cada pieza que falle
  /// después de los productos deja un aviso y no frena el resto.
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
      const detected = (await postJson(API_READ_OTHER, { origin: null, step: { step: "detect", url } }).catch((err) => {
        if (isStoreReadRejection(err)) throw err;
        return null;
      })) as ScanResult | null;
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

      if (collections.length === 0 && products.length > 0) {
        notes.push("La tienda no tiene colecciones en Shopify: los productos entran sin colección, como en la original.");
      }

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

      const profileRead = await readProfile(theme, pages, cleaned.collections, notes);

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
      const homeTheme = await readHomeFaithfully(resolvedUrl || url, theme, notes);
      setParsed({ products: cleaned.products, warnings, stats });
      setExtras({ storeUrl: resolvedUrl, pages, collections: cleaned.collections, profile: profileRead, theme: homeTheme, shipping, notes });
      setOptions({
        products: true,
        pages: pages.length > 0,
        collections: collections.length > 0,
        home: Boolean(theme),
        design: Boolean(theme && (theme.colors || theme.fonts || theme.logoUrl)),
        shipping: Boolean(shipping),
        // Siempre: también hay fotos en la portada y en las páginas.
        photos: true,
      profile: Boolean(profileRead),
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
    const withCollections = byLink && options.collections && extras.collections.length > 0;
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
      profile: null,
      gateways: null,
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

    // Las colecciones y el menú tal como están en la tienda original.
    if (byLink && withCollections) {
      setExtraStep("Creando colecciones y menú…");
      try {
        const payload = extras.collections.map((c) => ({
          handle: c.handle,
          name: c.name,
          description: c.description || null,
          imageUrl: c.imageUrl,
          sortOrder: c.sortOrder,
          productHandles: c.productHandles,
        }));
        const body = await postJson(API_COLLECTIONS, {
          collections: payload,
          menu: { links: extras.theme?.menu ?? [], replace: true },
          pageLinks,
        });
        const rows = body.collections as { handle: string; slug: string; action: string; linked: number }[];
        for (const row of rows) if (row.action !== "error" && row.slug) collectionSlugByHandle[row.handle] = row.slug;
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

    // La portada tal como se leyó. Si no se reconoció ninguna sección, el
    // servidor arma la básica (categorías, novedades y catálogo) para que
    // la tienda no quede con la página de inicio vacía.
    if (byLink && options.home && extras.theme) {
      setExtraStep("Armando la página de inicio…");
      try {
        const body = await postJson(API_SECTIONS, {
          sections: extras.theme.homeSections,
          replace: true,
          fillGaps: true,
          collectionSlugByHandle,
          pageSlugByHandle: Object.fromEntries(pageLinks.map((l) => [l.handle, l.slug])),
          // Los links de las páginas recién creadas que apuntaban a la
          // tienda vieja se reescriben hacia acá (ya existen productos,
          // colecciones y páginas).
          storeUrl: extras.storeUrl,
          relinkPages: pageLinks.length > 0,
          faithful: extras.theme.homeSource === "ia",
        });
        const rows = body.sections as { action: string }[];
        result.home = {
          created: rows.filter((r) => r.action === "created").length,
          skipped: rows.filter((r) => r.action === "skipped").length,
          errors: rows.filter((r) => r.action === "error").length,
          removed: body.removed as number,
          basic: (body.basic as number) ?? 0,
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

    if (byLink && options.profile && extras.profile) {
      setExtraStep("Guardando los datos de la marca…");
      try {
        const body = await postJson(API_PROFILE_IMPORT, { fields: extras.profile.fields });
        result.profile = { filled: body.filled as string[] };
      } catch (err) {
        result.errors.push(`Datos de la marca: ${message(err)}`);
      }
    }

    // Pasarela que no tenemos: se registra y se avisa al equipo de
    // Marcolini para construir la integración (ver
    // payment-gateway-request-service.ts). No depende de ninguna opción.
    const missingGateways = (extras?.theme?.payments.gateways ?? []).filter(needsIntegration);
    if (byLink && missingGateways.length > 0) {
      try {
        const body = await postJson(API_GATEWAYS, { gateways: missingGateways, source: "DUPLICAR" });
        result.gateways = body.recorded as string[];
      } catch (err) {
        result.errors.push(`Pasarelas: ${message(err)}`);
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
          pendingPrice: (body.pendingPrice as number) ?? 0,
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
  /// Las colecciones de la tienda original, tal cual se importan.
  const chosenCollections: { name: string; count: number }[] = extras
    ? extras.collections.map((c) => ({ name: c.name, count: c.productHandles.length }))
    : [];
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
    if (options.collections && extras.collections.length > 0) parts.push("colecciones y menú");
    if (options.home && theme) parts.push("portada");
    if (options.profile && extras?.profile) parts.push("datos de la marca");
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
                  También funciona con WooCommerce, Tiendanube, Ecometri o cualquier otra tienda: de esas se
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

              {extras && extras.collections.length > 0 && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.collections}
                      onChange={(e) => setOptions({ ...options, collections: e.target.checked })}
                      className="mt-1"
                    />
                    <span>{chosenCollections.length} colecciones y el menú, como en la tienda original</span>
                  </label>
                  <ul className="text-xs text-brand-ink-soft space-y-0.5">
                    {chosenCollections.slice(0, 20).map((c) => (
                      <li key={c.name}>
                        {c.name} <span className="font-mono opacity-70">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-brand-ink-soft">
                    {theme && theme.menu.length > 0
                      ? `Menú: ${theme.menu
                          .map((m) => (m.children && m.children.length > 0 ? `${m.label} (${m.children.length} en el submenú)` : m.label))
                          .join(" · ")}.`
                      : "Menú: una entrada por colección."}{" "}
                    Reemplaza el menú actual de tu tienda. Los enlaces a blogs de Shopify no se traen.
                  </p>
                </div>
              )}

              {extras && theme && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.home}
                      onChange={(e) => setOptions({ ...options, home: e.target.checked })}
                      className="mt-1"
                    />
                    <span>
                      {theme.homeSections.length > 0
                        ? `${theme.homeSections.length} ${theme.homeSections.length === 1 ? "sección" : "secciones"} de la portada${
                            theme.homeSource === "ia" ? ", copiadas tal cual con IA" : ""
                          }`
                        : "Portada básica"}
                    </span>
                  </label>
                  {theme.homeSections.length > 0 ? (
                    <ul className="text-xs text-brand-ink-soft space-y-0.5">
                      {theme.homeSections.map((section, i) => (
                        <li key={i}>{sectionSummary(section)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-brand-ink-soft">
                      No reconocimos las secciones de la portada de esta tienda, así que se arma una página de inicio
                      básica: tus categorías, las novedades y el catálogo completo.
                    </p>
                  )}
                  <p className="text-xs text-brand-ink-soft">
                    Se arma en Diseño → Página de inicio igual a la original, con sus textos y fotos y con tus colecciones y
                    productos ya importados. Lo que no existe en Marcolini entra como «Bloque personalizado», con sus colores, y
                    se edita ahí como cualquier otra sección. Reemplaza las secciones actuales de tu página de inicio.
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

              {extras?.profile && (
                <div className="rounded-xl border border-brand-line bg-brand-bg p-4 space-y-2">
                  <label className="flex items-start gap-2 text-sm font-medium text-brand-ink">
                    <input
                      type="checkbox"
                      checked={options.profile}
                      onChange={(e) => setOptions({ ...options, profile: e.target.checked })}
                      className="mt-1"
                    />
                    <span>Datos de la marca para el perfil</span>
                  </label>
                  <ul className="text-xs text-brand-ink-soft space-y-0.5">
                    {(Object.keys(PROFILE_FIELD_LABELS) as (keyof ExtractedProfile)[])
                      .filter((key) => extras.profile!.fields[key])
                      .map((key) => (
                        <li key={key}>
                          <span className="text-brand-ink">{PROFILE_FIELD_LABELS[key]}:</span> {extras.profile!.fields[key]}
                        </li>
                      ))}
                  </ul>
                  <p className="text-xs text-brand-ink-soft">
                    {extras.profile.source === "ia"
                      ? "Leídos con inteligencia artificial de las políticas y páginas de la tienda. "
                      : "Leídos de las políticas y páginas de la tienda. "}
                    Se guardan en Perfil solo los campos que estén vacíos; el correo no se toca y el sitio web queda con el
                    link de la tienda en Marcolini.
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
                  {theme.payments.gateways.some(needsIntegration) && (
                    <p className="text-xs text-amber-700">
                      Marcolini no tiene {theme.payments.gateways.filter(needsIntegration).join(" ni ")}: al importar se le avisa al
                      equipo para construir la integración.
                    </p>
                  )}
                  <p className="text-xs text-brand-ink-soft">
                    En Marcolini la tienda cobra con la cuenta propia de la marca en Wompi, Mercado Pago, PayU,
                    ePayco o Bold. La marca pega sus llaves en Configuración → Pagos de la tienda.
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
                          {base
                            ? base.pendingPrice
                              ? `${base.name} (contraentrega: Marcolini no lo permite, queda sin precio para que la marca ponga el suyo)`
                              : base.price === 0
                                ? "envío gratis"
                                : `${base.name} ${cop(base.price)}`
                            : ""}
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
              {extrasResult.home.basic > 0
                ? "Portada: no reconocimos la de la tienda, así que se armó una básica (categorías, novedades y catálogo)"
                : `Portada: ${extrasResult.home.created} secciones creadas, como en la tienda original`}
              {extrasResult.home.removed > 0 && ` (reemplazaron ${extrasResult.home.removed})`}
              {extrasResult.home.skipped > 0 && ` · ${extrasResult.home.skipped} sin su colección o producto`}
              {extrasResult.home.errors > 0 && ` · ${extrasResult.home.errors} con error`}
              {extrasResult.home.created === 0 && extrasResult.home.basic === 0 && " · revisa Diseño → Página de inicio"}
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
          {extrasResult?.profile && (
            <p className="text-sm text-brand-ink">
              Datos de la marca:{" "}
              {extrasResult.profile.filled.length > 0
                ? `guardados ${extrasResult.profile.filled
                    .map((f) => PROFILE_FIELD_LABELS[f as keyof ExtractedProfile] ?? (f === "websiteUrl" ? "sitio web" : f))
                    .join(", ")}`
                : "el perfil ya tenía todo, no se cambió nada"}
            </p>
          )}
          {extrasResult?.gateways && extrasResult.gateways.length > 0 && (
            <p className="text-sm text-brand-ink">
              Pasarelas: avisamos al equipo de Marcolini que la marca cobra con {extrasResult.gateways.join(" y ")}.
            </p>
          )}
          {extrasResult?.shipping && (
            <p className="text-sm text-brand-ink">
              Envíos: {extrasResult.shipping.created} zonas creadas
              {extrasResult.shipping.removed > 0 && ` (reemplazaron ${extrasResult.shipping.removed})`}
              {extrasResult.shipping.errors > 0 && ` · ${extrasResult.shipping.errors} con error`}
              {extrasResult.shipping.pendingPrice > 0 &&
                ` · ${extrasResult.shipping.pendingPrice} ${extrasResult.shipping.pendingPrice === 1 ? "tarifa venía" : "tarifas venían"} como contraentrega (no se permite): la marca tiene que ponerle precio en Envíos`}
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
