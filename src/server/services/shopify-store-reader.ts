import {
  convertShopifyProducts,
  MAX_PAGES,
  PAGE_SIZE,
  parseShopifyProductsPage,
  ShopifyStoreError,
} from "@/lib/shopify-products-json";

/// Descarga una página del catálogo público de una tienda Shopify a partir
/// de su link (ver shopify-products-json.ts). Corre en el servidor porque
/// el navegador no puede leer otro dominio; por eso mismo el link se
/// valida antes de pedir nada: solo https y solo nombres de dominio
/// públicos — nunca una IP, localhost ni la red interna — para que nadie
/// use el servidor de Marcolini como puente hacia adentro. El navegador
/// pide página por página (ver shopify-importer.tsx), así cada request al
/// servidor es corto y la respuesta cabe en el tope de Vercel.

const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15_000;
/// Una página de 250 productos con descripciones largas pesa unos pocos MB.
const MAX_BODY_CHARS = 30_000_000;
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".home", ".lan", ".corp", ".arpa"];

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

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

function pageUrl(base: string, page: number) {
  return `${base}products.json?limit=${PAGE_SIZE}&page=${page}`;
}

/// Pide la página siguiendo los redirects a mano: de .myshopify.com al
/// dominio propio (o de www a sin www) es normal y se sigue con las mismas
/// reglas del link; a /password es la tienda con contraseña.
async function getPage(fetchImpl: FetchLike, base: string, page: number) {
  let current = base;
  let url = pageUrl(current, page);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json", "user-agent": "Marcolini (+https://marcolini.lat)" },
      });
    } catch {
      throw new ShopifyStoreError("No pudimos conectar con esa tienda. Revisa el link e intenta de nuevo.");
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, base: current };

    const location = response.headers.get("location");
    if (!location) throw new ShopifyStoreError("La tienda redirigió a un destino desconocido. Importa con el CSV.");
    const next = new URL(location, url);
    if (/^\/password(\/|$)/.test(next.pathname)) {
      throw new ShopifyStoreError(
        "La tienda está protegida con contraseña, así que Shopify no deja leer su catálogo. Quítale la contraseña un momento o importa con el CSV.",
      );
    }
    current = normalizeShopifyStoreUrl(next.origin).href;
    url = next.pathname.includes("products.json")
      ? `${current.replace(/\/$/, "")}${next.pathname}${next.search}`
      : pageUrl(current, page);
  }
  throw new ShopifyStoreError("La tienda redirige demasiadas veces. Importa con el CSV.");
}

export type ShopifyStorePage = {
  /// El dominio real de la tienda (después de redirects), para mostrarlo.
  storeUrl: string;
  products: ReturnType<typeof convertShopifyProducts>["products"];
  warnings: string[];
  /// Si la página vino llena, puede haber otra.
  hasMore: boolean;
};

export async function readShopifyStorePage(
  input: string,
  page: number,
  fetchImpl: FetchLike = (url, init) => fetch(url, init),
): Promise<ShopifyStorePage> {
  if (!Number.isInteger(page) || page < 1 || page > MAX_PAGES) {
    throw new ShopifyStoreError(`Solo se leen hasta ${MAX_PAGES} páginas de ${PAGE_SIZE} productos. Para más, usa el CSV.`);
  }
  const { response, base } = await getPage(fetchImpl, normalizeShopifyStoreUrl(input).href, page);

  if (response.status === 404) {
    throw new ShopifyStoreError(
      "En ese link no hay un catálogo de Shopify. Revisa que sea la dirección de la tienda (por ejemplo https://tumarca.myshopify.com).",
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

  const body = await response.text();
  if (body.length > MAX_BODY_CHARS) {
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
  const raw = parseShopifyProductsPage(json);
  if (raw.length === 0 && page === 1) {
    throw new ShopifyStoreError("La tienda no tiene productos publicados.");
  }
  const { products, warnings } = convertShopifyProducts(raw);
  return { storeUrl: base, products, warnings, hasMore: raw.length >= PAGE_SIZE };
}
