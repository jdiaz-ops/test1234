import { slugify, type ShopifyImportProduct } from "@/lib/shopify-csv";
import { decodeHtmlEntities } from "@/lib/html-entities";
import type { ShopifyImportCollection } from "@/lib/shopify-products-json";

/// Lee el catálogo público de una tienda online que NO es Shopify
/// (WooCommerce, Tiendanube o cualquier otra) para el importador por link
/// (shopify-importer.tsx). Shopify tiene su propio lector, más completo
/// (shopify-store-reader.ts); esto cubre el resto. Acá solo vive el
/// análisis de lo que devuelve cada plataforma (JSON, HTML, sitemaps) —
/// código puro, sin red, para poder probarlo con ejemplos fijos. Las
/// descargas viven en other-store-reader.ts.
///
/// - WooCommerce: la Store API (/wp-json/wc/store/v1/products), pública.
/// - Tiendanube y cualquier otra: no hay API pública, así que se recorre
///   el sitemap y se lee cada página de producto (los datos estructurados
///   JSON-LD que ponen para Google, más el JSON de variantes de Tiendanube).
///
/// Lo leído se convierte al mismo shape que el lector de Shopify
/// (toShopifyImport), así el resto del importador —productos,
/// colecciones, fotos alojadas en Marcolini— no distingue de dónde vino.

export type ScrapedVariant = {
  option1Value: string | null;
  option2Value: string | null;
  option3Value: string | null;
  price: number | null;
  sku: string;
  barcode: string;
  /// null = sin control de inventario.
  stock: number | null;
  weight: number | null;
  weightUnit: "KG" | "G";
};

export type ScrapedProduct = {
  /// Estable entre escaneos (slug de WooCommerce o de la URL) — con esto volver a importar actualiza en vez de duplicar.
  handle: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  currency: string | null;
  images: string[];
  sku: string;
  barcode: string;
  weight: number | null;
  weightUnit: "KG" | "G";
  /// null = no se sabe (ninguna plataforma publica la cantidad real).
  stock: number | null;
  collectionNames: string[];
  hasVariants: boolean;
  optionNames: string[];
  variants: ScrapedVariant[];
  sourceUrl: string;
};

export type StorePlatform = "shopify" | "woocommerce" | "tiendanube" | "ecometri" | "generic";

export const MAX_IMAGES_PER_PRODUCT = 20;
export const MAX_PRODUCTS = 2000;
const MAX_DESCRIPTION_LENGTH = 20000;
const MAX_VARIANTS = 100;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function text(value: unknown): string {
  if (typeof value === "string") return decodeHtmlEntities(value).trim();
  if (typeof value === "number") return String(value);
  return "";
}

function money(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return null;
  // "1.234,56" (coma decimal) vs "1,234.56" — se decide por el último
  // separador. Un solo separador seguido de 3 dígitos es de miles
  // ("15.000" en pesos colombianos).
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  let normalized = cleaned;
  if (lastDot >= 0 && lastComma >= 0) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (sep) {
      const parts = cleaned.split(sep);
      const thousands = parts.length > 2 || parts[parts.length - 1].length === 3;
      normalized = thousands ? parts.join("") : parts.join(".");
    }
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/// Pesos y medidas: "0.300" es 0,3 (no 300 como sería en un precio en pesos).
function decimal(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = text(value).replace(",", ".").replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function positiveOrNull(value: number | null) {
  return value != null && value > 0 ? value : null;
}

function code(value: unknown) {
  return text(value).slice(0, 120);
}

function absoluteUrl(value: unknown, base: string): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw, base);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function uniqueImages(urls: (string | null)[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url.slice(0, 1000));
    if (out.length >= MAX_IMAGES_PER_PRODUCT) break;
  }
  return out;
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 80);
    if (name.length < 2 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export function plainTextToHtml(value: string) {
  if (!value) return "";
  if (/<[a-z][\s\S]*>/i.test(value)) return value;
  return value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function handleFromUrl(url: string) {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return slugify(decodeURIComponent(last).replace(/\.html?$/, "")) || slugify(url);
  } catch {
    return slugify(url);
  }
}

/// Peso en cualquier unidad común → kg (Product.weight se guarda siempre en
/// kg). La unidad de vista se elige según cómo venía.
export function weightToKg(value: number | null, unit: string): { weight: number | null; weightUnit: "KG" | "G" } {
  if (value == null || value <= 0) return { weight: null, weightUnit: "KG" };
  const u = unit.trim().toLowerCase();
  let kg: number;
  let weightUnit: "KG" | "G" = "KG";
  if (["g", "gr", "grs", "gram", "grams", "gramos", "grm"].includes(u)) {
    kg = value / 1000;
    weightUnit = "G";
  } else if (["lb", "lbs", "pound", "pounds", "lbr"].includes(u)) {
    kg = value * 0.45359237;
  } else if (["oz", "ounce", "ounces", "onz"].includes(u)) {
    kg = value * 0.0283495;
    weightUnit = "G";
  } else {
    kg = value;
  }
  return { weight: Math.round(kg * 1000) / 1000 || null, weightUnit };
}

// ---------------------------------------------------------------------------
// WooCommerce — Store API (/wp-json/wc/store/v1/products)
// ---------------------------------------------------------------------------

type WooPrices = {
  price?: string;
  regular_price?: string;
  sale_price?: string;
  currency_code?: string;
  currency_minor_unit?: number;
};

export type WooStoreProduct = {
  id?: number;
  name?: string;
  slug?: string;
  permalink?: string;
  type?: string;
  sku?: string;
  description?: string;
  short_description?: string;
  prices?: WooPrices;
  images?: { src?: string }[];
  categories?: { name?: string }[];
  is_in_stock?: boolean;
  attributes?: { name?: string; has_variations?: boolean; terms?: { name?: string; slug?: string }[] }[];
  variations?: { id?: number; attributes?: { name?: string; value?: string | null }[] }[];
};

/// La Store API manda los precios como enteros en la unidad mínima de la
/// moneda ("1500000" con currency_minor_unit 2 = 15.000,00).
function wooMoney(value: string | undefined, minorUnit: number | undefined) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n / 10 ** (minorUnit ?? 0);
}

function wooPrice(prices: WooPrices | undefined) {
  const minor = prices?.currency_minor_unit;
  const price = wooMoney(prices?.price, minor) ?? 0;
  const regular = wooMoney(prices?.regular_price, minor);
  return {
    price: Math.max(0, price),
    compareAtPrice: regular != null && regular > price ? regular : null,
    currency: prices?.currency_code ?? null,
  };
}

/// `variationDetails` = la respuesta de la Store API para cada variación
/// (por id), cuando se pudo traer — de ahí sale el precio y SKU propio de
/// cada una. Si falta, la variante queda con el precio del producto.
export function parseWooProduct(
  p: WooStoreProduct,
  origin: string,
  variationDetails: Map<number, WooStoreProduct> = new Map(),
): ScrapedProduct | null {
  const name = text(p.name).slice(0, 255);
  const handle = text(p.slug) || (p.id != null ? `woo-${p.id}` : "");
  if (!handle || name.length < 2) return null;
  const { price, compareAtPrice, currency } = wooPrice(p.prices);
  const description = text(p.description) || text(p.short_description);
  const product: ScrapedProduct = {
    handle,
    name,
    description: description.slice(0, MAX_DESCRIPTION_LENGTH),
    price,
    compareAtPrice,
    currency,
    images: uniqueImages((p.images ?? []).map((img) => absoluteUrl(img.src, origin))),
    sku: code(p.sku),
    barcode: "",
    weight: null,
    weightUnit: "KG",
    stock: p.is_in_stock === false ? 0 : null,
    collectionNames: uniqueNames((p.categories ?? []).map((c) => text(c.name))),
    hasVariants: false,
    optionNames: [],
    variants: [],
    sourceUrl: absoluteUrl(p.permalink, origin) ?? `${origin}/?product=${handle}`,
  };

  const variantAttrs = (p.attributes ?? []).filter((a) => a.has_variations).slice(0, 3);
  const variations = p.variations ?? [];
  if (p.type === "variable" && variantAttrs.length > 0 && variations.length > 0) {
    const optionNames = variantAttrs.map((a) => text(a.name).slice(0, 40) || "Opción");
    // Las variaciones traen el slug del término ("azul-marino"); el nombre
    // visible ("Azul marino") está en los términos del atributo.
    const termName = (attrIndex: number, value: string) => {
      const terms = variantAttrs[attrIndex].terms ?? [];
      const match = terms.find((t) => t.slug === value || text(t.name).toLowerCase() === value.toLowerCase());
      return match ? text(match.name) : value;
    };
    const seen = new Set<string>();
    for (const variation of variations) {
      const values: (string | null)[] = [null, null, null];
      variantAttrs.forEach((attr, i) => {
        const found = (variation.attributes ?? []).find(
          (va) => text(va.name).toLowerCase() === text(attr.name).toLowerCase(),
        );
        const raw = text(found?.value ?? "");
        values[i] = raw ? termName(i, raw).slice(0, 255) : null;
      });
      // Una variación con "cualquier valor" (atributo vacío) no se puede
      // representar como variante fija — se omite.
      if (values.slice(0, optionNames.length).some((v) => !v)) continue;
      const key = values.join("|").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const detail = variation.id != null ? variationDetails.get(variation.id) : undefined;
      const detailPrice = detail ? wooPrice(detail.prices).price : null;
      product.variants.push({
        option1Value: values[0],
        option2Value: values[1],
        option3Value: values[2],
        price: positiveOrNull(detailPrice ?? price),
        sku: code(detail?.sku),
        barcode: "",
        stock: 0,
        weight: null,
        weightUnit: "KG",
      });
      if (product.variants.length >= MAX_VARIANTS) break;
    }
    if (product.variants.length > 0) {
      product.hasVariants = true;
      product.optionNames = optionNames;
      product.price = 0;
      product.compareAtPrice = null;
      product.sku = "";
      product.stock = null;
    }
  }
  return product;
}

// ---------------------------------------------------------------------------
// Cualquier tienda — HTML de la página de producto
// ---------------------------------------------------------------------------

type JsonLd = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function typeOf(node: JsonLd) {
  return asArray(node["@type"] as string | string[]).map((t) => String(t).toLowerCase());
}

function extractJsonLd(html: string): JsonLd[] {
  const nodes: JsonLd[] = [];
  const re = /<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const raw = match[1].trim().replace(/^<!--|-->$/g, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Algunos temas dejan saltos de línea crudos dentro de los strings.
      try {
        parsed = JSON.parse(raw.replace(/[\r\n\t]+/g, " "));
      } catch {
        continue;
      }
    }
    const walk = (value: unknown) => {
      for (const item of asArray(value as JsonLd | JsonLd[])) {
        if (!item || typeof item !== "object") continue;
        nodes.push(item);
        if (item["@graph"]) walk(item["@graph"]);
      }
    };
    walk(parsed);
  }
  return nodes;
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${escaped}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeHtmlEntities(m[1]).trim();
  }
  return "";
}

function jsonLdImages(value: unknown, base: string): (string | null)[] {
  return asArray(value as unknown[]).map((img) => {
    if (typeof img === "string") return absoluteUrl(img, base);
    if (img && typeof img === "object") {
      const o = img as JsonLd;
      return absoluteUrl(o.url ?? o.contentUrl, base);
    }
    return null;
  });
}

function jsonLdOffer(product: JsonLd) {
  const offers = asArray(product.offers as JsonLd | JsonLd[]).flatMap((o) =>
    o && typeOf(o).includes("aggregateoffer") && o.offers ? asArray(o.offers as JsonLd[]) : [o],
  );
  const first = offers[0];
  if (!first) return { price: null, currency: null, available: null, offers };
  const spec = asArray(first.priceSpecification as JsonLd | JsonLd[])[0];
  const price = money(first.price ?? first.lowPrice ?? spec?.price);
  const availability = text(first.availability).toLowerCase();
  return {
    price,
    currency: text(first.priceCurrency ?? spec?.priceCurrency) || null,
    available: availability ? !/outofstock|soldout|discontinued/.test(availability) : null,
    offers,
  };
}

function jsonLdWeight(product: JsonLd) {
  const w = product.weight;
  if (w && typeof w === "object") {
    const o = w as JsonLd;
    const unitCode = text(o.unitCode ?? o.unitText).toUpperCase();
    const unit = unitCode === "GRM" ? "g" : unitCode === "LBR" ? "lb" : unitCode === "ONZ" ? "oz" : unitCode || "kg";
    return weightToKg(decimal(o.value), unit);
  }
  const raw = text(w);
  const m = raw.match(/([\d.,]+)\s*([a-zA-Z]*)/);
  return m ? weightToKg(decimal(m[1]), m[2] || "kg") : weightToKg(null, "kg");
}

function jsonLdBarcode(node: JsonLd) {
  return code(node.gtin13 ?? node.gtin ?? node.gtin12 ?? node.gtin14 ?? node.gtin8 ?? "");
}

function breadcrumbCategory(nodes: JsonLd[]): string | null {
  const crumbs = nodes.find((n) => typeOf(n).includes("breadcrumblist"));
  const items = asArray(crumbs?.itemListElement as JsonLd[])
    .map((item) => {
      const inner = item.item as JsonLd | string | undefined;
      return text(item.name ?? (typeof inner === "object" ? inner?.name : ""));
    })
    .filter(Boolean);
  // [Inicio, Categoría, …, Producto] → la penúltima es la categoría.
  if (items.length < 3) return null;
  const candidate = items[items.length - 2];
  return /^(inicio|home|tienda|shop|productos|products)$/i.test(candidate) ? null : candidate;
}

/// Tiendanube pone las variantes como JSON en un atributo del formulario
/// del producto: data-variants="[{&quot;price_number&quot;:…}]".
type TiendanubeVariant = {
  option0?: string | null;
  option1?: string | null;
  option2?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price_number?: number | null;
  compare_at_price_number?: number | null;
  stock?: number | null;
  available?: boolean;
  weight?: string | number | null;
  image_url?: string | null;
};

function tiendanubeVariants(html: string): TiendanubeVariant[] {
  const m = html.match(/data-variants=(["'])([\s\S]*?)\1/i);
  if (!m) return [];
  try {
    const parsed = JSON.parse(decodeHtmlEntities(m[2]));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function detectPlatformFromHtml(html: string): StorePlatform {
  if (/cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(html)) return "shopify";
  // Tiendas por WhatsApp de Ecometri ({marca}.ecometri.shop) — ver ecometri.ts.
  if (/apiv2\.ecometri\.shop|ecometri\.com\?ref=store/i.test(html)) return "ecometri";
  if (/tiendanube|nuvemshop|d26lpennugtm8s\.cloudfront\.net|LS\.store/i.test(html)) return "tiendanube";
  if (/woocommerce|wp-content\/plugins\/woocommerce/i.test(html)) return "woocommerce";
  return "generic";
}

/// Lee una página de producto. Devuelve null si la página no es de un
/// producto (sin JSON-LD Product ni og:type product).
export function parseProductPage(html: string, pageUrl: string): ScrapedProduct | null {
  const nodes = extractJsonLd(html);
  const group = nodes.find((n) => typeOf(n).includes("productgroup"));
  const ld = group ?? nodes.find((n) => typeOf(n).includes("product"));
  const ogType = metaContent(html, "og:type").toLowerCase();
  if (!ld && !ogType.includes("product")) return null;

  const name = (text(ld?.name) || metaContent(html, "og:title")).slice(0, 255);
  if (name.length < 2) return null;
  const offer = ld ? jsonLdOffer(ld) : { price: null, currency: null, available: null, offers: [] };
  const ogPrice = money(metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount"));
  const description =
    text(ld?.description) || metaContent(html, "og:description") || metaContent(html, "description");
  const weight = ld ? jsonLdWeight(ld) : weightToKg(null, "kg");
  const category = text(ld?.category).split(">").pop()?.trim() ?? "";

  const variantNodes = group ? asArray(group.hasVariant as JsonLd[]) : [];
  const images = uniqueImages([
    ...(ld ? jsonLdImages(ld.image, pageUrl) : []),
    ...variantNodes.flatMap((v) => jsonLdImages(v.image, pageUrl)),
    absoluteUrl(metaContent(html, "og:image"), pageUrl),
  ]);

  const product: ScrapedProduct = {
    handle: handleFromUrl(pageUrl),
    name,
    description: plainTextToHtml(description).slice(0, MAX_DESCRIPTION_LENGTH),
    price: Math.max(0, offer.price ?? ogPrice ?? 0),
    compareAtPrice: null,
    currency: offer.currency || metaContent(html, "product:price:currency") || null,
    images,
    sku: code(ld?.sku ?? ld?.mpn ?? ""),
    barcode: ld ? jsonLdBarcode(ld) : "",
    weight: weight.weight,
    weightUnit: weight.weightUnit,
    stock: offer.available === false ? 0 : null,
    collectionNames: uniqueNames([category, breadcrumbCategory(nodes) ?? ""]),
    hasVariants: false,
    optionNames: [],
    variants: [],
    sourceUrl: pageUrl,
  };

  // Variantes de Tiendanube (precio, precio antes, SKU, stock, peso).
  const tn = tiendanubeVariants(html);
  const tnFirst = tn[0];
  if (tnFirst) {
    const optionCount = [tnFirst.option0, tnFirst.option1, tnFirst.option2].filter((v) => text(v ?? "")).length;
    if (optionCount > 0 && tn.length > 1) {
      product.hasVariants = true;
      product.optionNames = tiendanubeOptionNames(html, optionCount);
      const seen = new Set<string>();
      for (const v of tn) {
        const values = [v.option0, v.option1, v.option2].map((val, i) => (i < optionCount ? text(val ?? "") || null : null));
        const key = values.join("|").toLowerCase();
        if (!values[0] || seen.has(key)) continue;
        seen.add(key);
        const w = weightToKg(decimal(v.weight ?? null), "kg");
        product.variants.push({
          option1Value: values[0],
          option2Value: values[1],
          option3Value: values[2],
          price: positiveOrNull(money(v.price_number ?? null)),
          sku: code(v.sku),
          barcode: code(v.barcode),
          stock: typeof v.stock === "number" ? Math.max(0, Math.floor(v.stock)) : null,
          weight: w.weight,
          weightUnit: w.weightUnit,
        });
        if (product.variants.length >= MAX_VARIANTS) break;
      }
      product.price = 0;
      product.sku = "";
      product.barcode = "";
      product.weight = null;
      product.stock = null;
    } else {
      product.price = Math.max(0, money(tnFirst.price_number ?? null) ?? product.price);
      product.compareAtPrice = positiveOrNull(money(tnFirst.compare_at_price_number ?? null));
      product.sku = code(tnFirst.sku) || product.sku;
      product.barcode = code(tnFirst.barcode) || product.barcode;
      const w = weightToKg(decimal(tnFirst.weight ?? null), "kg");
      if (w.weight) Object.assign(product, w);
      if (typeof tnFirst.stock === "number") product.stock = Math.max(0, Math.floor(tnFirst.stock));
    }
    product.images = uniqueImages([...product.images, ...tn.map((v) => absoluteUrl(v.image_url, pageUrl))]);
    return product;
  }

  // Variantes como ProductGroup de schema.org (Shopify y otros temas nuevos).
  const variesBy = asArray(group?.variesBy as string[]).map((v) =>
    String(v).replace(/^https?:\/\/schema\.org\//i, ""),
  );
  if (variantNodes.length > 1 && variesBy.length > 0) {
    const optionNames = variesBy.slice(0, 3).map((v) => (OPTION_LABELS[v.toLowerCase()] ?? v).slice(0, 40));
    const seen = new Set<string>();
    for (const v of variantNodes) {
      const values = variesBy.slice(0, 3).map((prop) => text(v[prop] ?? v[prop.toLowerCase()]) || null);
      while (values.length < 3) values.push(null);
      const key = values.join("|").toLowerCase();
      if (!values[0] || seen.has(key)) continue;
      seen.add(key);
      const vOffer = jsonLdOffer(v);
      const w = jsonLdWeight(v);
      product.variants.push({
        option1Value: values[0],
        option2Value: values[1],
        option3Value: values[2],
        price: positiveOrNull(vOffer.price),
        sku: code(v.sku),
        barcode: jsonLdBarcode(v),
        stock: 0,
        weight: w.weight,
        weightUnit: w.weightUnit,
      });
      if (product.variants.length >= MAX_VARIANTS) break;
    }
    if (product.variants.length > 1) {
      product.hasVariants = true;
      product.optionNames = optionNames;
      product.price = 0;
      product.sku = "";
      product.barcode = "";
      product.weight = null;
      product.stock = null;
    } else {
      product.variants = [];
    }
  } else if (!product.price && offer.offers.length > 0) {
    product.price = Math.max(0, money(offer.offers[0].lowPrice ?? null) ?? 0);
  }

  return product;
}

const OPTION_LABELS: Record<string, string> = {
  color: "Color",
  size: "Talla",
  material: "Material",
  pattern: "Estampado",
};

/// Los nombres de las opciones (Color, Talla…) no vienen en data-variants;
/// Tiendanube los pone como etiqueta de cada selector variation_N.
function tiendanubeOptionNames(html: string, count: number) {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const re = new RegExp(`<label[^>]*for=["']variation_${i + 1}["'][^>]*>([\\s\\S]*?)</label>`, "i");
    const label = html.match(re)?.[1]?.replace(/<[^>]+>/g, "").replace(/[:*]/g, "").trim();
    names.push((label && decodeHtmlEntities(label)) || `Opción ${i + 1}`);
  }
  return names.map((n) => n.slice(0, 40));
}

// ---------------------------------------------------------------------------
// Sitemaps — para encontrar las páginas de producto y de categoría
// ---------------------------------------------------------------------------

export function parseSitemap(xml: string): { sitemaps: string[]; urls: string[] } {
  const locs = (tag: string) => {
    const out: string[] = [];
    const re = new RegExp(`<${tag}>[\\s\\S]*?<loc>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</loc>`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) out.push(decodeHtmlEntities(m[1].trim()));
    return out;
  };
  return { sitemaps: locs("sitemap"), urls: locs("url") };
}

export function sitemapsFromRobots(robots: string) {
  return robots
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*sitemap:\s*(\S+)/i)?.[1])
    .filter((v): v is string => Boolean(v));
}

const PRODUCT_PATH = /\/(products?|productos?|producto|item|items|articulo|articulos|p)\/[^/]+\/?$/i;
const CATEGORY_PATH =
  /\/(collections|coleccion|colecciones|categoria|categorias|category|categories|product-category|categoria-producto|c|departamento)\/[^/]+\/?$/i;

export function isProductUrl(url: string) {
  try {
    const path = new URL(url).pathname;
    return PRODUCT_PATH.test(path) || (/\/[^/]+\.html$/i.test(path) && /product|producto/i.test(path));
  } catch {
    return false;
  }
}

export function isCategoryUrl(url: string) {
  try {
    return CATEGORY_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function isProductSitemap(url: string) {
  return /product/i.test(url);
}

export function isCategorySitemap(url: string) {
  return /(collection|categor|product_cat)/i.test(url);
}

export function categoryNameFromUrl(url: string) {
  const handle = handleFromUrl(url);
  const name = handle.replace(/-/g, " ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

// ---------------------------------------------------------------------------
// Al shape del importador de Shopify
// ---------------------------------------------------------------------------

/// Un producto leído de otra plataforma, en el shape que ya importa
/// importar-shopify (el mismo del CSV y del link de Shopify). Sin precio →
/// borrador, igual que en el CSV.
export function toShopifyImport(p: ScrapedProduct): ShopifyImportProduct {
  const noPrice = p.hasVariants ? p.variants.every((v) => !v.price) : p.price <= 0;
  return {
    handle: p.handle,
    name: p.name,
    description: p.description,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    images: p.images,
    sku: p.sku,
    barcode: p.barcode,
    weight: p.weight,
    weightUnit: p.weightUnit,
    stock: p.stock,
    status: noPrice ? "DRAFT" : "ACTIVE",
    collectionName: p.collectionNames[0] ?? null,
    tags: p.collectionNames,
    hasVariants: p.hasVariants,
    optionNames: p.optionNames,
    variants: p.variants,
  };
}

/// Las categorías de la tienda como colecciones con sus productos (en el
/// orden en que se leyeron). Una categoría sin productos no se crea.
export function categoriesToCollections(products: ScrapedProduct[]): ShopifyImportCollection[] {
  const byKey = new Map<string, ShopifyImportCollection>();
  for (const p of products) {
    for (const name of p.collectionNames) {
      const key = name.trim().toLowerCase();
      let collection = byKey.get(key);
      if (!collection) {
        collection = {
          handle: slugify(name) || "coleccion",
          name,
          description: "",
          imageUrl: null,
          productsCount: null,
          sortOrder: "MANUAL",
          productHandles: [],
        };
        byKey.set(key, collection);
      }
      if (!collection.productHandles.includes(p.handle)) collection.productHandles.push(p.handle);
    }
  }
  return Array.from(byKey.values()).map((c) => ({ ...c, productsCount: c.productHandles.length }));
}

// ---------------------------------------------------------------------------
// Páginas informativas y menú de una tienda que no es Shopify
// ---------------------------------------------------------------------------

const POLICY_WORDS = /env[ií]o|despacho|cambio|devoluci|garant[ií]a|privacidad|datos personales|t[ée]rminos|condiciones|pol[ií]tica|shipping|refund|return|privacy|terms/i;
const INFO_WORDS = /nosotros|qui[eé]nes somos|historia|preguntas|faq|about|c[oó]mo comprar|medios de pago|contacto|contact/i;

export type InfoPageLink = { url: string; label: string; handle: string; kind: "page" | "policy" };

export function sameSiteUrl(url: URL, origin: string) {
  const host = (h: string) => h.replace(/^www\./, "").toLowerCase();
  return host(url.hostname) === host(new URL(origin).hostname);
}

/// Rutas de la tienda vieja que no son páginas de contenido: carrito,
/// cuenta, buscador, blog, catálogo (ese va a /collections/all), archivos.
const NOT_A_PAGE_RE =
  /^\/(?:cart|carrito|checkout|finalizar-compra|pagar|mi-cuenta|my-account|account|cuenta|login|ingresar|iniciar-sesion|registro|register|wp-admin|wp-login|wp-json|wp-content|feed|tag|etiqueta|author|autor|blog|noticias|news|search|buscar|wishlist|lista-de-deseos|favoritos|compare|comparar|tienda|shop|productos|products|catalogo|cat[aá]logo|collections|pages|policies|apps|password|challenge)(?:\/|$)/i;

/// Una ruta de la tienda vieja que parece una página de contenido
/// (quiénes somos, políticas, una página armada con el constructor): uno
/// o dos tramos, sin archivo, y que no es producto, categoría ni nada de
/// lo de arriba.
export function isStorePagePath(url: URL): boolean {
  const path = url.pathname;
  if (path === "/" || NOT_A_PAGE_RE.test(path) || /\.[a-z0-9]{2,5}$/i.test(path)) return false;
  if (isProductUrl(url.href) || isCategoryUrl(url.href)) return false;
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 1 && segments.length <= 2 && !segments.some((s) => /^\d{4}$/.test(s));
}

/// Los enlaces de la portada (menú y pie de página) a páginas de
/// contenido: políticas de envío, cambios, privacidad, términos, quiénes
/// somos, preguntas frecuentes y también las páginas armadas con el
/// constructor (una landing de "Semipermanentes", "Sé mayorista",
/// "Tutoriales"…). Es lo que en Shopify serían /pages/x y /policies/x.
/// Si hay más que `max`, las políticas e informativas van primero.
export function extractInfoPageLinks(html: string, origin: string, max = 16): InfoPageLink[] {
  const out: InfoPageLink[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(decodeHtmlEntities(m[1]), origin);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || !sameSiteUrl(url, origin)) continue;
    url.search = "";
    url.hash = "";
    if (!isStorePagePath(url)) continue;
    const href = url.toString();
    if (seen.has(href)) continue;
    const label = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 100);
    if (label.length < 2) continue;
    const haystack = `${label} ${decodeURIComponent(url.pathname)}`;
    seen.add(href);
    out.push({ url: href, label, handle: handleFromUrl(href) || "pagina", kind: POLICY_WORDS.test(haystack) ? "policy" : "page" });
  }
  if (out.length <= max) return out;
  const important = out.filter((p) => p.kind === "policy" || INFO_WORDS.test(`${p.label} ${p.handle}`));
  const rest = out.filter((p) => !important.includes(p));
  return [...important, ...rest].slice(0, max);
}

/// Un enlace del menú de otra plataforma traducido a la forma de Shopify
/// (/collections/x, /products/x, /pages/x), que es la que entiende la
/// importación del menú. null = enlace propio de la tienda vieja sin
/// equivalente acá (no se trae, para no mandar a la gente a la tienda
/// vieja).
export function menuHrefToShopify(href: string, origin: string, pageHandles: Set<string>): string | null {
  if (href.trim() === "#" || href.trim() === "") return "#";
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  if (!sameSiteUrl(url, origin)) return url.toString();
  if (url.pathname === "/" || url.pathname === "") return "/";
  const absolute = `${url.origin}${url.pathname}`;
  const handle = handleFromUrl(absolute);
  if (isProductUrl(absolute)) return `/products/${handle}`;
  if (isCategoryUrl(absolute)) return `/collections/${handle}`;
  if (pageHandles.has(handle)) return `/pages/${handle}`;
  if (/^\/(tienda|shop|productos|products|catalogo|cat[aá]logo)\/?$/i.test(url.pathname)) return "/collections/all";
  return null;
}
