import { decodeHtmlEntities } from "@/lib/html-entities";
import { plainTextToHtml, type ScrapedProduct } from "@/lib/store-scrape";

/// Tiendas hechas con Ecometri (tiendas por WhatsApp: {marca}.ecometri.shop).
/// No son Shopify ni WooCommerce y su vitrina no sirve para leerla página
/// por página: la portada redirige a la primera colección, las páginas de
/// producto redirigen a la colección y cada colección solo trae los
/// primeros 12 productos; el resto lo pide el navegador a la API pública
/// de Ecometri (apiv2.ecometri.shop). Acá vive el análisis de lo que
/// devuelve esa plataforma (la página de la tienda y la API) — código
/// puro, sin red, para poder probarlo con ejemplos fijos. Las descargas
/// viven en other-store-reader.ts. Ver conversación del 2026-10-19
/// (janbeauty.ecometri.shop: "La tienda redirige demasiadas veces").

export const ECOMETRI_API = "https://apiv2.ecometri.shop/api/v1";
/// Las fotos viven en un CDN propio: {cdn}/{archivo} es la original (la
/// vitrina pide versiones chicas con {cdn}/fit-in/{ancho}x{alto}/{archivo};
/// Marcolini arma las suyas al alojarlas).
export const ECOMETRI_IMAGES = "https://d1b50uin55dq3m.cloudfront.net";
/// Productos por llamada a la API (la vitrina pide de a 12).
export const ECOMETRI_PAGE_SIZE = 50;

export type EcometriCollection = {
  id: string;
  name: string;
  slug: string;
  /// Visible en la tienda (las ocultas, como "Todo", no van al menú).
  public: boolean;
  imageUrl: string | null;
};

export type EcometriStore = {
  id: string;
  /// Identificador de la tienda en la API ("janbeauty" en janbeauty.ecometri.shop).
  basename: string;
  /// Número de WhatsApp — primer tramo de todas las rutas de la tienda.
  phone: string;
  name: string;
  description: string;
  logoUrl: string | null;
  currency: string | null;
  collections: EcometriCollection[];
};

/// Un producto tal como lo devuelve la API (lista) o la página.
export type EcometriProductJson = {
  id?: unknown;
  name?: unknown;
  sku?: unknown;
  slug?: unknown;
  description?: unknown;
  price?: unknown;
  discount_price?: unknown;
  quantity_available?: unknown;
  active?: unknown;
  is_hidden_by_limit?: unknown;
  product_images?: unknown;
};

/// La respuesta de GET {api}/store/{basename}/products?collection=&limit=&offset=.
export type EcometriProductsResponse = {
  id?: unknown;
  name?: unknown;
  total_products?: unknown;
  products?: unknown;
};

export function isEcometriHtml(html: string) {
  return /apiv2\.ecometri\.shop|ecometri\.shop\/|ecometri\.com\?ref=store/i.test(html);
}

export function isEcometriHost(hostname: string) {
  return /(^|\.)ecometri\.shop$/i.test(hostname);
}

function str(value: unknown) {
  return typeof value === "string" ? decodeHtmlEntities(value).trim() : typeof value === "number" ? String(value) : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function ecometriImageUrl(file: unknown): string | null {
  const name = str(file);
  if (!name) return null;
  if (/^https?:\/\//i.test(name)) return name;
  return `${ECOMETRI_IMAGES}/${name.replace(/^\/+/, "")}`;
}

// ---------------------------------------------------------------------------
// La página de la tienda (Next.js): los datos van en el "flight" de React
// (self.__next_f.push([1,"…"])), como JSON dentro de strings.
// ---------------------------------------------------------------------------

/// Une los pedazos del flight de React Server Components en un solo texto.
export function nextFlightPayload(html: string) {
  const parts: string[] = [];
  const re = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      parts.push(JSON.parse(m[1]) as string);
    } catch {
      // Un pedazo roto no daña el resto.
    }
  }
  return parts.join("");
}

/// Lee el valor JSON (objeto o arreglo) que empieza en `start`, respetando
/// strings con comillas escapadas. null si no cierra.
function readJsonValue(text: string, start: number): unknown {
  const open = text[start];
  if (open !== "{" && open !== "[") return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function jsonAfterKey(text: string, key: string): unknown {
  const marker = `"${key}":`;
  const at = text.indexOf(marker);
  if (at < 0) return null;
  return readJsonValue(text, at + marker.length);
}

function stringAfterKey(text: string, key: string): string {
  const m = text.match(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return "";
  try {
    return JSON.parse(`"${m[1]}"`) as string;
  } catch {
    return "";
  }
}

export type EcometriStorePage = {
  store: EcometriStore;
  /// Los productos que la página trae de entrada (hasta 12).
  products: EcometriProductJson[];
  totalProducts: number | null;
};

/// Lee la tienda de la portada (o de cualquier página de colección): nombre,
/// logo, moneda, colecciones y el número de WhatsApp que arma las rutas.
export function parseEcometriStorePage(html: string): EcometriStorePage | null {
  const payload = nextFlightPayload(html);
  if (!payload) return null;
  const raw = jsonAfterKey(payload, "initialStoreData");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const basename = str(data.basename);
  const name = str(data.name);
  if (!basename || !name) return null;
  const phone = stringAfterKey(payload, "phoneNumber") || mobilePhoneOf(data);
  const collections = Array.isArray(data.collections) ? (data.collections as Record<string, unknown>[]) : [];
  const store: EcometriStore = {
    id: str(data.id),
    basename,
    phone,
    name: name.slice(0, 120),
    description: str(data.description).slice(0, 2000),
    logoUrl: ecometriImageUrl(data.profilePicture),
    currency: str(data.currency).toUpperCase() || null,
    collections: collections
      .map((c) => ({
        id: str(c.id),
        name: str(c.name).slice(0, 80),
        slug: str(c.slug),
        public: c.public === 1 || c.public === true || c.public === "1",
        imageUrl: ecometriImageUrl(c.pictureUrl),
      }))
      .filter((c) => c.id && c.name.length >= 2),
  };
  const products = jsonAfterKey(payload, "initialProducts");
  const total = payload.match(/"initialTotalProducts":(\d+)/);
  return {
    store,
    products: Array.isArray(products) ? (products as EcometriProductJson[]) : [],
    totalProducts: total ? Number(total[1]) : null,
  };
}

function mobilePhoneOf(data: Record<string, unknown>) {
  const stores = Array.isArray(data.userStores) ? (data.userStores as Record<string, unknown>[]) : [];
  const main = stores.find((s) => s.default) ?? stores[0];
  return str(main?.mobilePhoneNumber);
}

// ---------------------------------------------------------------------------
// Productos (de la API o de la página) al shape del importador
// ---------------------------------------------------------------------------

export function parseEcometriProductsResponse(body: unknown): { products: EcometriProductJson[]; total: number | null } {
  if (!body || typeof body !== "object") return { products: [], total: null };
  const res = body as EcometriProductsResponse;
  const products = Array.isArray(res.products) ? (res.products as EcometriProductJson[]) : [];
  return { products, total: num(res.total_products) };
}

export type EcometriProductContext = {
  /// https://janbeauty.ecometri.shop
  origin: string;
  phone: string;
  currency: string | null;
  collectionName: string | null;
};

/// null si el producto está inactivo o no tiene nombre.
export function parseEcometriProduct(p: EcometriProductJson, ctx: EcometriProductContext): ScrapedProduct | null {
  const name = str(p.name).slice(0, 255);
  const slug = str(p.slug);
  if (name.length < 2 || !slug) return null;
  if (p.active === 0 || p.active === false) return null;
  const price = num(p.price) ?? 0;
  const discount = num(p.discount_price) ?? 0;
  const hasDiscount = discount > 0 && price > discount;
  const images = (Array.isArray(p.product_images) ? (p.product_images as Record<string, unknown>[]) : [])
    .slice()
    .sort((a, b) => (num(a.order) ?? 0) - (num(b.order) ?? 0))
    .map((img) => ecometriImageUrl(img.picture_url))
    .filter((u): u is string => Boolean(u));
  const stock = num(p.quantity_available);
  const sourceUrl = `${ctx.origin}/${ctx.phone ? `${ctx.phone}/` : ""}${slug}/`;
  return {
    handle: slug.slice(0, 200),
    name,
    description: plainTextToHtml(str(p.description)).slice(0, 20000),
    price: Math.max(0, hasDiscount ? discount : price),
    compareAtPrice: hasDiscount ? price : null,
    currency: ctx.currency,
    images: Array.from(new Set(images)).slice(0, 20),
    sku: str(p.sku).slice(0, 120),
    barcode: "",
    weight: null,
    weightUnit: "KG",
    stock: stock != null ? Math.max(0, Math.floor(stock)) : null,
    collectionNames: ctx.collectionName ? [ctx.collectionName] : [],
    hasVariants: false,
    optionNames: [],
    variants: [],
    sourceUrl,
  };
}

/// GET {api}/store/{basename}/products?collection={id}&limit=&offset=.
export function ecometriProductsUrl(basename: string, collectionId: string, offset: number, limit = ECOMETRI_PAGE_SIZE) {
  const url = new URL(`${ECOMETRI_API}/store/${encodeURIComponent(basename)}/products`);
  url.searchParams.set("collection", collectionId);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  return url.toString();
}
