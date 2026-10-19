import { nicheCategoryOf, normalizeText, proposeCollectionsByRules, OTHER_COLLECTION_NAME } from "@/lib/shopify-categorize";
import { proposeMergeByRules } from "@/lib/collection-merge";
import { slugify } from "@/lib/shopify-csv";
import { normalizeBannerConfig, SECTION_TYPE_LABEL, type SectionType } from "@/lib/storefront-sections";

/// Organizador automático de tienda — la parte pura (sin red ni base de
/// datos). Recibe el catálogo tal como quedó (importado o armado a mano)
/// y decide cómo debería verse una tienda que vende: qué colecciones
/// existen y cómo se llaman, en qué colección va cada producto, en qué
/// orden van las colecciones y los productos (lo más pedido primero, lo
/// agotado al final), cómo se arma el menú y qué secciones lleva la
/// portada. La estructura la propone la IA (store-organizer-ai-service.ts)
/// o, sin llave, las reglas de acá; el puntaje de demanda es siempre de
/// reglas, con las ventas reales de Marcolini cuando las hay. Lo aplica
/// store-organizer-service.ts. Pedido el 2026-10-19: "recibamos tiendas
/// horribles como Rumi con cientos de productos y 0 estructura, y la
/// herramienta, sin intervención manual, la haga un ecommerce ordenado".

export type OrganizerProduct = {
  id: string;
  name: string;
  /// Texto plano (sin HTML).
  description: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  images: number;
  stock: number | null;
  hasVariants: boolean;
  variantStocks: (number | null)[];
  /// Valores de las variantes (tonos, tamaños…), para la ficha.
  variantLabels: string[];
  /// Se vende hoy (activo y disponible). Un borrador se organiza pero no
  /// pesa en el orden ni sale en la portada.
  active: boolean;
  createdAt: Date;
  featured: boolean;
  /// Lugar en el orden de creación (0 = el primero que entró): en una
  /// tienda importada es el orden en que la tienda vieja listaba.
  sourcePosition: number;
  collectionIds: string[];
  /// Unidades vendidas en Marcolini (pedidos pagados).
  sold90: number;
  soldAll: number;
  reviews: number;
  rating: number | null;
};

export type OrganizerCollection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  /// Banner propio de la página de la colección (importado o subido).
  bannerUrl: string | null;
  position: number;
  productIds: string[];
};

/// Lo que propone la IA (o las reglas): colecciones principales con sus
/// productos y, si hace falta, subcolecciones; y nombres de producto
/// mejores. Los ids son los de Marcolini.
export type StructureProposal = {
  collections: ProposedStructureCollection[];
  productNames: { id: string; name: string }[];
};

export type ProposedStructureCollection = {
  name: string;
  description?: string;
  productIds: string[];
  children?: { name: string; productIds: string[] }[];
};

export type PlannedCollection = {
  /// Identificador dentro del plan (slug propuesto).
  key: string;
  /// Colección que ya existe y se reutiliza (conserva su link y su foto).
  existingId: string | null;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  /// En el orden en que se mostrarán (más demanda primero, agotados al final).
  productIds: string[];
  demand: number;
  /// Unidades vendidas por sus productos (para explicar el orden).
  sold: number;
  children: PlannedCollection[];
};

export type PlannedMenuItem = { label: string; url: string; children: PlannedMenuItem[] };

/// Una sección de la portada. BANNER es el banner que arma el organizador
/// (lo pinta /api/banner con los colores y la letra del tema más la foto
/// de la colección, ver banner-image.ts); KEEP conserva una sección que
/// la tienda ya tenía (un banner, video o foto importada que aporta).
/// Pedido el 2026-10-19: "que use imágenes que tengan sentido y que cree
/// banners si es necesario usando el estilo fiel de la tienda duplicada".
export type HomeSectionPlan =
  | { type: "BANNER"; collectionKey: string; imageUrl: string; title: string; subtitle: string; buttonText: string }
  | { type: "KEEP"; sectionId: string; label: string }
  | { type: "CATEGORY_GRID"; title: string; collectionKeys: string[] }
  | { type: "CATEGORY_BANNERS"; collectionKeys: string[] }
  | { type: "FEATURED_COLLECTION"; collectionKey: string; title: string }
  | { type: "FEATURED_PRODUCTS"; title: string; productIds: string[] }
  | { type: "ON_SALE_PRODUCTS"; title: string }
  | { type: "NEW_PRODUCTS"; title: string }
  | { type: "TEXT"; heading: string; body: string }
  | { type: "SHIPPING_INFO_BANNERS"; whatsapp: boolean }
  | { type: "INSTAGRAM_CTA" }
  | { type: "PRODUCT_CATALOG"; title: string };

/// Resumen de una sección que la portada ya tiene (activa), con lo que
/// hace falta para decidir si se conserva. Ver summarizeExistingSection.
export type ExistingSectionSummary = {
  id: string;
  type: string;
  /// Para la IA y la vista previa: "Banner ancho con 3 fotos".
  label: string;
  /// Tiene foto o video propio: vale la pena conservarla.
  visual: boolean;
  /// Banner ancho con foto: hace de cabecera, no se arma otra.
  hero: boolean;
  /// Colecciones a las que apunta; si alguna desaparece con el plan, la
  /// sección no se conserva.
  collectionIds: string[];
  /// Texto propio (TEXT), para que la IA decida si es un mensaje de marca.
  text: string;
};

export type OrganizerPlan = {
  source: "ia" | "reglas";
  collections: PlannedCollection[];
  /// Colecciones actuales que desaparecen (sus productos quedan en las
  /// nuevas). Se guardan en la copia para poder deshacer.
  removedCollections: { id: string; name: string; slug: string; count: number; movedTo: string | null }[];
  productNames: { id: string; from: string; to: string }[];
  menu: PlannedMenuItem[];
  home: HomeSectionPlan[];
  /// Frase para la barra de anuncio (solo se pone si la tienda no tiene).
  announcement: string | null;
  /// Por qué la portada quedó así (lo explica la IA; null por reglas).
  notes: string | null;
  /// Fichas de producto reescritas por la IA (ver describeProductsWithClaude).
  productDescriptions: PlannedDescription[];
  /// Las colecciones principales sin banner reciben uno pintado con el
  /// estilo de la tienda (ver banner-image.ts).
  collectionBanners: boolean;
  /// Ajustes del tema que ayudan a vender (ver planSettings).
  settings: StoreSettingsPlan;
  stats: {
    products: number;
    active: number;
    soldOut: number;
    withSales: number;
    collectionsBefore: number;
    collectionsAfter: number;
    subcollections: number;
    renamed: number;
    discounted: number;
  };
};

// ---------------------------------------------------------------------------
// Puntaje de demanda
// ---------------------------------------------------------------------------

/// Cuánto pesa cada señal (sobre 100). Las ventas reales mandan; lo demás
/// desempata y sirve en una tienda recién importada, que todavía no tiene
/// pedidos en Marcolini.
export const SCORE_WEIGHTS = {
  sold90: 40,
  soldAll: 15,
  reviews: 10,
  discount: 6,
  photo: 5,
  morePhotos: 3,
  description: 6,
  shortDescription: 3,
  recent: 5,
  featured: 8,
  sourceOrder: 5,
} as const;

export const DESCRIPTION_GOOD = 120;
export const DESCRIPTION_SHORT = 40;
export const RECENT_DAYS = 30;
/// Un agotado conserva una décima de su puntaje: sigue ordenado entre los
/// agotados, pero siempre después de los disponibles.
export const SOLD_OUT_FACTOR = 0.1;

export function isSoldOutProduct(p: { stock: number | null; hasVariants: boolean; variantStocks: (number | null)[] }) {
  if (p.hasVariants) return p.variantStocks.length > 0 && p.variantStocks.every((s) => s != null && s <= 0);
  return p.stock != null && p.stock <= 0;
}

function logShare(value: number, max: number) {
  if (max <= 0 || value <= 0) return 0;
  return Math.log1p(value) / Math.log1p(max);
}

export type ProductScore = { score: number; soldOut: boolean; sold: number };

/// Puntaje 0–100 por producto. Las ventas de los últimos 90 días valen
/// más que las históricas; sin ventas, pesan la calidad de la ficha, el
/// descuento, lo reciente y el orden en que la tienda vieja los tenía.
export function scoreProducts(products: OrganizerProduct[], now = new Date()): Map<string, ProductScore> {
  const maxSold90 = Math.max(0, ...products.map((p) => p.sold90));
  const maxSoldAll = Math.max(0, ...products.map((p) => p.soldAll));
  const maxReviews = Math.max(0, ...products.map((p) => p.reviews));
  const maxPosition = Math.max(0, ...products.map((p) => p.sourcePosition));
  const out = new Map<string, ProductScore>();
  for (const p of products) {
    let score = 0;
    score += SCORE_WEIGHTS.sold90 * logShare(p.sold90, maxSold90);
    score += SCORE_WEIGHTS.soldAll * logShare(p.soldAll, maxSoldAll);
    score += SCORE_WEIGHTS.reviews * logShare(p.reviews, maxReviews) * ((p.rating ?? 4) / 5);
    if (p.compareAtPrice != null && p.compareAtPrice > p.price) score += SCORE_WEIGHTS.discount;
    if (p.imageUrl || p.images > 0) score += SCORE_WEIGHTS.photo;
    if (p.images >= 2) score += SCORE_WEIGHTS.morePhotos;
    const descriptionLength = p.description.trim().length;
    if (descriptionLength >= DESCRIPTION_GOOD) score += SCORE_WEIGHTS.description;
    else if (descriptionLength >= DESCRIPTION_SHORT) score += SCORE_WEIGHTS.shortDescription;
    const ageDays = Math.max(0, (now.getTime() - p.createdAt.getTime()) / 86_400_000);
    if (ageDays <= RECENT_DAYS) score += SCORE_WEIGHTS.recent * (1 - ageDays / RECENT_DAYS);
    if (p.featured) score += SCORE_WEIGHTS.featured;
    if (maxPosition > 0) score += SCORE_WEIGHTS.sourceOrder * (1 - p.sourcePosition / maxPosition);
    const soldOut = isSoldOutProduct(p);
    if (soldOut) score *= SOLD_OUT_FACTOR;
    out.set(p.id, { score: Math.round(score * 100) / 100, soldOut, sold: p.soldAll });
  }
  return out;
}

/// Orden de una lista de productos: disponibles por puntaje, después los
/// agotados por puntaje, y los borradores al final. En empate, el orden
/// original (sourcePosition) y el nombre.
export function rankProductIds(ids: string[], scores: Map<string, ProductScore>, byId: Map<string, OrganizerProduct>): string[] {
  const tier = (id: string) => {
    const p = byId.get(id);
    const s = scores.get(id);
    if (!p || !s) return 3;
    if (!p.active) return 2;
    return s.soldOut ? 1 : 0;
  };
  return Array.from(new Set(ids))
    .filter((id) => byId.has(id))
    .sort((a, b) => {
      const t = tier(a) - tier(b);
      if (t !== 0) return t;
      const s = (scores.get(b)?.score ?? 0) - (scores.get(a)?.score ?? 0);
      if (s !== 0) return s;
      const pa = byId.get(a)!;
      const pb = byId.get(b)!;
      return pa.sourcePosition - pb.sourcePosition || pa.name.localeCompare(pb.name, "es");
    });
}

/// Demanda de una colección: el promedio de sus mejores productos, con un
/// empujón por tamaño (una colección de 30 productos pesa más que una de
/// 3 con el mismo promedio). Los agotados y borradores no suman.
export function collectionDemand(productIds: string[], scores: Map<string, ProductScore>, byId: Map<string, OrganizerProduct>): number {
  const live = productIds
    .map((id) => ({ p: byId.get(id), s: scores.get(id) }))
    .filter((x): x is { p: OrganizerProduct; s: ProductScore } => Boolean(x.p && x.s && x.p.active && !x.s.soldOut))
    .map((x) => x.s.score)
    .sort((a, b) => b - a);
  if (live.length === 0) return 0;
  const top = live.slice(0, 8);
  const mean = top.reduce((sum, s) => sum + s, 0) / top.length;
  return Math.round(mean * (1 + Math.log1p(live.length) / 4) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Nombres de producto
// ---------------------------------------------------------------------------

const UNIT_WORDS: Record<string, string> = {
  ml: "ml",
  gr: "g",
  grs: "g",
  g: "g",
  kg: "kg",
  cm: "cm",
  mm: "mm",
  oz: "oz",
  und: "und",
  unds: "und",
  uds: "und",
  pcs: "pcs",
  uv: "UV",
  led: "LED",
};

function isMostlyUppercase(name: string) {
  const letters = name.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, "");
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "").length;
  return upper / letters.length >= 0.8;
}

/// Limpia un nombre de producto sin inventar nada: espacios dobles,
/// mayúsculas sostenidas ("VELOTERAPIA SANDIA 50GR" → "Veloterapia sandia
/// 50 g"), unidades pegadas al número y "X12" → "x12". No pone tildes (no
/// se puede saber dónde van): eso lo hace la IA cuando está.
export function cleanProductName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  if (!name) return raw;
  if (isMostlyUppercase(name)) {
    name = name.toLowerCase();
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  // "50GR" → "50 g", "30ML" → "30 ml", "12UND" → "12 und".
  name = name.replace(/(\d)\s?(ml|grs?|g|kg|cm|mm|oz|unds?|uds|pcs)\b\.?/gi, (_m, n: string, unit: string) => `${n} ${UNIT_WORDS[unit.toLowerCase()] ?? unit.toLowerCase()}`);
  // Siglas que siempre van en mayúscula.
  name = name.replace(/\b(uv|led)\b/gi, (m) => UNIT_WORDS[m.toLowerCase()] ?? m);
  // "X12" / "X 12" → "x12".
  name = name.replace(/\b[xX]\s?(\d+)\b/g, "x$1");
  return name.trim();
}

// ---------------------------------------------------------------------------
// Estructura por reglas (cuando no hay IA)
// ---------------------------------------------------------------------------

export const MAX_MAIN_COLLECTIONS = 8;
export const MIN_COLLECTION_PRODUCTS = 2;
/// Cuántas colecciones principales van en la barra del menú; el resto va
/// bajo "Más".
export const MENU_TOP_ITEMS = 7;
export const MAX_NAME = 40;

function collectionNameKey(name: string) {
  return normalizeText(name);
}

/// Una colección que es una medida o una gama ("15ml", "Gama rojos",
/// "Tonos nude") no es una categoría de producto: se usa de último.
export function isVariantLikeName(name: string) {
  const key = collectionNameKey(name);
  return /^\d+\s?(ml|g|gr|grs|kg|mm|cm|oz|und|unds|pcs)$/.test(key) || /^(gama|gamas|tono|tonos|color|colores|tamanos?|medidas?|talla|tallas)\b/.test(key);
}

/// "Más vendidos", "Nuevos", "Ofertas", "Colecciones": agrupaciones de
/// mercadeo, no categorías de producto (la portada ya las arma sola).
export function isMarketingName(name: string) {
  return /vendid|nuevo|novedad|oferta|promo|descuent|colecci|destacad|best|favorit|tendencia|temporada|liquidaci|outlet|sin categor/.test(collectionNameKey(name));
}

const CATEGORY_STOP_WORDS = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "o", "u", "para", "con", "en", "por", "sin", "a", "otros", "todo", "todos"]);

/// "Herramientas" y "Herramientas y equipos" son la misma categoría: mismo
/// nombre normalizado, uno contiene al otro, o comparten la primera
/// palabra significativa.
export function sameCategoryName(a: string, b: string) {
  const ka = collectionNameKey(a);
  const kb = collectionNameKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  const first = (key: string) => key.split(" ").find((w) => w.length >= 4 && !CATEGORY_STOP_WORDS.has(w)) ?? "";
  const fa = first(ka);
  const fb = first(kb);
  return Boolean(fa) && fa === fb;
}

/// Sin IA: se parte de las colecciones que hay (unidas las repetidas y las
/// chicas que comparten nombre, ver collection-merge.ts); cada producto se
/// queda en su colección más específica que sea una categoría de verdad
/// (no una medida, una gama ni "Más vendidos"); se conservan hasta
/// MAX_MAIN_COLLECTIONS, las más grandes; lo demás (y lo que estaba
/// suelto) se clasifica por las palabras del nicho dentro de esas, o en
/// "Otros productos". Si no había ninguna colección, todo se arma por
/// palabras. Cada producto queda en exactamente una colección.
export function proposeStructureByRules(products: OrganizerProduct[], collections: OrganizerCollection[]): StructureProposal {
  const byId = new Map(products.map((p) => [p.id, p]));
  const assigned = new Set<string>();

  const sources = collections
    .map((c) => ({ handle: c.slug, name: c.name, productHandles: c.productIds.filter((id) => byId.has(id)) }))
    .filter((c) => c.productHandles.length > 0);
  const merged = proposeMergeByRules(sources);
  const base = merged ? merged.collections.map((m) => ({ name: m.name, productIds: m.productHandles })) : sources.map((s) => ({ name: s.name, productIds: s.productHandles }));

  // 1. Cada producto en su colección más específica que sea una categoría
  // de verdad; las medidas, gamas y agrupaciones de mercadeo, de último.
  const isReal = (name: string) => !isVariantLikeName(name) && !isMarketingName(name);
  const byCount = base.slice().sort((a, b) => a.productIds.length - b.productIds.length);
  const groups: { name: string; productIds: string[]; real: boolean }[] = [];
  for (const group of [...byCount.filter((g) => isReal(g.name)), ...byCount.filter((g) => !isReal(g.name))]) {
    const ids = group.productIds.filter((id) => !assigned.has(id));
    if (ids.length === 0) continue;
    for (const id of ids) assigned.add(id);
    groups.push({ name: group.name.trim().slice(0, MAX_NAME), productIds: ids, real: isReal(group.name) });
  }

  // 2. Se conservan las categorías de verdad más grandes; el resto se
  // disuelve.
  const ranked = groups.filter((g) => g.real && g.productIds.length >= MIN_COLLECTION_PRODUCTS).sort((a, b) => b.productIds.length - a.productIds.length);
  const kept: { name: string; productIds: string[] }[] = ranked.slice(0, MAX_MAIN_COLLECTIONS).map((g) => ({ name: g.name, productIds: g.productIds.slice() }));
  const keptNames = new Set(kept.map((k) => k.name));
  const strays = [
    ...groups.filter((g) => !keptNames.has(g.name)).flatMap((g) => g.productIds),
    ...products.filter((p) => !assigned.has(p.id)).map((p) => p.id),
  ];

  // 3. Lo disuelto y lo suelto, por las palabras del nicho: dentro de una
  // conservada que sea esa categoría, o como categoría nueva si cabe, o
  // en "Otros productos".
  const others: string[] = [];
  if (strays.length > 0) {
    const proposal = proposeCollectionsByRules(strays.map((id) => ({ handle: id, name: byId.get(id)?.name ?? "" })));
    for (const category of proposal.collections) {
      if (category.name === OTHER_COLLECTION_NAME) {
        others.push(...category.productHandles);
        continue;
      }
      const target =
        kept.find((g) => collectionNameKey(g.name) === collectionNameKey(category.name)) ??
        kept.find((g) => sameCategoryName(g.name, category.name)) ??
        kept.find((g) => nicheCategoryOf(g.name) === category.name);
      if (target) target.productIds.push(...category.productHandles);
      else if (category.productHandles.length >= MIN_COLLECTION_PRODUCTS && kept.length < MAX_MAIN_COLLECTIONS) kept.push({ name: category.name, productIds: category.productHandles });
      else others.push(...category.productHandles);
    }
  }
  if (others.length > 0) kept.push({ name: OTHER_COLLECTION_NAME, productIds: Array.from(new Set(others)) });

  const productNames = products
    .map((p) => ({ id: p.id, name: cleanProductName(p.name) }))
    .filter((n) => n.name !== byId.get(n.id)!.name);
  return { collections: kept.map((g) => ({ name: g.name, productIds: g.productIds })), productNames };
}

// ---------------------------------------------------------------------------
// Armar la propuesta con lo que la IA respondió por pasos
// ---------------------------------------------------------------------------

export type StructureDefinition = { name: string; description: string; children: string[] };
export type StructureAssignment = { id: string; collection: string; child: string | null };

/// Junta las colecciones definidas (paso 1) con las asignaciones de cada
/// tanda (paso 2) en una propuesta; lo que no se asignó cae en "Otros
/// productos" al limpiar (sanitizeStructure).
export function structureFromAssignments(
  definitions: StructureDefinition[],
  assignments: StructureAssignment[],
  productNames: { id: string; name: string }[],
): StructureProposal {
  const collections = definitions.map((d) => ({
    name: d.name,
    description: d.description,
    productIds: [] as string[],
    children: d.children.map((name) => ({ name, productIds: [] as string[] })),
  }));
  const byName = new Map(collections.map((c) => [collectionNameKey(c.name), c]));
  let others: ProposedStructureCollection | null = null;
  for (const a of assignments) {
    const target = byName.get(collectionNameKey(a.collection));
    if (!target) {
      others ??= { name: OTHER_COLLECTION_NAME, productIds: [] };
      others.productIds.push(a.id);
      continue;
    }
    target.productIds.push(a.id);
    if (a.child) target.children.find((ch) => collectionNameKey(ch.name) === collectionNameKey(a.child!))?.productIds.push(a.id);
  }
  return {
    collections: [...collections.map((c) => ({ name: c.name, description: c.description, productIds: c.productIds, children: c.children })), ...(others ? [others] : [])],
    productNames,
  };
}

// ---------------------------------------------------------------------------
// Limpieza de lo que propone la IA
// ---------------------------------------------------------------------------

/// Deja la propuesta consistente: ids que existen, cada producto en UNA
/// colección principal (la primera que lo nombra), subcolecciones dentro
/// de su padre, nombres cortos, nada vacío, y los productos que nadie
/// nombró en "Otros productos".
export function sanitizeStructure(raw: StructureProposal, products: OrganizerProduct[]): StructureProposal {
  const byId = new Map(products.map((p) => [p.id, p]));
  const assigned = new Set<string>();
  const collections: ProposedStructureCollection[] = [];
  for (const c of raw.collections) {
    const name = (c.name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
    if (name.length < 2) continue;
    const ids: string[] = [];
    for (const id of c.productIds ?? []) {
      if (!byId.has(id) || assigned.has(id)) continue;
      assigned.add(id);
      ids.push(id);
    }
    const own = new Set(ids);
    const children: { name: string; productIds: string[] }[] = [];
    const inChild = new Set<string>();
    for (const child of c.children ?? []) {
      const childName = (child.name ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
      const childIds = (child.productIds ?? []).filter((id) => own.has(id) && !inChild.has(id));
      if (childName.length < 2 || childIds.length < MIN_COLLECTION_PRODUCTS) continue;
      for (const id of childIds) inChild.add(id);
      children.push({ name: childName, productIds: childIds });
    }
    if (ids.length === 0) continue;
    collections.push({
      name,
      description: (c.description ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
      productIds: ids,
      ...(children.length >= 2 ? { children } : {}),
    });
  }
  // Una colección de un solo producto no es una categoría.
  const kept = collections.filter((c) => c.productIds.length >= MIN_COLLECTION_PRODUCTS);
  const strays = collections.filter((c) => c.productIds.length < MIN_COLLECTION_PRODUCTS).flatMap((c) => c.productIds);
  const missing = products.filter((p) => !assigned.has(p.id)).map((p) => p.id);
  const leftovers = [...strays, ...missing];
  if (leftovers.length > 0) {
    const others = kept.find((c) => collectionNameKey(c.name) === collectionNameKey(OTHER_COLLECTION_NAME));
    if (others) others.productIds.push(...leftovers);
    else kept.push({ name: OTHER_COLLECTION_NAME, description: "", productIds: leftovers });
  }
  const seenName = new Set<string>();
  const productNames: { id: string; name: string }[] = [];
  for (const n of raw.productNames ?? []) {
    const product = byId.get(n.id);
    const name = (n.name ?? "").replace(/\s+/g, " ").trim().slice(0, 255);
    if (!product || name.length < 2 || seenName.has(n.id) || name === product.name) continue;
    seenName.add(n.id);
    productNames.push({ id: n.id, name });
  }
  return { collections: kept, productNames };
}

// ---------------------------------------------------------------------------
// El plan: estructura + orden + menú + portada
// ---------------------------------------------------------------------------

export type BuildPlanOptions = {
  source: OrganizerPlan["source"];
  now?: Date;
  instagram?: boolean;
  whatsapp?: boolean;
  /// Las secciones activas que la portada ya tiene: lo importado con foto
  /// o video se conserva (KEEP) y, si hay un banner ancho, no se arma otro.
  existingSections?: ExistingSectionSummary[];
  /// Datos de la tienda para los ajustes de conversión (ver planSettings).
  store?: StoreFacts;
};

function uniqueKey(base: string, taken: Set<string>) {
  let key = base || "coleccion";
  for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
  taken.add(key);
  return key;
}

export function buildPlan(
  products: OrganizerProduct[],
  collections: OrganizerCollection[],
  proposal: StructureProposal,
  options: BuildPlanOptions,
): OrganizerPlan {
  const now = options.now ?? new Date();
  const byId = new Map(products.map((p) => [p.id, p]));
  const scores = scoreProducts(products, now);
  const clean = sanitizeStructure(proposal, products);
  const existingByName = new Map(collections.map((c) => [collectionNameKey(c.name), c]));
  const existingBySlug = new Map(collections.map((c) => [c.slug, c]));
  const taken = new Set<string>();
  const usedExisting = new Set<string>();

  const firstImage = (ids: string[]) => {
    for (const id of ids) {
      const url = byId.get(id)?.imageUrl;
      if (url) return url;
    }
    return null;
  };

  const plan = (c: { name: string; description?: string; productIds: string[] }, parentKey?: string): PlannedCollection => {
    const existing = existingByName.get(collectionNameKey(c.name)) ?? existingBySlug.get(slugify(c.name));
    const reuse = existing && !usedExisting.has(existing.id) ? existing : null;
    if (reuse) usedExisting.add(reuse.id);
    const slugBase = reuse?.slug ?? slugify(parentKey ? `${parentKey}-${c.name}` : c.name) ?? "coleccion";
    const key = uniqueKey(reuse?.slug ?? slugBase, taken);
    const productIds = rankProductIds(c.productIds, scores, byId);
    return {
      key,
      existingId: reuse?.id ?? null,
      name: c.name,
      slug: key,
      description: c.description?.trim() || reuse?.description?.trim() || "",
      imageUrl: reuse?.imageUrl ?? firstImage(productIds),
      productIds,
      demand: collectionDemand(productIds, scores, byId),
      sold: productIds.reduce((sum, id) => sum + (scores.get(id)?.sold ?? 0), 0),
      children: [],
    };
  };

  const planned = clean.collections.map((c) => {
    const main = plan(c);
    main.children = (c.children ?? []).map((child) => plan(child, main.key)).sort((a, b) => b.demand - a.demand);
    return main;
  });
  // "Otros productos" siempre de último, aunque tenga demanda.
  planned.sort((a, b) => {
    const ao = collectionNameKey(a.name) === collectionNameKey(OTHER_COLLECTION_NAME) ? 1 : 0;
    const bo = collectionNameKey(b.name) === collectionNameKey(OTHER_COLLECTION_NAME) ? 1 : 0;
    return ao - bo || b.demand - a.demand || b.productIds.length - a.productIds.length;
  });

  const plannedById = new Map<string, PlannedCollection>();
  const index = (list: PlannedCollection[]) => {
    for (const c of list) {
      for (const id of c.productIds) if (!plannedById.has(id)) plannedById.set(id, c);
      index(c.children);
    }
  };
  index(planned);
  const removedCollections = collections
    .filter((c) => !usedExisting.has(c.id))
    .map((c) => {
      const counts = new Map<string, number>();
      for (const id of c.productIds) {
        const target = plannedById.get(id);
        if (target) counts.set(target.name, (counts.get(target.name) ?? 0) + 1);
      }
      const movedTo = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { id: c.id, name: c.name, slug: c.slug, count: c.productIds.length, movedTo };
    });

  // Nombres: lo que dijo la IA y, para el resto, la limpieza por reglas.
  const renamed = new Map(clean.productNames.map((n) => [n.id, n.name]));
  for (const p of products) {
    if (renamed.has(p.id)) continue;
    const cleaned = cleanProductName(p.name);
    if (cleaned !== p.name) renamed.set(p.id, cleaned);
  }
  const productNames = Array.from(renamed.entries())
    .map(([id, to]) => ({ id, from: byId.get(id)!.name, to }))
    .filter((n) => n.from !== n.to);

  const discounted = products.filter((p) => p.active && p.compareAtPrice != null && p.compareAtPrice > p.price && !scores.get(p.id)?.soldOut).length;
  const menu = planMenu(planned);
  const home = planHome(planned, products, scores, { ...options, discounted });

  return {
    source: options.source,
    collections: planned,
    removedCollections,
    productNames,
    menu,
    home,
    announcement: null,
    notes: null,
    productDescriptions: [],
    collectionBanners: true,
    settings: planSettings(options.store, planned),
    stats: {
      products: products.length,
      active: products.filter((p) => p.active).length,
      soldOut: products.filter((p) => scores.get(p.id)?.soldOut).length,
      withSales: products.filter((p) => p.soldAll > 0).length,
      collectionsBefore: collections.length,
      collectionsAfter: planned.length,
      subcollections: planned.reduce((n, c) => n + c.children.length, 0),
      renamed: productNames.length,
      discounted,
    },
  };
}

/// Menú: Inicio, las colecciones con más demanda (con sus subcolecciones
/// desplegables), las demás bajo "Más", y "Todos los productos".
export function planMenu(collections: PlannedCollection[]): PlannedMenuItem[] {
  const item = (c: PlannedCollection): PlannedMenuItem => ({
    label: c.name,
    url: `/coleccion/${c.slug}`,
    children: c.children.map((child) => ({ label: child.name, url: `/coleccion/${child.slug}`, children: [] })),
  });
  const top = collections.slice(0, MENU_TOP_ITEMS).map(item);
  const rest = collections.slice(MENU_TOP_ITEMS).map((c) => ({ label: c.name, url: `/coleccion/${c.slug}`, children: [] }));
  const menu: PlannedMenuItem[] = [{ label: "Inicio", url: "/", children: [] }, ...top];
  if (rest.length > 0) menu.push({ label: "Más", url: "#", children: rest });
  menu.push({ label: "Todos los productos", url: "/coleccion", children: [] });
  return menu;
}

export const BEST_SELLERS_TITLE = "Los más vendidos";
export const FEATURED_TITLE = "Destacados";
export const NEW_PRODUCTS_TITLE = "Novedades";
export const ON_SALE_TITLE = "Ofertas";
export const CATEGORY_GRID_TITLE = "Compra por categoría";
export const CATALOG_TITLE = "Todos los productos";
export const BEST_SELLERS_COUNT = 12;

/// Los mejores productos de la tienda para la portada: con ventas reales
/// se llama "Los más vendidos"; sin ventas todavía, "Destacados" (los de
/// mejor puntaje). Nunca agotados ni borradores.
export function bestSellerIds(products: OrganizerProduct[], scores: Map<string, ProductScore>, count = BEST_SELLERS_COUNT): { ids: string[]; title: string } {
  const live = products.filter((p) => p.active && !scores.get(p.id)?.soldOut);
  const withSales = live.some((p) => p.soldAll > 0 || p.sold90 > 0);
  const ids = live
    .slice()
    .sort((a, b) => (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0) || a.sourcePosition - b.sourcePosition)
    .slice(0, count)
    .map((p) => p.id);
  return { ids, title: withSales ? BEST_SELLERS_TITLE : FEATURED_TITLE };
}

/// Cuántas secciones importadas (aparte de la cabecera) se conservan.
export const MAX_KEPT_VISUALS = 3;

/// Portada que vende (por reglas): la cabecera importada si la hay o un
/// banner de la colección estrella, las categorías en orden de demanda,
/// los más vendidos, lo visual importado que aporte, ofertas si hay,
/// novedades, los sellos de confianza, Instagram y el catálogo completo.
export function planHome(
  collections: PlannedCollection[],
  products: OrganizerProduct[],
  scores: Map<string, ProductScore>,
  options: BuildPlanOptions & { discounted: number },
): HomeSectionPlan[] {
  const home: HomeSectionPlan[] = [];
  const surviving = survivingCollectionIds(collections);
  const existing = options.existingSections ?? [];
  const hero = existing.find((s) => s.hero && keepableSection(s, surviving));
  const star = collections.find((c) => c.imageUrl && c.productIds.some((id) => byActive(products, id)));
  if (hero) home.push({ type: "KEEP", sectionId: hero.id, label: hero.label });
  else if (star?.imageUrl) home.push(bannerFor(star));
  const withImage = categoriesWithImage(collections).slice(0, 6);
  if (withImage.length >= 2) home.push({ type: "CATEGORY_GRID", title: CATEGORY_GRID_TITLE, collectionKeys: withImage.map((c) => c.key) });
  const best = bestSellerIds(products, scores);
  if (best.ids.length >= 4) home.push({ type: "FEATURED_PRODUCTS", title: best.title, productIds: best.ids });
  for (const s of existing.filter((s) => s !== hero && keepableSection(s, surviving)).slice(0, MAX_KEPT_VISUALS)) {
    home.push({ type: "KEEP", sectionId: s.id, label: s.label });
  }
  if (options.discounted >= 3) home.push({ type: "ON_SALE_PRODUCTS", title: ON_SALE_TITLE });
  if (products.filter((p) => p.active).length >= 8) home.push({ type: "NEW_PRODUCTS", title: NEW_PRODUCTS_TITLE });
  home.push({ type: "SHIPPING_INFO_BANNERS", whatsapp: Boolean(options.whatsapp) });
  if (options.instagram) home.push({ type: "INSTAGRAM_CTA" });
  home.push({ type: "PRODUCT_CATALOG", title: CATALOG_TITLE });
  return home;
}

/// El banner de la colección estrella (lo pinta /api/banner con el
/// estilo de la tienda; los textos van dentro de la imagen).
export type BannerPlan = Extract<HomeSectionPlan, { type: "BANNER" }>;

export function bannerFor(star: PlannedCollection): BannerPlan {
  return {
    type: "BANNER",
    collectionKey: star.key,
    imageUrl: star.imageUrl ?? "",
    title: star.name.slice(0, 60),
    subtitle: (star.description || "Lo más pedido de la tienda").slice(0, 120),
    buttonText: `Ver ${star.name.toLowerCase()}`.slice(0, 30),
  };
}

function byActive(products: OrganizerProduct[], id: string) {
  return products.find((p) => p.id === id)?.active ?? false;
}

function isOtherCollection(c: PlannedCollection) {
  return collectionNameKey(c.name) === collectionNameKey(OTHER_COLLECTION_NAME);
}

/// Colecciones con foto y productos para "Compra por categoría". "Otros
/// productos" no es una categoría: solo entra si no hay otras dos.
export function categoriesWithImage(collections: PlannedCollection[]): PlannedCollection[] {
  const withImage = collections.filter((c) => c.imageUrl && c.productIds.length > 0);
  const real = withImage.filter((c) => !isOtherCollection(c));
  return real.length >= 2 ? real : withImage;
}

export function flattenPlanned(collections: PlannedCollection[]): PlannedCollection[] {
  return collections.flatMap((c) => [c, ...flattenPlanned(c.children)]);
}

/// Ids de las colecciones actuales que siguen existiendo con el plan.
function survivingCollectionIds(collections: PlannedCollection[]) {
  return new Set(flattenPlanned(collections).map((c) => c.existingId).filter((id): id is string => Boolean(id)));
}

/// Una sección existente se conserva si tiene algo propio (foto o video;
/// con `text`, también un texto de marca) y sus colecciones siguen
/// existiendo.
export function keepableSection(section: ExistingSectionSummary, survivingCollectionIds: Set<string>, options: { text?: boolean } = {}) {
  if (!section.collectionIds.every((id) => survivingCollectionIds.has(id))) return false;
  if (section.visual) return true;
  return Boolean(options.text) && section.type === "TEXT" && section.text.length >= 40;
}

function itemsOf(config: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(config.items) ? config.items.filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === "object") : [];
}

function str(value: unknown, max = 200) {
  return typeof value === "string" ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/// Resumen de una sección de la portada tal como está en la base, con lo
/// que importa para decidir si se conserva (ver ExistingSectionSummary).
export function summarizeExistingSection(
  section: { id: string; type: string; config: unknown },
  collectionNameById: Map<string, string>,
): ExistingSectionSummary {
  const config = (section.config && typeof section.config === "object" ? section.config : {}) as Record<string, unknown>;
  const base: ExistingSectionSummary = {
    id: section.id,
    type: section.type,
    label: SECTION_TYPE_LABEL[section.type as SectionType] ?? section.type,
    visual: false,
    hero: false,
    collectionIds: [],
    text: "",
  };
  const names = (ids: string[]) => ids.map((id) => collectionNameById.get(id) ?? "una colección que ya no existe").join(", ");
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  switch (section.type) {
    case "BANNER": {
      const banner = normalizeBannerConfig(config);
      const slides = banner.slides.filter((s) => s.imageUrl);
      const title = str(banner.title, 80);
      if (slides.length === 0) return { ...base, label: title ? `Banner sin foto (título "${title}")` : "Banner vacío" };
      const withTitle = title ? ` con el título "${title}"` : "";
      return {
        ...base,
        visual: true,
        hero: banner.aspectRatio !== "square",
        label: slides.length === 1 ? `Banner ancho con una foto${withTitle}` : `Banner ancho con ${slides.length} fotos que se deslizan${withTitle}`,
      };
    }
    case "IMAGE_CAROUSEL": {
      const images = Array.isArray(config.images) ? config.images.filter((i) => typeof i === "string" && i) : [];
      if (images.length === 0) return { ...base, label: "Carrusel de imágenes vacío" };
      return { ...base, visual: true, hero: true, label: images.length === 1 ? "Imagen de ancho completo" : `Carrusel de ${images.length} imágenes de ancho completo` };
    }
    case "PROMO_BANNERS": {
      const items = itemsOf(config).filter((i) => i.show !== false && typeof i.imageUrl === "string" && i.imageUrl);
      if (items.length === 0) return { ...base, label: "Banners promocionales vacíos" };
      return { ...base, visual: true, label: `${plural(items.length, "banner promocional", "banners promocionales")} con foto` };
    }
    case "CATEGORY_BANNERS": {
      const items = itemsOf(config).filter((i) => i.show !== false && typeof i.imageUrl === "string" && i.imageUrl && typeof i.collectionId === "string" && i.collectionId);
      const ids = items.map((i) => i.collectionId as string);
      if (ids.length === 0) return { ...base, label: "Banners de categorías vacíos" };
      return { ...base, visual: true, collectionIds: ids, label: `Banners con foto de ${plural(ids.length, "categoría", "categorías")} (${names(ids)})` };
    }
    case "VIDEO": {
      const url = str(config.url, 300);
      if (!url) return { ...base, label: "Video sin dirección" };
      const title = str(config.title, 80);
      return { ...base, visual: true, label: title ? `Video "${title}"` : "Video" };
    }
    case "BRAND_CAROUSEL": {
      const items = itemsOf(config).filter((i) => typeof i.imageUrl === "string" && i.imageUrl);
      if (items.length === 0) return { ...base, label: "Tira de logos vacía" };
      return { ...base, visual: true, label: `Tira de ${plural(items.length, "logo o sello", "logos o sellos")}` };
    }
    case "TEXT": {
      const text = [str(config.heading, 120), str(config.body, 600)].filter(Boolean).join(" — ");
      if (!text) return { ...base, label: "Texto vacío" };
      return { ...base, text, label: `Texto: "${text.slice(0, 140)}${text.length > 140 ? "…" : ""}"` };
    }
    case "FEATURED_COLLECTION": {
      const id = typeof config.collectionId === "string" ? config.collectionId : "";
      if (!id) return { ...base, label: "Colección destacada sin colección" };
      return { ...base, collectionIds: [id], label: `Productos de la colección ${names([id])}` };
    }
    case "FEATURED_PRODUCTS": {
      const ids = Array.isArray(config.productIds) ? config.productIds : [];
      const title = str(config.title, 80);
      return { ...base, label: `${plural(ids.length, "producto elegido a mano", "productos elegidos a mano")}${title ? ` ("${title}")` : ""}` };
    }
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// La portada compuesta por la IA
// ---------------------------------------------------------------------------

/// Lo que responde la IA al componer la portada (ver
/// composeHomeWithClaude): secciones en orden con los campos que apliquen
/// (vacío lo demás), colecciones por nombre y las secciones existentes
/// por su número (S1, S2…) o su id.
export type RawHomeSection = { type: string; keepId: string; collections: string[]; title: string; subtitle: string; buttonText: string; body: string };
export type RawHomeComposition = {
  sections: RawHomeSection[];
  announcement: string;
  notes: string;
  /// "Nosotros" del pie de página (título y una o dos frases).
  aboutTitle?: string;
  aboutText?: string;
};

export type HomeCompositionContext = {
  collections: PlannedCollection[];
  products: OrganizerProduct[];
  scores: Map<string, ProductScore>;
  existingSections: ExistingSectionSummary[];
  instagram: boolean;
  whatsapp: boolean;
  discounted: number;
  /// La tienda ya tiene barra de anuncio: no se propone otra.
  hasAnnouncement: boolean;
  /// El pie de página ya tiene un "Nosotros" escrito por la marca.
  hasAbout?: boolean;
};

export const MAX_HOME_SECTIONS = 12;
export const MAX_FEATURED_COLLECTIONS = 2;
export const ANNOUNCEMENT_MAX = 90;
export const ABOUT_MAX = 300;
export const ABOUT_TITLE = "Nosotros";
/// Con menos secciones válidas que esto, la respuesta de la IA no sirve
/// y se usa la portada por reglas.
export const MIN_COMPOSED_SECTIONS = 3;

const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(EMOJI, "").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/// Una promesa que no se puede comprobar (envío gratis, porcentajes,
/// precios) no va en la barra de anuncio.
function isUnverifiablePromise(text: string) {
  return /grat[ií]s|%|\$|\d+\s*(por ciento|off|x\s*\d)|descuento del/i.test(text);
}

/// Valida y ordena lo que compuso la IA: solo colecciones y secciones que
/// existen, una sola cabecera (de primera), los más vendidos, los sellos
/// de confianza una vez y el catálogo de último. Si queda muy poco de lo
/// que propuso, devuelve null y se usa la portada por reglas.
export type HomeComposition = {
  home: HomeSectionPlan[];
  announcement: string | null;
  notes: string | null;
  about: { title: string; description: string } | null;
};

export function sanitizeHomeComposition(raw: RawHomeComposition, ctx: HomeCompositionContext): HomeComposition | null {
  const all = flattenPlanned(ctx.collections);
  const byName = new Map(all.map((c) => [collectionNameKey(c.name), c]));
  const surviving = survivingCollectionIds(ctx.collections);
  const existingById = new Map(ctx.existingSections.map((s) => [s.id, s]));
  const existingByNumber = new Map(ctx.existingSections.map((s, i) => [`s${i + 1}`, s]));
  const activeCount = (c: PlannedCollection) => c.productIds.filter((id) => byActive(ctx.products, id)).length;
  const resolve = (names: unknown) => {
    const out: PlannedCollection[] = [];
    for (const n of Array.isArray(names) ? names : []) {
      const c = byName.get(collectionNameKey(cleanText(n, 80)));
      if (c && !out.includes(c)) out.push(c);
    }
    return out;
  };
  const isHero = (h: HomeSectionPlan) => h.type === "BANNER" || (h.type === "KEEP" && Boolean(existingById.get(h.sectionId)?.hero));
  const best = bestSellerIds(ctx.products, ctx.scores);
  const activeProducts = ctx.products.filter((p) => p.active).length;

  const home: HomeSectionPlan[] = [];
  const once = new Set<string>();
  const kept = new Set<string>();
  let featuredCollections = 0;
  let proposed = 0;

  for (const s of Array.isArray(raw.sections) ? raw.sections : []) {
    if (home.length >= MAX_HOME_SECTIONS - 1) break;
    const type = cleanText(s?.type, 40).toUpperCase();
    const before = home.length;
    switch (type) {
      case "KEEP": {
        const key = cleanText(s.keepId, 60);
        const section = existingById.get(key) ?? existingByNumber.get(key.toLowerCase());
        if (!section || kept.has(section.id) || !keepableSection(section, surviving, { text: true })) break;
        if (section.hero && home.some(isHero)) break;
        kept.add(section.id);
        home.push({ type: "KEEP", sectionId: section.id, label: section.label });
        break;
      }
      case "BANNER": {
        if (home.some(isHero)) break;
        const target = resolve(s.collections).find((c) => c.imageUrl && activeCount(c) > 0) ?? all.find((c) => c.imageUrl && activeCount(c) > 0);
        if (!target) break;
        const base = bannerFor(target);
        home.push({
          ...base,
          title: cleanText(s.title, 60) || base.title,
          subtitle: cleanText(s.subtitle, 120) || base.subtitle,
          buttonText: cleanText(s.buttonText, 30) || base.buttonText,
        });
        break;
      }
      case "CATEGORY_GRID": {
        if (once.has(type)) break;
        let chosen = resolve(s.collections).filter((c) => c.imageUrl && c.productIds.length > 0).slice(0, 6);
        if (chosen.length < 2) chosen = categoriesWithImage(ctx.collections).slice(0, 6);
        if (chosen.length < 2) break;
        once.add(type);
        home.push({ type: "CATEGORY_GRID", title: cleanText(s.title, 60) || CATEGORY_GRID_TITLE, collectionKeys: chosen.map((c) => c.key) });
        break;
      }
      case "CATEGORY_BANNERS": {
        if (once.has(type)) break;
        const chosen = resolve(s.collections).filter((c) => c.imageUrl && c.productIds.length > 0).slice(0, 3);
        if (chosen.length < 2) break;
        once.add(type);
        home.push({ type: "CATEGORY_BANNERS", collectionKeys: chosen.map((c) => c.key) });
        break;
      }
      case "FEATURED_COLLECTION": {
        if (featuredCollections >= MAX_FEATURED_COLLECTIONS) break;
        const target = resolve(s.collections).find((c) => activeCount(c) >= 4);
        if (!target || home.some((h) => h.type === "FEATURED_COLLECTION" && h.collectionKey === target.key)) break;
        featuredCollections++;
        home.push({ type: "FEATURED_COLLECTION", collectionKey: target.key, title: cleanText(s.title, 60) || target.name });
        break;
      }
      case "FEATURED_PRODUCTS": {
        if (once.has(type) || best.ids.length < 4) break;
        once.add(type);
        home.push({ type: "FEATURED_PRODUCTS", title: best.title, productIds: best.ids });
        break;
      }
      case "ON_SALE_PRODUCTS": {
        if (once.has(type) || ctx.discounted < 3) break;
        once.add(type);
        home.push({ type: "ON_SALE_PRODUCTS", title: cleanText(s.title, 40) || ON_SALE_TITLE });
        break;
      }
      case "NEW_PRODUCTS": {
        if (once.has(type) || activeProducts < 8) break;
        once.add(type);
        home.push({ type: "NEW_PRODUCTS", title: cleanText(s.title, 40) || NEW_PRODUCTS_TITLE });
        break;
      }
      case "TEXT": {
        if (once.has(type)) break;
        const body = cleanText(s.body, 400);
        if (body.length < 40) break;
        once.add(type);
        home.push({ type: "TEXT", heading: cleanText(s.title, 60), body });
        break;
      }
      case "SHIPPING_INFO_BANNERS": {
        if (once.has(type)) break;
        once.add(type);
        home.push({ type: "SHIPPING_INFO_BANNERS", whatsapp: ctx.whatsapp });
        break;
      }
      case "INSTAGRAM_CTA": {
        if (once.has(type) || !ctx.instagram) break;
        once.add(type);
        home.push({ type: "INSTAGRAM_CTA" });
        break;
      }
      case "PRODUCT_CATALOG": {
        if (once.has(type)) break;
        once.add(type);
        home.push({ type: "PRODUCT_CATALOG", title: cleanText(s.title, 60) || CATALOG_TITLE });
        break;
      }
      default:
        break;
    }
    if (home.length > before) proposed++;
  }
  if (proposed < MIN_COMPOSED_SECTIONS) return null;

  // Lo que no puede faltar: la cabecera de primera, los más vendidos
  // después de las categorías, los sellos antes del cierre y el catálogo
  // de último.
  if (!home.some(isHero)) {
    const hero = ctx.existingSections.find((s) => s.hero && !kept.has(s.id) && keepableSection(s, surviving));
    const star = ctx.collections.find((c) => c.imageUrl && activeCount(c) > 0);
    if (hero) home.unshift({ type: "KEEP", sectionId: hero.id, label: hero.label });
    else if (star) home.unshift(bannerFor(star));
  }
  const heroIndex = home.findIndex(isHero);
  if (heroIndex > 0) home.unshift(...home.splice(heroIndex, 1));
  if (!home.some((h) => h.type === "FEATURED_PRODUCTS") && best.ids.length >= 4) {
    let at = 0;
    while (at < home.length && (isHero(home[at]) || home[at].type === "CATEGORY_GRID" || home[at].type === "CATEGORY_BANNERS")) at++;
    home.splice(at, 0, { type: "FEATURED_PRODUCTS", title: best.title, productIds: best.ids });
  }
  if (!home.some((h) => h.type === "SHIPPING_INFO_BANNERS")) {
    let at = home.length;
    while (at > 0 && (home[at - 1].type === "INSTAGRAM_CTA" || home[at - 1].type === "PRODUCT_CATALOG")) at--;
    home.splice(at, 0, { type: "SHIPPING_INFO_BANNERS", whatsapp: ctx.whatsapp });
  }
  const catalogIndex = home.findIndex((h) => h.type === "PRODUCT_CATALOG");
  const catalog: HomeSectionPlan = catalogIndex >= 0 ? home.splice(catalogIndex, 1)[0] : { type: "PRODUCT_CATALOG", title: CATALOG_TITLE };
  const trimmed = home.slice(0, MAX_HOME_SECTIONS - 1);
  trimmed.push(catalog);

  let announcement: string | null = ctx.hasAnnouncement ? null : cleanText(raw.announcement, ANNOUNCEMENT_MAX) || null;
  if (announcement && isUnverifiablePromise(announcement)) announcement = null;
  const aboutText = ctx.hasAbout ? "" : cleanText(raw.aboutText, ABOUT_MAX);
  const about = aboutText.length >= 60 && !isUnverifiablePromise(aboutText) ? { title: cleanText(raw.aboutTitle, 40) || ABOUT_TITLE, description: aboutText } : null;
  return { home: trimmed, announcement, notes: cleanText(raw.notes, 300) || null, about };
}

// ---------------------------------------------------------------------------
// El resto de la tienda: fichas de producto y ajustes de conversión
// ---------------------------------------------------------------------------
// Pedido el 2026-10-19: "estas filosofías deben existir en toda la tienda,
// no solo en la portada". La misma línea directiva de conversión manda en
// la ficha de producto (qué es, qué gana quien compra, qué incluye, cómo
// se usa, datos reales), en las páginas de colección (banner con el
// estilo de la tienda, descripción) y en los ajustes del tema (sellos de
// confianza, últimas unidades, sugerencias en el carrito, pie de página).

/// Ficha de producto escrita por la IA (ver describeProductsWithClaude).
export type ProductCopy = {
  /// Qué es y el beneficio principal (una o dos frases).
  summary: string;
  /// Puntos concretos: qué resuelve, resultado, duración, facilidad.
  benefits: string[];
  /// Qué trae (cantidad, piezas, contenido), si se sabe.
  includes: string;
  /// Cómo se usa, si aplica.
  usage: string;
  /// Datos técnicos que estén en la información original.
  specs: string[];
  /// Cuidado o advertencia real, si la hay.
  note: string;
};

export type PlannedDescription = { id: string; html: string; summary: string };

export const COPY_LIMITS = { summary: 240, benefit: 100, benefits: 5, includes: 200, usage: 240, spec: 80, specs: 6, note: 160 } as const;

/// Valida lo que respondió la IA para un producto; null si no alcanza
/// para una ficha (se conserva la descripción actual).
export function sanitizeProductCopy(raw: unknown): ProductCopy | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown, max: number, count: number) =>
    Array.isArray(v)
      ? v
          .map((x) => cleanText(x, max).replace(/[.;,]\s*$/, ""))
          .filter((x) => x.length >= 3)
          .slice(0, count)
      : [];
  const summary = cleanText(r.summary, COPY_LIMITS.summary);
  const benefits = list(r.benefits, COPY_LIMITS.benefit, COPY_LIMITS.benefits);
  if (summary.length < 30 || benefits.length < 2) return null;
  return {
    summary,
    benefits,
    includes: cleanText(r.includes, COPY_LIMITS.includes),
    usage: cleanText(r.usage, COPY_LIMITS.usage),
    specs: list(r.specs, COPY_LIMITS.spec, COPY_LIMITS.specs),
    note: cleanText(r.note, COPY_LIMITS.note),
  };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/// La ficha en HTML simple (párrafos y listas; se sanea al guardar).
export function renderProductCopy(copy: ProductCopy): string {
  const parts = [`<p>${escapeHtml(copy.summary)}</p>`, `<ul>${copy.benefits.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`];
  if (copy.includes) parts.push(`<p><strong>Incluye:</strong> ${escapeHtml(copy.includes)}</p>`);
  if (copy.usage) parts.push(`<p><strong>Cómo se usa:</strong> ${escapeHtml(copy.usage)}</p>`);
  if (copy.specs.length > 0) parts.push(`<p><strong>Características</strong></p><ul>${copy.specs.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`);
  if (copy.note) parts.push(`<p><em>${escapeHtml(copy.note)}</em></p>`);
  return parts.join("\n");
}

/// Datos de la tienda que deciden los ajustes (ver planSettings).
export type StoreFacts = {
  /// La mayoría de los productos activos lleva inventario.
  tracksStock: boolean;
  /// Tiene páginas propias (políticas, nosotros, preguntas).
  hasPages: boolean;
  /// La marca ya puso sus sellos en la ficha de producto (no se pisan).
  hasPurchaseInfo: boolean;
  /// El pie de página ya tiene un "Nosotros" (no se pisa).
  hasAbout: boolean;
};

export type StoreSettingsPlan = {
  /// Tres sellos de confianza en la ficha de producto (envíos, pagos,
  /// cambios o asesoría por WhatsApp).
  purchaseInfo: boolean;
  /// Aviso de "últimas unidades" con el inventario real.
  lowStock: boolean;
  /// "Completa tu compra" en el carrito (productos de las mismas colecciones).
  cartSuggestions: boolean;
  /// Pie de página: datos de contacto y las páginas de información.
  footerContact: boolean;
  footerPages: boolean;
  /// "Nosotros" del pie de página (lo escribe la IA; null por reglas).
  about: { title: string; description: string } | null;
};

/// Ajustes de conversión por reglas: solo con sustento (inventario real
/// para "últimas unidades", páginas que existan) y sin pisar lo que la
/// marca ya configuró.
export function planSettings(facts: StoreFacts | undefined, collections: PlannedCollection[]): StoreSettingsPlan {
  const f: StoreFacts = facts ?? { tracksStock: false, hasPages: false, hasPurchaseInfo: false, hasAbout: false };
  return {
    purchaseInfo: !f.hasPurchaseInfo,
    lowStock: f.tracksStock,
    cartSuggestions: collections.length >= 2,
    footerContact: true,
    footerPages: f.hasPages,
    about: null,
  };
}

/// Si la mayoría de los productos activos lleva inventario (stock no
/// nulo, propio o de sus variantes), el aviso de últimas unidades dice la
/// verdad.
export function tracksStock(products: OrganizerProduct[]): boolean {
  const active = products.filter((p) => p.active);
  if (active.length === 0) return false;
  const tracked = active.filter((p) => (p.hasVariants ? p.variantStocks.some((s) => s != null) : p.stock != null)).length;
  return tracked * 2 >= active.length;
}
