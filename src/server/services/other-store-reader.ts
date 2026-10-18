import { gunzipSync } from "zlib";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { extractPageContent } from "@/lib/shopify-theme";
import {
  categoryNameFromUrl,
  detectPlatformFromHtml,
  isCategorySitemap,
  isCategoryUrl,
  isProductSitemap,
  isProductUrl,
  MAX_PRODUCTS,
  parseProductPage,
  parseSitemap,
  parseWooProduct,
  extractInfoPageLinks,
  sitemapsFromRobots,
  type InfoPageLink,
  type ScrapedProduct,
  type StorePlatform,
  type WooStoreProduct,
} from "@/lib/store-scrape";
import { safeFetch, safeFetchJson, safeFetchText, SafeFetchError } from "@/server/integrations/safe-fetch";

/// Lee una tienda que NO es Shopify (WooCommerce, Tiendanube o cualquier
/// otra) para el importador por link (shopify-importer.tsx), por pasos
/// cortos para que ningún request se pase del tiempo máximo de una función
/// de Vercel: el navegador pide un paso a la vez (detectar la plataforma,
/// una página de productos de WooCommerce, un lote de páginas de
/// producto…) y cada respuesta trae los pasos que siguen. Solo lee: lo
/// leído entra por el mismo camino que lo de Shopify (importar-shopify,
/// colecciones, fotos alojadas en Marcolini).
///
/// Si el paso "detectar" encuentra una tienda Shopify, responde
/// platform = "shopify" sin más pasos: esa la lee shopify-store-reader.ts.

export class OtherStoreError extends Error {}

export type ScanStep =
  | { step: "detect"; url: string }
  | { step: "woo-products"; page: number; base: string }
  | { step: "pages"; urls: string[] }
  | { step: "page"; url: string };

export type ScanCategory = { name: string; url: string | null };

export type ScanResult = {
  origin: string;
  platform: StorePlatform;
  storeName: string;
  products: ScrapedProduct[];
  categories: ScanCategory[];
  /// Páginas informativas enlazadas en la portada (solo en "detect").
  infoPages: InfoPageLink[];
  /// Contenido de una página informativa (solo en el paso "page").
  page: { title: string | null; bodyHtml: string } | null;
  /// Pasos que el navegador debe pedir después de este.
  next: ScanStep[];
  warnings: string[];
};

const WOO_PAGE_SIZE = 20;
const PAGES_PER_STEP = 6;
const MAX_SITEMAPS = 25;
const MAX_CATEGORY_PAGES_TO_CRAWL = 20;

function emptyResult(origin: string, platform: StorePlatform): ScanResult {
  return { origin, platform, storeName: "", products: [], categories: [], infoPages: [], page: null, next: [], warnings: [] };
}

/// "mitienda.com", "https://mitienda.com/collections/x" → "https://mitienda.com".
export function normalizeStoreUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new OtherStoreError("Escribe la dirección de la tienda.");
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) throw new Error();
    return url.origin;
  } catch {
    throw new OtherStoreError("Esa dirección no es válida — ej. https://mitienda.com");
  }
}

function sameSite(url: string, origin: string) {
  try {
    const a = new URL(url).hostname.replace(/^www\./, "");
    const b = new URL(origin).hostname.replace(/^www\./, "");
    return a === b;
  } catch {
    return false;
  }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function storeNameFromHtml(html: string, origin: string) {
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const raw = og ?? title?.split(/[|–—-]/)[0] ?? new URL(origin).hostname;
  return decodeHtmlEntities(raw).trim().slice(0, 120);
}

// ---------------------------------------------------------------------------
// Detectar plataforma
// ---------------------------------------------------------------------------

async function detect(input: string): Promise<ScanResult> {
  let origin = normalizeStoreUrl(input);
  const home = await safeFetchText(origin).catch((err) => {
    throw new OtherStoreError(err instanceof SafeFetchError ? err.message : "No pudimos abrir esa tienda.");
  });
  // Si mitienda.com redirige a www.mitienda.com, se sigue con la final.
  origin = new URL(home.url).origin;
  const html = home.text ?? "";
  if (home.text == null) {
    throw new OtherStoreError(`La tienda respondió con un error (${home.status}). Revisa la dirección.`);
  }
  const storeName = storeNameFromHtml(html, origin);
  const hinted = detectPlatformFromHtml(html);

  // Shopify: /products.json existe en toda tienda Shopify, incluso con
  // dominio propio — se prueba siempre, no solo cuando el HTML lo sugiere.
  const shopify = await safeFetchJson(`${origin}/products.json?limit=1`).catch(() => null);
  if (shopify && Array.isArray((shopify as { products?: unknown }).products)) {
    return { ...emptyResult(origin, "shopify"), storeName };
  }

  // WooCommerce: la Store API, con enlaces "bonitos" o sin ellos.
  for (const base of [`${origin}/wp-json/wc/store/v1`, `${origin}/?rest_route=/wc/store/v1`]) {
    const sep = base.includes("?") ? "&" : "?";
    const probe = await safeFetchJson(`${base}/products${sep}per_page=1`).catch(() => null);
    if (!Array.isArray(probe)) continue;
    const result: ScanResult = { ...emptyResult(origin, "woocommerce"), storeName };
    const cats = await safeFetchJson(`${base}/products/categories${sep}per_page=100`).catch(() => null);
    if (Array.isArray(cats)) {
      result.categories = (cats as { name?: string; permalink?: string; count?: number }[])
        .filter((c) => c.name && c.name.toLowerCase() !== "uncategorized" && (c.count ?? 1) > 0)
        .map((c) => ({ name: decodeHtmlEntities(c.name!).slice(0, 80), url: c.permalink ?? null }));
    }
    result.next = [{ step: "woo-products", page: 1, base }];
    result.infoPages = extractInfoPageLinks(html, origin);
    return result;
  }

  // Sin API pública (Tiendanube, otras plataformas, o un WooCommerce con
  // la Store API apagada): se lee página por página.
  // Parece Shopify pero /products.json no responde (tienda con contraseña,
  // por ejemplo): se deja al lector de Shopify, que explica qué hacer.
  if (hinted === "shopify") return { ...emptyResult(origin, "shopify"), storeName };
  const result = await discoverPages(origin, hinted, storeName, html);
  return { ...result, infoPages: extractInfoPageLinks(html, origin) };
}

/// Tiendanube y cualquier otra plataforma: se buscan las páginas de
/// producto en el sitemap (o, si no hay, en los enlaces de la tienda) y se
/// leen después de a lotes.
async function discoverPages(origin: string, platform: StorePlatform, storeName: string, homeHtml: string) {
  const result: ScanResult = { ...emptyResult(origin, platform), storeName };
  const productUrls = new Set<string>();
  const categoryUrls = new Set<string>();

  const robots = await safeFetchText(`${origin}/robots.txt`).catch(() => null);
  const queue = [
    ...sitemapsFromRobots(robots?.text ?? ""),
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/wp-sitemap.xml`,
  ];
  const seen = new Set<string>();
  let fetched = 0;
  while (queue.length > 0 && fetched < MAX_SITEMAPS && productUrls.size < MAX_PRODUCTS) {
    const sitemapUrl = queue.shift()!;
    if (seen.has(sitemapUrl) || !sameSite(sitemapUrl, origin)) continue;
    seen.add(sitemapUrl);
    fetched++;
    const res = await safeFetch(sitemapUrl, { maxBytes: 20 * 1024 * 1024 }).catch(() => null);
    if (!res || res.status !== 200) continue;
    let xml: string;
    try {
      xml = /\.gz$/i.test(sitemapUrl) ? gunzipSync(res.body).toString("utf8") : res.body.toString("utf8");
    } catch {
      continue;
    }
    const { sitemaps, urls } = parseSitemap(xml);
    // En un índice de sitemaps, primero los de productos y categorías.
    const ordered = [
      ...sitemaps.filter(isProductSitemap),
      ...sitemaps.filter((s) => !isProductSitemap(s) && isCategorySitemap(s)),
      ...sitemaps.filter((s) => !isProductSitemap(s) && !isCategorySitemap(s)),
    ];
    queue.unshift(...ordered.filter((s) => isProductSitemap(s) || isCategorySitemap(s)));
    queue.push(...ordered.filter((s) => !isProductSitemap(s) && !isCategorySitemap(s)));
    const fromProductSitemap = isProductSitemap(sitemapUrl);
    for (const url of urls) {
      if (!sameSite(url, origin)) continue;
      if (isCategoryUrl(url) || isCategorySitemap(sitemapUrl)) categoryUrls.add(url);
      else if (fromProductSitemap || isProductUrl(url)) productUrls.add(url);
    }
  }

  // Sin sitemap útil: los enlaces de la página de inicio y de las primeras
  // categorías.
  if (productUrls.size === 0) {
    const links = (html: string, base: string) =>
      Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi))
        .map((m) => {
          try {
            const u = new URL(decodeHtmlEntities(m[1]), base);
            u.search = "";
            return u.toString();
          } catch {
            return null;
          }
        })
        .filter((u): u is string => Boolean(u) && sameSite(u!, origin));
    for (const url of links(homeHtml, origin)) {
      if (isProductUrl(url)) productUrls.add(url);
      else if (isCategoryUrl(url)) categoryUrls.add(url);
    }
    const toCrawl = Array.from(categoryUrls).slice(0, MAX_CATEGORY_PAGES_TO_CRAWL);
    await pool(toCrawl, 5, async (url) => {
      const page = await safeFetchText(url).catch(() => null);
      for (const link of links(page?.text ?? "", url)) if (isProductUrl(link)) productUrls.add(link);
    });
  }

  if (productUrls.size === 0) {
    throw new OtherStoreError(
      "No encontramos productos en esa tienda. Prueba con la dirección principal de la tienda (no la de un producto) o escríbenos.",
    );
  }
  const urls = Array.from(productUrls).slice(0, MAX_PRODUCTS);
  if (productUrls.size > MAX_PRODUCTS) {
    result.warnings.push(`La tienda tiene más de ${MAX_PRODUCTS} productos — se leerán los primeros ${MAX_PRODUCTS}.`);
  }
  result.categories = Array.from(categoryUrls)
    .map((url) => ({ name: categoryNameFromUrl(url), url }))
    .filter((c) => c.name.length >= 2);
  for (let i = 0; i < urls.length; i += PAGES_PER_STEP) {
    result.next.push({ step: "pages", urls: urls.slice(i, i + PAGES_PER_STEP) });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pasos de escaneo
// ---------------------------------------------------------------------------

async function wooProducts(origin: string, base: string, page: number): Promise<ScanResult> {
  const result = emptyResult(origin, "woocommerce");
  if (!base.startsWith(origin)) throw new OtherStoreError("Paso de escaneo inválido.");
  const sep = base.includes("?") ? "&" : "?";
  const list = await safeFetchJson(`${base}/products${sep}per_page=${WOO_PAGE_SIZE}&page=${page}`);
  if (!Array.isArray(list)) {
    if (page === 1) result.warnings.push("No se pudo leer la lista de productos.");
    return result;
  }
  const products = list as WooStoreProduct[];
  // Precio y SKU propio de cada variación (la lista solo trae sus ids).
  const variationIds = products
    .filter((p) => p.type === "variable")
    .flatMap((p) => (p.variations ?? []).map((v) => v.id).filter((id): id is number => typeof id === "number"))
    .slice(0, 200);
  const details = new Map<number, WooStoreProduct>();
  await pool(variationIds, 8, async (id) => {
    const detail = await safeFetchJson(`${base}/products/${id}`, { timeoutMs: 8000 }).catch(() => null);
    if (detail && typeof detail === "object" && !Array.isArray(detail)) details.set(id, detail as WooStoreProduct);
  });
  for (const p of products) {
    const parsed = parseWooProduct(p, origin, details);
    if (parsed) result.products.push(parsed);
  }
  if (products.length === WOO_PAGE_SIZE && page * WOO_PAGE_SIZE < MAX_PRODUCTS) {
    result.next.push({ step: "woo-products", page: page + 1, base });
  }
  return result;
}

async function productPages(origin: string, urls: string[]): Promise<ScanResult> {
  const result = emptyResult(origin, "generic");
  const pages = await pool(urls.slice(0, PAGES_PER_STEP), PAGES_PER_STEP, async (url) => {
    if (!sameSite(url, origin)) return null;
    const page = await safeFetchText(url).catch(() => null);
    if (!page?.text) return null;
    if (result.platform === "generic") result.platform = detectPlatformFromHtml(page.text);
    return parseProductPage(page.text, page.url);
  });
  result.products = pages.filter((p): p is ScrapedProduct => Boolean(p));
  return result;
}

async function infoPage(origin: string, url: string): Promise<ScanResult> {
  const result = emptyResult(origin, "generic");
  if (!sameSite(url, origin)) throw new OtherStoreError("Esa página no es de la tienda.");
  const res = await safeFetchText(url).catch(() => null);
  if (res?.text) result.page = extractPageContent(res.text, res.url);
  return result;
}

export async function scanStore(origin: string | null, step: ScanStep): Promise<ScanResult> {
  if (step.step === "detect") return detect(step.url);
  if (!origin) throw new OtherStoreError("Falta la dirección de la tienda.");
  const base = normalizeStoreUrl(origin);
  switch (step.step) {
    case "woo-products":
      return wooProducts(base, step.base, step.page);
    case "pages":
      return productPages(base, step.urls);
    case "page":
      return infoPage(base, step.url);
  }
}
