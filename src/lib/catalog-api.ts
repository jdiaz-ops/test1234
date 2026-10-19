import { decodeHtmlEntities } from "@/lib/html-entities";
import { slugify } from "@/lib/shopify-csv";
import { plainTextToHtml, type ScrapedProduct } from "@/lib/store-scrape";

/// Tiendas hechas a la medida con un catálogo en /api/v1 (como
/// blissednails.co): la vitrina es una aplicación que pide los productos a
/// su propia API — /api/v1/productos?page=&per_page=&q= devuelve
/// { total, page, per_page, items } y /api/v1/categorias el árbol de
/// categorías —, así que no hay páginas de producto que leer. Acá vive lo
/// puro: reconocer la respuesta y pasar cada producto al formato del
/// importador; las descargas están en other-store-reader.ts. Pedido del
/// 2026-10-19: "solo lo de la marca shikle https://blissednails.co/catalogo".
///
/// Las fotos se usan tal como la tienda las sirve (con su marca de agua):
/// nunca se busca la original detrás del token.

export const CATALOG_API_PATH = "/api/v1";
/// Productos por llamada (la vitrina pide de a 24; la API acepta 100).
export const CATALOG_PAGE_SIZE = 100;

export type CatalogApiItem = {
  id: number | string;
  codigo?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  nombre_grupo?: string | null;
  precio_visible?: string | number | null;
  precio_original?: string | number | null;
  precio_con_descuento?: string | number | null;
  imagen_url_resuelto?: string | null;
  imagenes?: unknown;
  estado?: string | null;
  categorias?: (number | string)[] | null;
};

export type CatalogApiPage = { total: number; items: CatalogApiItem[] };

export type CatalogCategory = { id: number; name: string; parentId: number | null };

/// La respuesta de /api/v1/productos, o null si no es esa API.
export function parseCatalogPage(body: unknown): CatalogApiPage | null {
  if (!body || typeof body !== "object") return null;
  const { total, items } = body as { total?: unknown; items?: unknown };
  if (typeof total !== "number" || !Array.isArray(items)) return null;
  const valid = items.filter((i): i is CatalogApiItem => Boolean(i) && typeof i === "object" && "id" in i && typeof (i as { nombre?: unknown }).nombre === "string");
  if (items.length > 0 && valid.length === 0) return null;
  return { total, items: valid };
}

/// El árbol de /api/v1/categorias, aplanado. Acepta la lista plana o con
/// children anidados.
export function parseCatalogCategories(body: unknown): CatalogCategory[] {
  const out = new Map<number, CatalogCategory>();
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as { id?: unknown; nombre?: unknown; parent_id?: unknown; children?: unknown };
      const id = Number(n.id);
      if (Number.isFinite(id) && typeof n.nombre === "string" && n.nombre.trim()) {
        const parent = n.parent_id == null ? null : Number(n.parent_id);
        out.set(id, { id, name: decodeHtmlEntities(n.nombre).trim().slice(0, 80), parentId: parent != null && Number.isFinite(parent) ? parent : null });
      }
      walk(n.children);
    }
  };
  const list = Array.isArray(body) ? body : body && typeof body === "object" ? ((body as { items?: unknown; categorias?: unknown }).items ?? (body as { categorias?: unknown }).categorias) : null;
  walk(list);
  return Array.from(out.values());
}

/// Para cada categoría, el nombre de su categoría de primer nivel ("Shikle
/// Gel" dentro de "Builder Gel" → "Builder Gel"): es la que sirve de
/// colección — las de segundo nivel mezclan marcas y tipos, y una misma
/// marca aparece en varias ramas.
export function topCategoryNames(categories: CatalogCategory[]): Record<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: Record<string, string> = {};
  for (const c of categories) {
    let node: CatalogCategory | undefined = c;
    for (let hops = 0; node?.parentId != null && hops < 10; hops++) node = byId.get(node.parentId) ?? node;
    if (node) out[String(c.id)] = node.name;
  }
  return out;
}

function amount(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function absolute(url: string, origin: string): string | null {
  try {
    const u = new URL(url, origin);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/// Las fotos del producto, tal como las sirve la tienda.
function imagesOf(item: CatalogApiItem, origin: string): string[] {
  const urls: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return;
    const url = absolute(value.trim(), origin);
    if (url && !urls.includes(url)) urls.push(url);
  };
  if (Array.isArray(item.imagenes)) {
    for (const img of item.imagenes) {
      if (typeof img === "string") add(img);
      else if (img && typeof img === "object") {
        const o = img as Record<string, unknown>;
        add(o.url_resuelto ?? o.url ?? o.src ?? o.imagen);
      }
    }
  }
  if (urls.length === 0) add(item.imagen_url_resuelto);
  return urls.slice(0, 20);
}

/// Un producto de la API al formato del importador. Inventario: no se lee
/// (saldo_general viene en 0 aunque el producto se venda), queda "sin
/// control" para que la marca lo ponga.
export function parseCatalogItem(item: CatalogApiItem, origin: string, topNames: Record<string, string>): ScrapedProduct | null {
  const name = decodeHtmlEntities(item.nombre ?? "").replace(/\s+/g, " ").trim().slice(0, 255);
  if (!name || (item.estado && item.estado !== "activo")) return null;
  const visible = amount(item.precio_visible);
  const discounted = amount(item.precio_con_descuento);
  const original = amount(item.precio_original);
  const price = discounted ?? visible ?? 0;
  const before = Math.max(discounted && visible ? visible : 0, original ?? 0);
  const code = (item.codigo ?? "").toString().trim().slice(0, 120);
  const collections = Array.from(new Set((item.categorias ?? []).map((c) => topNames[String(c)]).filter((n): n is string => Boolean(n))));
  return {
    handle: `${slugify(name) || "producto"}-${item.id}`,
    name,
    description: plainTextToHtml(decodeHtmlEntities(item.descripcion ?? "").trim()).slice(0, 20000),
    price,
    compareAtPrice: before > price ? before : null,
    currency: "COP",
    images: imagesOf(item, origin),
    sku: code,
    barcode: /^\d{8,14}$/.test(code) ? code : "",
    weight: null,
    weightUnit: "KG",
    stock: null,
    collectionNames: collections,
    hasVariants: false,
    optionNames: [],
    variants: [],
    sourceUrl: `${origin}/catalogo?producto=${encodeURIComponent(String(item.id))}`,
  };
}

/// La búsqueda que trae el link pegado ("…/catalogo?q=shikle"), para pedirle
/// a la API solo esos productos.
export function catalogQueryFromInput(input: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    for (const key of ["q", "buscar", "busqueda", "search", "s"]) {
      const value = url.searchParams.get(key)?.trim();
      if (value) return value.slice(0, 80);
    }
  } catch {
    // sin búsqueda
  }
  return null;
}

export function catalogProductsUrl(origin: string, page: number, query: string | null) {
  const params = new URLSearchParams({ page: String(page), per_page: String(CATALOG_PAGE_SIZE) });
  if (query) params.set("q", query);
  return `${origin}${CATALOG_API_PATH}/productos?${params}`;
}
