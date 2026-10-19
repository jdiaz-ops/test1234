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
import {
  CATALOG_API_PATH,
  CATALOG_PAGE_SIZE,
  catalogProductsUrl,
  catalogQueryFromInput,
  parseCatalogCategories,
  parseCatalogItem,
  parseCatalogPage,
  topCategoryNames,
} from "@/lib/catalog-api";
import {
  ECOMETRI_DETAILS_PER_STEP,
  ECOMETRI_GRAPHQL,
  ECOMETRI_PAGE_SIZE,
  ecometriProductQueryBody,
  ecometriProductsUrl,
  isEcometriHost,
  isEcometriHtml,
  parseEcometriProduct,
  parseEcometriProductDetail,
  parseEcometriProductsResponse,
  parseEcometriStorePage,
  type EcometriStorePage,
} from "@/lib/ecometri";

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
///
/// Ecometri (tiendas por WhatsApp, {marca}.ecometri.shop) tampoco se puede
/// leer página por página (la portada y cada producto redirigen a una
/// colección, y una colección solo muestra 12 productos): se leen la
/// tienda de la portada y los productos de su API pública — ver ecometri.ts.
///
/// Las tiendas a la medida con su catálogo en /api/v1 (blissednails.co)
/// se leen de esa API, de a 100 productos por paso — ver catalog-api.ts.

export class OtherStoreError extends Error {}

export type ScanStep =
  | { step: "detect"; url: string }
  | { step: "woo-products"; page: number; base: string }
  | { step: "pages"; urls: string[] }
  | { step: "page"; url: string }
  | EcometriProductsStep
  | EcometriDetailsStep
  | CatalogProductsStep;

/// Una página de /api/v1/productos. query = la búsqueda del link pegado
/// (solo esos productos); categories = id de categoría → nombre de su
/// categoría de primer nivel, la colección de cada producto.
export type CatalogProductsStep = {
  step: "catalogo-products";
  page: number;
  query: string | null;
  categories: Record<string, string>;
};

/// Una página de productos de la API de Ecometri: collection = "" trae todos
/// los productos de la tienda; con el id de una colección, los de esa
/// (así se sabe a cuál pertenece cada uno). phone y currency vienen de la
/// portada y hacen falta para armar los links y los precios.
export type EcometriProductsStep = {
  step: "ecometri-products";
  store: string;
  collection: string;
  name: string | null;
  offset: number;
  phone: string;
  currency: string | null;
};

/// El detalle (descripción, variantes, fotos, inventario) de hasta 6
/// productos de Ecometri, por su GraphQL — una consulta por producto.
export type EcometriDetailsStep = {
  step: "ecometri-details";
  slugs: string[];
  phone: string;
  currency: string | null;
};

export type ScanCategory = { name: string; url: string | null; imageUrl?: string | null };

/// Datos de la tienda que la plataforma publica aparte del HTML (hoy solo
/// Ecometri): mandan sobre lo que el lector de la portada adivine.
export type ScanStoreInfo = {
  name: string;
  description: string;
  logoUrl: string | null;
  whatsapp: string | null;
};

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
  /// Solo en "detect", y solo cuando la plataforma lo publica (Ecometri).
  storeInfo: ScanStoreInfo | null;
};

const WOO_PAGE_SIZE = 20;
const PAGES_PER_STEP = 6;
const MAX_SITEMAPS = 25;
const MAX_CATEGORY_PAGES_TO_CRAWL = 20;

function emptyResult(origin: string, platform: StorePlatform): ScanResult {
  return { origin, platform, storeName: "", products: [], categories: [], infoPages: [], page: null, next: [], warnings: [], storeInfo: null };
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
  // Un dominio pelado que no responde se prueba con "www." adelante
  // (amglowspa.com rechaza la conexión segura; www.amglowspa.com sí abre).
  const home = await safeFetchText(origin).catch(async (err) => {
    const url = new URL(origin);
    if (/^www\./i.test(url.hostname)) throw err;
    url.hostname = `www.${url.hostname}`;
    return safeFetchText(url.origin).catch(() => {
      throw err;
    });
  }).catch((err) => {
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

  // Ecometri: los datos de la tienda vienen en la misma página; los
  // productos, de su API (ver ecometri.ts).
  if (hinted === "ecometri" || isEcometriHtml(html) || isEcometriHost(new URL(origin).hostname)) {
    const page = parseEcometriStorePage(html);
    if (page) return detectEcometri(origin, page);
    if (isEcometriHost(new URL(origin).hostname)) {
      throw new OtherStoreError("No pudimos leer los datos de esa tienda de Ecometri. Prueba con la dirección principal (https://latienda.ecometri.shop).");
    }
  }

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

  // Tienda a la medida con su catálogo en /api/v1 (blissednails.co).
  const catalog = await detectCatalogApi(origin, storeName, input);
  if (catalog) return { ...catalog, infoPages: extractInfoPageLinks(html, origin) };

  // Sin API pública (Tiendanube, otras plataformas, o un WooCommerce con
  // la Store API apagada): se lee página por página.
  // Parece Shopify pero /products.json no responde (tienda con contraseña,
  // por ejemplo): se deja al lector de Shopify, que explica qué hacer.
  if (hinted === "shopify") return { ...emptyResult(origin, "shopify"), storeName };
  const result = await discoverPages(origin, hinted, storeName, html);
  return { ...result, infoPages: extractInfoPageLinks(html, origin) };
}

/// /api/v1/productos responde con { total, items }: se pregunta cuántos
/// hay (un producto basta), se leen las categorías y cada página de 100 va
/// en un paso aparte (todas de una vez, para leerlas en paralelo). Con una
/// búsqueda en el link pegado ("/catalogo?q=shikle"), solo esos.
async function detectCatalogApi(origin: string, storeName: string, input: string): Promise<ScanResult | null> {
  const query = catalogQueryFromInput(input);
  const first = parseCatalogPage(await safeFetchJson(catalogProductsUrl(origin, 1, query, 1), { timeoutMs: 12000 }).catch(() => null));
  if (!first) return null;
  const result: ScanResult = { ...emptyResult(origin, "catalogo"), storeName };
  const categories = parseCatalogCategories(await safeFetchJson(`${origin}${CATALOG_API_PATH}/categorias`, { timeoutMs: 12000 }).catch(() => null));
  const topNames = topCategoryNames(categories);
  result.categories = categories.filter((c) => c.parentId == null).map((c) => ({ name: c.name, url: null }));
  const total = Math.min(first.total, MAX_PRODUCTS);
  for (let page = 1; (page - 1) * CATALOG_PAGE_SIZE < total; page++) {
    result.next.push({ step: "catalogo-products", page, query, categories: topNames });
  }
  if (query) result.warnings.push(`Solo los ${first.total} productos que salen al buscar "${query}" en la tienda.`);
  if (first.total > MAX_PRODUCTS) {
    result.warnings.push(
      `La tienda tiene ${first.total} productos: se leen los primeros ${MAX_PRODUCTS}. Para traer solo una marca o un tipo de producto, pega el link con la búsqueda, por ejemplo ${origin}/catalogo?q=palabra.`,
    );
  }
  return result;
}

/// Ecometri: la portada (o cualquier colección) trae la tienda completa —
/// nombre, logo, moneda, colecciones y el número de WhatsApp que arma las
/// rutas. Los productos se piden a la API: primero todos (collection ""),
/// y luego cada colección visible para saber a cuál pertenece cada uno
/// (el navegador une los dos por handle).
function detectEcometri(origin: string, page: EcometriStorePage): ScanResult {
  const { store } = page;
  const result: ScanResult = { ...emptyResult(origin, "ecometri"), storeName: store.name };
  const visible = store.collections.filter((c) => c.public);
  result.categories = visible.map((c) => ({
    name: c.name,
    url: `${origin}/${store.phone ? `${store.phone}/` : ""}collections/${c.slug}/`,
    imageUrl: c.imageUrl,
  }));
  result.storeInfo = {
    name: store.name,
    description: store.description,
    logoUrl: store.logoUrl,
    whatsapp: store.phone || null,
  };
  const base = { step: "ecometri-products" as const, store: store.basename, offset: 0, phone: store.phone, currency: store.currency };
  result.next = [
    { ...base, collection: "", name: null },
    ...visible.map((c) => ({ ...base, collection: c.id, name: c.name })),
  ];
  if (store.currency && store.currency !== "COP") {
    result.warnings.push(`La tienda vende en ${store.currency}: los precios se importan tal cual.`);
  }
  return result;
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

const ECOMETRI_STORE_ID = /^[a-z0-9_.-]{1,100}$/i;
const ECOMETRI_COLLECTION_ID = /^[a-z0-9-]{0,80}$/i;

async function ecometriProducts(origin: string, step: EcometriProductsStep): Promise<ScanResult> {
  const result = emptyResult(origin, "ecometri");
  if (!ECOMETRI_STORE_ID.test(step.store) || !ECOMETRI_COLLECTION_ID.test(step.collection)) {
    throw new OtherStoreError("Paso de escaneo inválido.");
  }
  const body = await safeFetchJson(ecometriProductsUrl(step.store, step.collection, step.offset), { timeoutMs: 12000 });
  if (!body) {
    if (step.offset === 0) {
      result.warnings.push(step.name ? `No se pudo leer la colección "${step.name}".` : "No se pudo leer la lista de productos de Ecometri.");
    }
    return result;
  }
  const { products, total } = parseEcometriProductsResponse(body);
  const ctx = { origin, phone: step.phone, currency: step.currency, collectionName: step.name };
  for (const p of products) {
    const parsed = parseEcometriProduct(p, ctx);
    if (parsed) result.products.push(parsed);
  }
  const read = step.offset + products.length;
  const more = products.length >= ECOMETRI_PAGE_SIZE && (total == null || read < total);
  if (more && read < MAX_PRODUCTS) result.next.push({ ...step, offset: read });
  else if (more && step.collection === "") {
    result.warnings.push(`La tienda tiene más de ${MAX_PRODUCTS} productos — se leerán los primeros ${MAX_PRODUCTS}.`);
  }
  // La lista no trae descripción ni variantes: el detalle de cada producto
  // se pide aparte, solo desde la lista completa (una vez por producto).
  if (step.collection === "") {
    const slugs = result.products.map((p) => p.handle);
    for (let i = 0; i < slugs.length; i += ECOMETRI_DETAILS_PER_STEP) {
      result.next.push({ step: "ecometri-details", slugs: slugs.slice(i, i + ECOMETRI_DETAILS_PER_STEP), phone: step.phone, currency: step.currency });
    }
  }
  return result;
}

async function catalogProducts(origin: string, step: CatalogProductsStep): Promise<ScanResult> {
  const result = emptyResult(origin, "catalogo");
  const page = parseCatalogPage(await safeFetchJson(catalogProductsUrl(origin, step.page, step.query), { timeoutMs: 15000 }));
  if (!page) {
    result.warnings.push(`No se pudo leer la página ${step.page} de productos.`);
    return result;
  }
  for (const item of page.items) {
    const parsed = parseCatalogItem(item, origin, step.categories);
    if (parsed) result.products.push(parsed);
  }
  return result;
}

async function ecometriDetails(origin: string, step: EcometriDetailsStep): Promise<ScanResult> {
  const result = emptyResult(origin, "ecometri");
  const details = await pool(step.slugs.slice(0, ECOMETRI_DETAILS_PER_STEP), ECOMETRI_DETAILS_PER_STEP, async (slug) => {
    const body = await safeFetchJson(ECOMETRI_GRAPHQL, { json: ecometriProductQueryBody(slug, step.phone), timeoutMs: 12000 }).catch(() => null);
    return parseEcometriProductDetail(body, { origin, phone: step.phone, currency: step.currency, collectionName: null, slug });
  });
  result.products = details.filter((p): p is ScrapedProduct => Boolean(p));
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
    case "ecometri-products":
      return ecometriProducts(base, step);
    case "ecometri-details":
      return ecometriDetails(base, step);
    case "catalogo-products":
      return catalogProducts(base, step);
  }
}
