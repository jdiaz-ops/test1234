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
import {
  extractPageContent,
  parseShopifyStorefront,
  type ShopifyPolicyKind,
  type ShopifyThemeInfo,
} from "@/lib/shopify-theme";
import {
  findFreeShippingThreshold,
  isColombiaRegion,
  isFreeRate,
  parseShippingRates,
  probeZip,
  shopifyProvince,
  type RatesByRegion,
  type ShippingRateProbe,
  type ThresholdProbe,
  type ThresholdResult,
} from "@/lib/shopify-shipping";

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
  let theme = parseShopifyStorefront(html, storeUrl);
  if (!theme.colors || !theme.fonts) {
    // Temas de WordPress (Elementor, Astra…) guardan colores y letra en
    // sus propios .css: se bajan unas pocas hojas y se vuelve a leer.
    const css = await readStylesheets(fetchImpl, storeUrl, html);
    if (css) theme = parseShopifyStorefront(html, storeUrl, css);
  }
  return { storeUrl, theme };
}

const MAX_STYLESHEETS = 4;
const MAX_CSS_CHARS = 400_000;

/// Las hojas de estilo enlazadas en la portada que más probablemente
/// traen los colores y la letra del tema (Elementor, Astra, el tema
/// activo), bajadas y pegadas. Vacío si ninguna se pudo leer.
export async function readStylesheets(fetchImpl: FetchLike, baseUrl: string, html: string): Promise<string> {
  const base = new URL(baseUrl);
  const host = (h: string) => h.replace(/^www\./, "").toLowerCase();
  const candidates: { url: string; score: number }[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/rel=["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    let url: URL;
    try {
      url = new URL(href.replace(/&amp;/g, "&"), base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || host(url.hostname) !== host(base.hostname)) continue;
    const path = url.pathname.toLowerCase();
    const score = /elementor\/css\/(post|global)/.test(path) ? 3 : /astra|kit|global|theme|style\.css|custom/.test(path) ? 2 : 1;
    if (!candidates.some((c) => c.url === url.href)) candidates.push({ url: url.href, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  const parts: string[] = [];
  for (const { url } of candidates.slice(0, MAX_STYLESHEETS)) {
    try {
      const response = await doFetch(fetchImpl, url, "text/css,*/*;q=0.1");
      if (response.status !== 200) continue;
      parts.push((await response.text()).slice(0, MAX_CSS_CHARS));
    } catch {
      // Una hoja que no se pudo leer no frena el resto.
    }
  }
  return parts.join("\n");
}

// ----------------------------------------------------------------------------
// Fletes: carrito de prueba + /cart/shipping_rates.json por departamento
// (ver shopify-shipping.ts). Shopify guarda el carrito en una cookie, así
// que acá hay un mini jar de cookies para la sesión de la prueba.
// ----------------------------------------------------------------------------

/// La tienda no permite consultar fletes desde afuera: no vale la pena
/// seguir probando departamentos.
export class ShippingProbeUnavailable extends ShopifyStoreError {}

type CartSession = { base: string; cookies: Map<string, string> };

export type ProbeVariant = { variantId: number; unitPrice: number; productName: string };

const RATES_RETRIES = 3;
const RATES_RETRY_MS = 1500;

function cookieHeader(session: CartSession) {
  return Array.from(session.cookies.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function absorbCookies(session: CartSession, response: Response) {
  const list = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const raw of list) {
    const pair = raw.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    session.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

/// GET o POST al carrito siguiendo redirects (de .myshopify.com al dominio
/// propio) con el mismo método y cuerpo, y guardando las cookies.
async function cartRequest(
  fetchImpl: FetchLike,
  session: CartSession,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
) {
  let url = `${session.base}${path}`;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const headers: Record<string, string> = { accept: "application/json", "user-agent": USER_AGENT };
    const cookie = cookieHeader(session);
    if (cookie) headers.cookie = cookie;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: init.method,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch {
      throw new ShopifyStoreError("No pudimos conectar con esa tienda para probar el carrito.");
    }
    absorbCookies(session, response);
    if (!isRedirect(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new ShopifyStoreError("La tienda redirigió a un destino desconocido.");
    const next = new URL(location, url);
    if (passwordProtected(next.pathname)) throw new ShopifyStoreError(PASSWORD_ERROR);
    session.base = normalizeShopifyStoreUrl(next.origin).href;
    url = `${session.base}${path}`;
  }
  throw new ShopifyStoreError("La tienda redirige demasiadas veces.");
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > MAX_JSON_CHARS) throw new ShopifyStoreError("La respuesta de la tienda es demasiado grande.");
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/// Los productos más baratos que están disponibles, para armar el carrito
/// de prueba (barato = se puede subir la cantidad para buscar el envío
/// gratis sin disparar el subtotal).
export async function pickProbeVariants(fetchImpl: FetchLike, base: string): Promise<{ base: string; candidates: ProbeVariant[] }> {
  const { json, base: resolved } = await fetchJson(fetchImpl, base, `products.json?limit=${PAGE_SIZE}&page=1`, "un catálogo");
  const candidates: ProbeVariant[] = [];
  for (const product of parseShopifyProductsPage(json)) {
    if (product.published_at === null) continue;
    for (const variant of product.variants ?? []) {
      if (!variant || variant.available !== true) continue;
      const id = typeof variant.id === "number" ? variant.id : Number(variant.id);
      const price = typeof variant.price === "number" ? variant.price : Number(String(variant.price ?? "").replace(/[^0-9.]/g, ""));
      if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(price) || price <= 0) continue;
      candidates.push({ variantId: id, unitPrice: price, productName: String(product.title ?? "").trim().slice(0, 120) });
    }
  }
  candidates.sort((a, b) => a.unitPrice - b.unitPrice);
  if (candidates.length === 0) {
    throw new ShopifyStoreError("La tienda no tiene productos disponibles para probar el carrito.");
  }
  return { base: resolved, candidates: candidates.slice(0, 5) };
}

type CartState = { quantity: number; subtotal: number };

/// Deja el carrito con exactamente `quantity` unidades del producto de
/// prueba (Shopify recorta al stock disponible) y devuelve lo que quedó.
async function setCartQuantity(fetchImpl: FetchLike, session: CartSession, variantId: number, quantity: number): Promise<CartState> {
  const response = await cartRequest(fetchImpl, session, "cart/update.js", {
    method: "POST",
    body: { updates: { [String(variantId)]: quantity } },
  });
  const json = (await readJsonBody(response)) as {
    items_subtotal_price?: unknown;
    item_count?: unknown;
    items?: { variant_id?: unknown; quantity?: unknown }[];
  } | null;
  if (!response.ok || !json) throw new ShopifyStoreError("No se pudo ajustar el carrito de prueba.");
  const line = json.items?.find((i) => Number(i?.variant_id) === variantId);
  const inCart = Number(line?.quantity ?? json.item_count ?? 0);
  const cents = Number(json.items_subtotal_price ?? 0);
  return { quantity: Number.isFinite(inCart) ? inCart : 0, subtotal: Number.isFinite(cents) ? Math.round(cents) / 100 : 0 };
}

/// Crea el carrito con el primer candidato que Shopify acepte.
async function createProbeCart(fetchImpl: FetchLike, base: string, candidates: ProbeVariant[], quantity: number) {
  let lastError = "Ninguno de los productos de prueba se pudo agregar al carrito.";
  for (const candidate of candidates) {
    const session: CartSession = { base, cookies: new Map() };
    const response = await cartRequest(fetchImpl, session, "cart/add.js", {
      method: "POST",
      body: { items: [{ id: candidate.variantId, quantity: 1 }] },
    });
    if (response.status === 404 || response.status === 405) {
      throw new ShippingProbeUnavailable("La tienda no deja armar carritos desde afuera: no se pueden probar los fletes.");
    }
    if (!response.ok) {
      const json = (await readJsonBody(response)) as { description?: unknown; message?: unknown } | null;
      lastError = String(json?.description ?? json?.message ?? `Shopify respondió ${response.status}`);
      continue;
    }
    const cart = quantity > 1 ? await setCartQuantity(fetchImpl, session, candidate.variantId, quantity) : await setCartQuantity(fetchImpl, session, candidate.variantId, 1);
    if (cart.quantity <= 0) {
      lastError = "El producto de prueba se quedó sin stock al agregarlo.";
      continue;
    }
    return { session, variant: candidate, cart };
  }
  throw new ShopifyStoreError(lastError);
}

/// Las tarifas que Shopify cobraría para un departamento con el carrito
/// actual. Primero con el nombre de la provincia, si no con su código.
async function ratesForRegion(fetchImpl: FetchLike, session: CartSession, region: string): Promise<ShippingRateProbe[]> {
  const province = shopifyProvince(region);
  const zip = probeZip(region);
  const attempts = [province.name, province.code].filter(Boolean);
  let lastError = "Shopify no devolvió tarifas para este departamento.";
  for (const value of attempts) {
    const query = new URLSearchParams({
      "shipping_address[country]": "Colombia",
      "shipping_address[province]": value,
      "shipping_address[zip]": zip,
    });
    for (let attempt = 0; attempt < RATES_RETRIES; attempt++) {
      const response = await cartRequest(fetchImpl, session, `cart/shipping_rates.json?${query.toString()}`);
      if (response.status === 404 || response.status === 405) {
        throw new ShippingProbeUnavailable("La tienda no permite consultar fletes desde afuera.");
      }
      const json = await readJsonBody(response);
      if (response.status === 422 || response.status === 400) {
        const err = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
        const detail = Object.values(err)
          .flat()
          .map((v) => (typeof v === "string" ? v : ""))
          .filter(Boolean)
          .join(" ");
        lastError = detail || `Shopify respondió ${response.status}`;
        break; // probar con el código
      }
      if (!response.ok) {
        lastError = `Shopify respondió ${response.status}`;
        break;
      }
      const rates = parseShippingRates(json);
      // 202 o shipping_rates null: una transportadora está calculando.
      if (rates) return rates;
      if (attempt < RATES_RETRIES - 1) await new Promise((r) => setTimeout(r, RATES_RETRY_MS));
      else lastError = "La tienda calcula los fletes con una transportadora y no respondió a tiempo.";
    }
  }
  throw new ShopifyStoreError(lastError);
}

export type ShippingRatesRead = {
  storeUrl: string;
  variant: ProbeVariant;
  quantity: number;
  subtotal: number;
  rates: RatesByRegion;
  errors: Record<string, string>;
};

/// Tarifas por departamento con un carrito de `quantity` unidades del
/// producto de prueba (el más barato disponible, o el que se pase).
export async function readShopifyShippingRates(
  input: string,
  options: { regions: string[]; quantity?: number; variant?: ProbeVariant | null },
  fetchImpl: FetchLike = defaultFetch,
): Promise<ShippingRatesRead> {
  let base = normalizeShopifyStoreUrl(input).href;
  let candidates: ProbeVariant[];
  if (options.variant) {
    candidates = [options.variant];
  } else {
    const picked = await pickProbeVariants(fetchImpl, base);
    base = picked.base;
    candidates = picked.candidates;
  }
  const { session, variant, cart } = await createProbeCart(fetchImpl, base, candidates, Math.max(1, options.quantity ?? 1));
  const rates: RatesByRegion = {};
  const errors: Record<string, string> = {};
  for (const region of options.regions) {
    if (!isColombiaRegion(region)) continue;
    try {
      rates[region] = await ratesForRegion(fetchImpl, session, region);
    } catch (err) {
      if (err instanceof ShippingProbeUnavailable) throw err;
      errors[region] = err instanceof Error ? err.message : "No se pudo leer.";
    }
  }
  return { storeUrl: session.base, variant, quantity: cart.quantity, subtotal: cart.subtotal, rates, errors };
}

export type ThresholdRead = ThresholdResult & { storeUrl: string; region: string; probes: number };

/// Desde qué subtotal el envío sale gratis en un departamento: sube la
/// cantidad del producto de prueba y pregunta la tarifa cada vez (ver
/// findFreeShippingThreshold).
export async function readShopifyFreeShippingThreshold(
  input: string,
  options: { region: string; variant: ProbeVariant; maxQuantity: number },
  fetchImpl: FetchLike = defaultFetch,
): Promise<ThresholdRead> {
  if (!isColombiaRegion(options.region)) throw new ShopifyStoreError("Departamento inválido.");
  const base = normalizeShopifyStoreUrl(input).href;
  const { session } = await createProbeCart(fetchImpl, base, [options.variant], 1);
  let probes = 0;
  const probe: ThresholdProbe = async (quantity) => {
    probes++;
    const state = await setCartQuantity(fetchImpl, session, options.variant.variantId, quantity);
    const rates = await ratesForRegion(fetchImpl, session, options.region);
    return { quantity: state.quantity, subtotal: state.subtotal, free: rates.some(isFreeRate) };
  };
  const result = await findFreeShippingThreshold(probe, Math.max(1, Math.min(100, options.maxQuantity)));
  return { storeUrl: session.base, region: options.region, probes, ...result };
}

// ----------------------------------------------------------------------------
// Páginas propias (/pages/{handle}) y políticas (/policies/{kind})
// ----------------------------------------------------------------------------

export type ShopifyPageRead = {
  storeUrl: string;
  /// false = la tienda no tiene esa página o política (404).
  found: boolean;
  title: string | null;
  bodyHtml: string;
};

export async function readShopifyPage(
  input: string,
  target: { handle: string } | { policy: ShopifyPolicyKind },
  fetchImpl: FetchLike = defaultFetch,
): Promise<ShopifyPageRead> {
  const base = normalizeShopifyStoreUrl(input).href;
  let path: string;
  if ("handle" in target) {
    const handle = target.handle.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{0,254}$/.test(handle)) throw new ShopifyStoreError("Esa página no tiene un handle válido.");
    path = `pages/${encodeURIComponent(handle)}`;
  } else {
    path = `policies/${target.policy}`;
  }
  const { response, base: storeUrl } = await getPath(fetchImpl, base, path, "text/html,application/xhtml+xml");
  if (response.status === 404) return { storeUrl, found: false, title: null, bodyHtml: "" };
  explainStatus(response, "una página");
  const html = await response.text();
  if (html.length > MAX_HTML_CHARS) throw new ShopifyStoreError("Esa página es demasiado pesada para leerla.");
  const content = extractPageContent(html, storeUrl);
  if (!content) return { storeUrl, found: false, title: null, bodyHtml: "" };
  return { storeUrl, found: true, ...content };
}
