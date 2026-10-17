import { decodeHtmlEntities } from "@/lib/html-entities";
import {
  isDefaultTitle,
  MAX_DESCRIPTION_LENGTH,
  MAX_IMAGES_PER_PRODUCT,
  MAX_PRODUCTS,
  PLACEHOLDER_CATEGORIES,
  positiveOrNull,
  slugify,
  splitTags,
  type ShopifyCsvParseResult,
  type ShopifyCsvStats,
  type ShopifyImportProduct,
  type ShopifyImportVariant,
} from "@/lib/shopify-csv";

/// Importar el catálogo desde el LINK de la tienda Shopify, sin que la
/// marca exporte nada (2026-10-17, para armarle la tienda a una marca
/// nueva antes de pedirle cualquier cosa): toda tienda Shopify pública
/// entrega su catálogo en https://latienda.com/products.json, de a
/// PAGE_SIZE productos por página (?page=N). Acá se convierte esa
/// respuesta al mismo shape que produce el CSV (ShopifyImportProduct), así
/// el resto del importador —vista previa, lotes, importShopifyProducts— es
/// uno solo para los dos caminos. Código puro: el que descarga es
/// shopify-store-reader.ts (servidor), porque el navegador no puede leer
/// otro dominio.
///
/// Qué NO trae el link, a diferencia del CSV: los productos en borrador o
/// no publicados en la tienda online (Shopify solo publica los activos) y
/// el código de barras. Igual que el CSV, tampoco trae cantidades de
/// inventario (solo un "disponible sí/no" por variante). Y si la tienda
/// tiene contraseña, Shopify no entrega nada.
export class ShopifyStoreError extends Error {}

export const PAGE_SIZE = 250;
/// Páginas que se leen como máximo: el mismo tope de productos que el CSV.
export const MAX_PAGES = Math.ceil(MAX_PRODUCTS / PAGE_SIZE);

export type ShopifyJsonVariant = {
  title?: string | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  sku?: string | null;
  price?: string | number | null;
  compare_at_price?: string | number | null;
  grams?: number | string | null;
  available?: boolean | null;
};

export type ShopifyJsonProduct = {
  id?: number | string;
  title?: string | null;
  handle?: string | null;
  body_html?: string | null;
  product_type?: string | null;
  tags?: string[] | string | null;
  published_at?: string | null;
  variants?: ShopifyJsonVariant[] | null;
  images?: ({ src?: string | null; position?: number | null } | null)[] | null;
  options?: ({ name?: string | null; values?: string[] | null } | null)[] | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/// Los precios vienen como texto con punto decimal ("15000.00").
function money(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/// "grams" siempre viene en gramos — Product.weight se guarda en kg.
function gramsToKg(value: unknown): number | null {
  const grams = money(value);
  if (grams == null || grams <= 0) return null;
  return Math.round(grams) / 1000;
}

/// El JSON no dice en qué unidad ve el peso la marca: menos de un kilo se
/// muestra en gramos.
function weightUnitFor(value: unknown): "KG" | "G" {
  const grams = money(value);
  return grams != null && grams > 0 && grams < 1000 ? "G" : "KG";
}

function cleanCode(value: unknown) {
  return text(value).replace(/^'+/, "").slice(0, 120);
}

/// Una página de /products.json es { products: [...] }. Se valida lo
/// mínimo para distinguirla de cualquier otra respuesta (una página HTML,
/// un JSON ajeno).
export function parseShopifyProductsPage(raw: unknown): ShopifyJsonProduct[] {
  const products = raw && typeof raw === "object" ? (raw as { products?: unknown }).products : null;
  if (!Array.isArray(products)) {
    throw new ShopifyStoreError(
      "Ese link no devolvió el catálogo de Shopify. Revisa que sea la dirección de la tienda (por ejemplo https://tumarca.myshopify.com).",
    );
  }
  return products.filter((p): p is ShopifyJsonProduct => Boolean(p) && typeof p === "object");
}

function collectImages(product: ShopifyJsonProduct) {
  const images = (product.images ?? [])
    .map((img, index) => ({
      url: text(img?.src),
      position: typeof img?.position === "number" ? img.position : Number.MAX_SAFE_INTEGER,
      index,
    }))
    .filter((img) => /^https?:\/\//i.test(img.url))
    .sort((a, b) => a.position - b.position || a.index - b.index);
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const img of images) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);
    urls.push(img.url);
    if (urls.length >= MAX_IMAGES_PER_PRODUCT) break;
  }
  return urls;
}

/// Igual que con el CSV: el Tipo de producto (texto libre de la marca) se
/// vuelve la colección. El JSON público no trae la categoría estándar.
function resolveCollectionName(product: ShopifyJsonProduct): string | null {
  const type = text(product.product_type);
  if (type.length < 2 || PLACEHOLDER_CATEGORIES.has(type.toLowerCase())) return null;
  return type.slice(0, 80);
}

/// Convierte los productos de una o varias páginas. Una lista vacía
/// devuelve un resultado vacío (una página después de la última): quien
/// lee decide si eso es "la tienda no tiene productos".
export function convertShopifyProducts(raw: ShopifyJsonProduct[]): ShopifyCsvParseResult {
  if (raw.length > MAX_PRODUCTS) {
    throw new ShopifyStoreError(
      `La tienda tiene ${raw.length} productos — el máximo por importación es ${MAX_PRODUCTS}. Usa el CSV en partes.`,
    );
  }
  const products: ShopifyImportProduct[] = [];
  const warnings: string[] = [];
  const stats: ShopifyCsvStats = { products: 0, withVariants: 0, images: 0, unknownStock: 0, draft: 0 };
  const seenHandles = new Set<string>();

  for (const item of raw) {
    const name = text(item.title).slice(0, 255);
    if (!name) {
      warnings.push(`"${text(item.handle) || item.id || "?"}": no tiene título — se omitió.`);
      continue;
    }
    const handle = (text(item.handle) || slugify(name) || `producto-${item.id ?? products.length + 1}`).slice(0, 255);
    // El mismo producto en dos páginas (si el catálogo cambió mientras se leía).
    if (seenHandles.has(handle)) continue;
    seenHandles.add(handle);

    const optionNames: string[] = [];
    for (const option of (item.options ?? []).slice(0, 3)) {
      const optionName = text(option?.name);
      if (!optionName) break;
      optionNames.push(optionName.slice(0, 40));
    }
    const rawVariants = (item.variants ?? []).filter(
      (v): v is ShopifyJsonVariant => Boolean(v) && typeof v === "object",
    );
    if (optionNames.length > 0 && isDefaultTitle(optionNames[0], text(rawVariants[0]?.option1))) {
      optionNames.length = 0;
    }
    const hasVariants = optionNames.length > 0 && rawVariants.some((v) => text(v.option1));
    const base = rawVariants[0];

    const images = collectImages(item);
    const description = text(item.body_html).slice(0, MAX_DESCRIPTION_LENGTH);
    const collectionName = resolveCollectionName(item);
    const tags = splitTags(item.tags);
    // Todo lo que Shopify publica en products.json está activo; si viene
    // sin fecha de publicación, mejor que entre como borrador.
    let status: "ACTIVE" | "DRAFT" = item.published_at === null ? "DRAFT" : "ACTIVE";

    if (hasVariants) {
      const seen = new Set<string>();
      const variants: ShopifyImportVariant[] = [];
      for (const v of rawVariants) {
        const values = [v.option1, v.option2, v.option3].map((value, i) =>
          i < optionNames.length ? text(value) || null : null,
        );
        if (!values[0]) continue;
        const key = values.map((x) => (x ?? "").toLowerCase()).join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        variants.push({
          option1Value: values[0],
          option2Value: values[1],
          option3Value: values[2],
          price: positiveOrNull(money(v.price)),
          sku: cleanCode(v.sku),
          barcode: "",
          // El link solo dice si la variante está disponible, no cuántas
          // hay: queda en 0 (agotada) hasta que la marca le ponga stock,
          // igual que con el CSV.
          stock: 0,
          weight: gramsToKg(v.grams),
          weightUnit: weightUnitFor(v.grams),
        });
      }
      stats.withVariants++;
      products.push({
        handle,
        name,
        description,
        price: 0,
        compareAtPrice: null,
        images,
        sku: "",
        barcode: "",
        weight: null,
        weightUnit: weightUnitFor(base?.grams),
        stock: null,
        status,
        collectionName,
        tags,
        hasVariants: true,
        optionNames,
        variants,
      });
    } else {
      const price = Math.max(0, money(base?.price) ?? 0);
      if (price <= 0) {
        warnings.push(`"${name}": no tiene precio — queda en borrador hasta que le pongas uno.`);
        status = "DRAFT";
      }
      products.push({
        handle,
        name,
        description,
        price,
        compareAtPrice: positiveOrNull(money(base?.compare_at_price)),
        images,
        sku: cleanCode(base?.sku),
        barcode: "",
        weight: gramsToKg(base?.grams),
        weightUnit: weightUnitFor(base?.grams),
        stock: null,
        status,
        collectionName,
        tags,
        hasVariants: false,
        optionNames: [],
        variants: [],
      });
    }

    stats.products++;
    stats.images += images.length;
    stats.unknownStock++;
    if (products[products.length - 1]?.status === "DRAFT") stats.draft++;
  }

  return { products, warnings, stats };
}

// ----------------------------------------------------------------------------
// Colecciones — /collections.json (y /collections/{handle}/products.json
// para saber qué producto va en cuál). Ver conversación del 2026-10-17:
// traer las colecciones como las tiene la marca y organizar los productos.
// ----------------------------------------------------------------------------

export type ShopifyJsonCollection = {
  id?: number | string;
  handle?: string | null;
  title?: string | null;
  body_html?: string | null;
  published_at?: string | null;
  sort_order?: string | null;
  products_count?: number | null;
  image?: { src?: string | null } | null;
};

export type ShopifyCollectionSortOrder = "MANUAL" | "ALPHA_ASC" | "ALPHA_DESC" | "PRICE_ASC" | "PRICE_DESC" | "NEWEST";

export type ShopifyImportCollection = {
  handle: string;
  name: string;
  /// Texto plano (la descripción de Shopify viene en HTML).
  description: string;
  imageUrl: string | null;
  productsCount: number | null;
  sortOrder: ShopifyCollectionSortOrder;
  /// Handles de sus productos, en el orden de la colección — se llenan
  /// leyendo /collections/{handle}/products.json (ver shopify-importer.tsx).
  productHandles: string[];
};

/// "frontpage" es la colección de la portada de Shopify (los destacados)
/// y "all" es virtual: ninguna es una categoría de verdad.
const SKIPPED_COLLECTION_HANDLES = new Set(["frontpage", "all"]);

const SORT_ORDER_MAP: Record<string, ShopifyCollectionSortOrder> = {
  manual: "MANUAL",
  "alpha-asc": "ALPHA_ASC",
  "alpha-desc": "ALPHA_DESC",
  "price-asc": "PRICE_ASC",
  "price-desc": "PRICE_DESC",
  "created-desc": "NEWEST",
};

/// Quita las etiquetas HTML y deja el texto (para descripciones de
/// colección, que en Marcolini son texto plano).
export function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h[1-6]>/gi, "\n").replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function imageSrc(value: unknown): string | null {
  const src = text(value);
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  return null;
}

export function parseShopifyCollectionsPage(raw: unknown): ShopifyJsonCollection[] {
  const collections = raw && typeof raw === "object" ? (raw as { collections?: unknown }).collections : null;
  if (!Array.isArray(collections)) {
    throw new ShopifyStoreError("Ese link no devolvió las colecciones de Shopify.");
  }
  return collections.filter((c): c is ShopifyJsonCollection => Boolean(c) && typeof c === "object");
}

export function convertShopifyCollections(raw: ShopifyJsonCollection[]): ShopifyImportCollection[] {
  const out: ShopifyImportCollection[] = [];
  const seen = new Set<string>();
  for (const c of raw) {
    const handle = text(c.handle).toLowerCase();
    const name = text(c.title).slice(0, 80);
    if (!handle || name.length < 2 || SKIPPED_COLLECTION_HANDLES.has(handle) || seen.has(handle)) continue;
    if (c.published_at === null) continue;
    if (typeof c.products_count === "number" && c.products_count <= 0) continue;
    seen.add(handle);
    out.push({
      handle,
      name,
      description: htmlToText(text(c.body_html)).slice(0, 500),
      imageUrl: imageSrc(c.image?.src),
      productsCount: typeof c.products_count === "number" ? c.products_count : null,
      sortOrder: SORT_ORDER_MAP[text(c.sort_order).toLowerCase()] ?? "MANUAL",
      productHandles: [],
    });
  }
  return out;
}

/// /collections/{handle}/products.json trae los productos de esa colección
/// en su orden — acá solo interesan los handles.
export function collectionProductHandles(raw: unknown): string[] {
  const handles: string[] = [];
  const seen = new Set<string>();
  for (const product of parseShopifyProductsPage(raw)) {
    const handle = text(product.handle);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    handles.push(handle);
  }
  return handles;
}
