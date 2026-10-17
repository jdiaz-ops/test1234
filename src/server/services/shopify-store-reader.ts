import {
  collectionProductHandles,
  convertShopifyCollections,
  convertShopifyProducts,
  MAX_PAGES,
  PAGE_SIZE,
  parseShopifyCollectionsPage,
  parseShopifyProductsPage,
  ShopifyStoreError,
  type ShopifyImportCollection,
} from "@/lib/shopify-products-json";
import { parseShopifyStorefront, type ShopifyThemeInfo } from "@/lib/shopify-theme";

/// Descarga lo público de una tienda Shopify a partir de su link: el
/// catálogo por páginas (/products.json), las colecciones
/// (/collections.json y /collections/{handle}/products.json) y la portada
/// en HTML, de donde se sacan colores, letra, logo y menú (ver
/// shopify-theme.ts). Corre en el servidor porque el navegador no puede
/// leer otro dominio; por eso mismo el link se valida antes de pedir
/// nada: solo https y solo nombres de dominio públicos — nunca una IP,
/// localhost ni la red interna — para que nadie use el servidor de
/// Marcolini como puente hacia adentro. El navegador pide pieza por pieza
/// (ver shopify-importer.tsx), así cada request al servidor es corto y la
/// respuesta cabe en el tope de Vercel.

const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15_000;
/// Una página de 250 productos con descripciones largas pesa unos pocos MB.
const MAX_JSON_CHARS = 30_000_000;
const MAX_HTML_CHARS = 4_000_000;
const MAX_COLLECTION_PAGES = 4;
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".home", ".lan", ".corp", ".arpa"];
const USER_AGENT = "Marcolini (+https://marcolini.lat)";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const defaultFetch: FetchLike = (url, init) => fetch(url, init);

function looksLikeIp(host: string) {
  const bare = host.replace(/^\[|\]$/g, "");
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(bare) || bare.includes(":");
}

/// "tumarca.myshopify.com", "http://www.tumarca.com/collections/all" o
/// " HTTPS://Tumarca.com " → "https://tumarca.com/". Tira ShopifyStoreError
/// (con el mensaje que ve la marca) si no es un link público válido.
export function normalizeShopifyStoreUrl(input: string): URL {
  const raw = input.trim();
  if (!raw) throw new ShopifyStoreError("Pega el link de tu tienda Shopify.");
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new ShopifyStoreError(
      "Ese link no es válido. Pega la dirección completa, por ejemplo https://tumarca.myshopify.com.",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ShopifyStoreError("El link tiene que empezar por https://.");
  }
  if (url.username || url.password) {
    throw new ShopifyStoreError("El link no puede llevar usuario ni contraseña.");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.port ||
    !host.includes(".") ||
    host === "localhost" ||
    looksLikeIp(host) ||
    BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new ShopifyStoreError(
      "Ese link no parece el de una tienda en internet. Pega la dirección pública de la tienda, por ejemplo https://tumarca.myshopify.com.",
    );
  }
  return new URL(`https://${host}/`);
}

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

function passwordProtected(pathname: string) {
  return /^\/password(\/|$)/.test(pathname);
}

const PASSWORD_ERROR =
  "La tienda está protegida con contraseña, así que Shopify no deja leer su catálogo. Quítale la contraseña un momento o importa con el CSV.";

async function doFetch(fetchImpl: FetchLike, url: string, accept: string) {
  try {
    return await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept, "user-agent": USER_AGENT },
    });
  } catch {
    throw new ShopifyStoreError("No pudimos conectar con esa tienda. Revisa el link e intenta de nuevo.");
  }
}

/// Pide `path` (sin la barra inicial; "" es la portada) siguiendo los
/// redirects a mano: de .myshopify.com al dominio propio (o de www a sin
/// www) es normal y se sigue con las mismas reglas del link; a /password
/// es la tienda con contraseña.
async function getPath(fetchImpl: FetchLike, base: string, path: string, accept: string) {
  let current = base;
  let url = `${current}${path}`;
  const file = path.split("?")[0].split("/").pop() ?? "";
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await doFetch(fetchImpl, url, accept);
    if (!isRedirect(response.status)) return { response, base: current };

    const location = response.headers.get("location");
    if (!location) throw new ShopifyStoreError("La tienda redirigió a un destino desconocido. Importa con el CSV.");
    const next = new URL(location, url);
    if (passwordProtected(next.pathname)) throw new ShopifyStoreError(PASSWORD_ERROR);
    current = normalizeShopifyStoreUrl(next.origin).href;
    const keepsPath = path === "" || (file && next.pathname.includes(file));
    url = keepsPath ? `${current}${next.pathname.slice(1)}${next.search}` : `${current}${path}`;
  }
  throw new ShopifyStoreError("La tienda redirige demasiadas veces. Importa con el CSV.");
}

/// Descarga una imagen (logo, favicon) con las mismas reglas de host en
/// cada salto — para el importador de diseño.
export async function fetchImageSafely(fetchImpl: FetchLike, sourceUrl: string): Promise<Response> {
  let url = sourceUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(url);
    normalizeShopifyStoreUrl(parsed.origin);
    if (parsed.protocol !== "https:") throw new ShopifyStoreError("Solo se descargan imágenes por https.");
    const response = await doFetch(fetchImpl, parsed.href, "image/*");
    if (!isRedirect(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new ShopifyStoreError("La imagen redirige a un destino desconocido.");
    url = new URL(location, url).href;
  }
  throw new ShopifyStoreError("La imagen redirige demasiadas veces.");
}

function explainStatus(response: Response, what: string) {
  if (response.status === 404) {
    throw new ShopifyStoreError(
      `En ese link no hay ${what} de Shopify. Revisa que sea la dirección de la tienda (por ejemplo https://tumarca.myshopify.com).`,
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new ShopifyStoreError("La tienda no deja leer su catálogo desde afuera. Importa con el CSV.");
  }
  if (response.status === 429) {
    throw new ShopifyStoreError("Shopify pidió esperar un momento. Intenta de nuevo en unos minutos.");
  }
  if (!response.ok) {
    throw new ShopifyStoreError(
      `La tienda respondió con un error (${response.status}). Intenta de nuevo más tarde o importa con el CSV.`,
    );
  }
}

async function fetchJson(fetchImpl: FetchLike, base: string, path: string, what: string) {
  const { response, base: resolved } = await getPath(fetchImpl, base, path, "application/json");
  explainStatus(response, what);
  const body = await response.text();
  if (body.length > MAX_JSON_CHARS) {
    throw new ShopifyStoreError("El catálogo es demasiado grande para leerlo por link. Importa con el CSV.");
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ShopifyStoreError(
      /<html|<!doctype/i.test(body)
        ? "Ese link abre una página web, no el catálogo de Shopify. ¿La tienda es Shopify y está pública?"
        : "Ese link no devolvió el catálogo de Shopify.",
    );
  }
  return { json, base: resolved };
}

function checkPage(page: number) {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) {
    throw new ShopifyStoreError(`Solo se leen hasta ${MAX_PAGES} páginas de ${PAGE_SIZE} productos. Para más, usa el CSV.`);
  }
}

export type ShopifyStorePage = {
  /// El dominio real de la tienda (después de redirects), para mostrarlo.
  storeUrl: string;
  products: ReturnType<typeof convertShopifyProducts>["products"];
  warnings: string[];
  /// Si la página vino llena, puede haber otra.
  hasMore: boolean;
};

/// Una página del catálogo (/products.json).
export async function readShopifyStorePage(
  input: string,
  page: number,
  fetchImpl: FetchLike = defaultFetch,
): Promise<ShopifyStorePage> {
  checkPage(page);
  const base = normalizeShopifyStoreUrl(input).href;
  const { json, base: storeUrl } = await fetchJson(
    fetchImpl,
    base,
    `products.json?limit=${PAGE_SIZE}&page=${page}`,
    "un catálogo",
  );
  const raw = parseShopifyProductsPage(json);
  if (raw.length === 0 && page === 1) {
    throw new ShopifyStoreError("La tienda no tiene productos publicados.");
  }
  const { products, warnings } = convertShopifyProducts(raw);
  return { storeUrl, products, warnings, hasMore: raw.length >= PAGE_SIZE };
}

/// Todas las colecciones publicadas (/collections.json), sin sus
/// productos — esos se piden aparte por colección.
export async function readShopifyCollections(
  input: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ storeUrl: string; collections: ShopifyImportCollection[] }> {
  let base = normalizeShopifyStoreUrl(input).href;
  const all = [];
  for (let page = 1; page <= MAX_COLLECTION_PAGES; page++) {
    const { json, base: resolved } = await fetchJson(
      fetchImpl,
      base,
      `collections.json?limit=${PAGE_SIZE}&page=${page}`,
      "colecciones",
    );
    base = resolved;
    const raw = parseShopifyCollectionsPage(json);
    all.push(...raw);
    if (raw.length < PAGE_SIZE) break;
  }
  return { storeUrl: base, collections: convertShopifyCollections(all) };
}

/// Los handles de los productos de una colección, en su orden
/// (/collections/{handle}/products.json). Una colección que ya no existe
/// (404) vuelve vacía: no frena la importación.
export async function readShopifyCollectionProducts(
  input: string,
  handle: string,
  page: number,
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ storeUrl: string; handles: string[]; hasMore: boolean }> {
  checkPage(page);
  const clean = handle.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,254}$/.test(clean)) {
    throw new ShopifyStoreError("Esa colección no tiene un handle válido.");
  }
  const base = normalizeShopifyStoreUrl(input).href;
  const { response, base: storeUrl } = await getPath(
    fetchImpl,
    base,
    `collections/${encodeURIComponent(clean)}/products.json?limit=${PAGE_SIZE}&page=${page}`,
    "application/json",
  );
  if (response.status === 404) return { storeUrl, handles: [], hasMore: false };
  explainStatus(response, "una colección");
  const body = await response.text();
  if (body.length > MAX_JSON_CHARS) {
    throw new ShopifyStoreError("La colección es demasiado grande para leerla por link.");
  }
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ShopifyStoreError("Ese link no devolvió los productos de la colección.");
  }
  const handles = collectionProductHandles(json);
  return { storeUrl, handles, hasMore: handles.length >= PAGE_SIZE };
}

/// La portada en HTML → colores, letra, logo, favicon, nombre y menú.
export async function readShopifyStorefront(
  input: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<{ storeUrl: string; theme: ShopifyThemeInfo }> {
  const base = normalizeShopifyStoreUrl(input).href;
  const { response, base: storeUrl } = await getPath(fetchImpl, base, "", "text/html,application/xhtml+xml");
  explainStatus(response, "una tienda");
  const html = await response.text();
  if (html.length > MAX_HTML_CHARS) {
    throw new ShopifyStoreError("La portada de la tienda es demasiado pesada para leerla.");
  }
  if (/<form[^>]+action=["'][^"']*\/password["']/i.test(html) && /name=["']password["']/i.test(html)) {
    throw new ShopifyStoreError(PASSWORD_ERROR);
  }
  return { storeUrl, theme: parseShopifyStorefront(html, storeUrl) };
}
