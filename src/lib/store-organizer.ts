import { normalizeText, proposeCollectionsByRules, OTHER_COLLECTION_NAME } from "@/lib/shopify-categorize";
import { proposeMergeByRules } from "@/lib/collection-merge";
import { slugify } from "@/lib/shopify-csv";

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

export type HomeSectionPlan =
  | { type: "BANNER"; collectionKey: string; imageUrl: string; title: string; subtitle: string; buttonText: string }
  | { type: "CATEGORY_GRID"; title: string; collectionKeys: string[] }
  | { type: "FEATURED_PRODUCTS"; title: string; productIds: string[] }
  | { type: "ON_SALE_PRODUCTS"; title: string }
  | { type: "NEW_PRODUCTS"; title: string }
  | { type: "SHIPPING_INFO_BANNERS"; whatsapp: boolean }
  | { type: "INSTAGRAM_CTA" }
  | { type: "PRODUCT_CATALOG"; title: string };

export type OrganizerPlan = {
  source: "ia" | "reglas";
  collections: PlannedCollection[];
  /// Colecciones actuales que desaparecen (sus productos quedan en las
  /// nuevas). Se guardan en la copia para poder deshacer.
  removedCollections: { id: string; name: string; slug: string; count: number; movedTo: string | null }[];
  productNames: { id: string; from: string; to: string }[];
  menu: PlannedMenuItem[];
  home: HomeSectionPlan[];
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
/// chicas que comparten nombre, ver collection-merge.ts), se disuelven las
/// de un solo producto, los productos sin colección se clasifican por las
/// palabras del nicho, y si no había ninguna colección se arman todas por
/// palabras. Cada producto queda en exactamente una colección.
export function proposeStructureByRules(products: OrganizerProduct[], collections: OrganizerCollection[]): StructureProposal {
  const byId = new Map(products.map((p) => [p.id, p]));
  const groups: { name: string; productIds: string[] }[] = [];
  const assigned = new Set<string>();

  const sources = collections
    .map((c) => ({ handle: c.slug, name: c.name, productHandles: c.productIds.filter((id) => byId.has(id)) }))
    .filter((c) => c.productHandles.length > 0);
  const merged = proposeMergeByRules(sources);
  const base = merged ? merged.collections.map((m) => ({ name: m.name, productIds: m.productHandles })) : sources.map((s) => ({ name: s.name, productIds: s.productHandles }));

  // Un producto en varias colecciones se queda en la más grande (la que
  // mejor lo representa como categoría); así nada se repite.
  const sized = base.slice().sort((a, b) => b.productIds.length - a.productIds.length);
  for (const group of sized) {
    const ids = group.productIds.filter((id) => !assigned.has(id));
    if (ids.length === 0) continue;
    for (const id of ids) assigned.add(id);
    groups.push({ name: group.name.trim().slice(0, MAX_NAME), productIds: ids });
  }

  // Lo que quedó suelto (o todo, si no había colecciones): por palabras.
  const loose = products.filter((p) => !assigned.has(p.id));
  if (loose.length > 0) {
    const proposal = proposeCollectionsByRules(loose.map((p) => ({ handle: p.id, name: p.name })));
    for (const category of proposal.collections) {
      const existing =
        groups.find((g) => collectionNameKey(g.name) === collectionNameKey(category.name)) ??
        (category.name === OTHER_COLLECTION_NAME ? undefined : groups.find((g) => sameCategoryName(g.name, category.name)));
      if (existing) existing.productIds.push(...category.productHandles);
      else groups.push({ name: category.name, productIds: category.productHandles });
      for (const id of category.productHandles) assigned.add(id);
    }
  }

  // Las colecciones de un solo producto se disuelven en "Otros productos"
  // (o en la que su nombre sugiera, si una categoría del nicho calza).
  const small = groups.filter((g) => g.productIds.length < MIN_COLLECTION_PRODUCTS);
  const keep = groups.filter((g) => g.productIds.length >= MIN_COLLECTION_PRODUCTS);
  if (small.length > 0) {
    const strays = small.flatMap((g) => g.productIds);
    const proposal = proposeCollectionsByRules(strays.map((id) => ({ handle: id, name: byId.get(id)?.name ?? "" })));
    for (const category of proposal.collections) {
      const target =
        keep.find((g) => collectionNameKey(g.name) === collectionNameKey(category.name)) ??
        (category.name === OTHER_COLLECTION_NAME ? undefined : keep.find((g) => sameCategoryName(g.name, category.name))) ??
        (category.name !== OTHER_COLLECTION_NAME && category.productHandles.length >= MIN_COLLECTION_PRODUCTS ? null : keep.find((g) => collectionNameKey(g.name) === collectionNameKey(OTHER_COLLECTION_NAME)));
      if (target) target.productIds.push(...category.productHandles);
      else if (category.name !== OTHER_COLLECTION_NAME && category.productHandles.length >= MIN_COLLECTION_PRODUCTS) keep.push({ name: category.name, productIds: category.productHandles });
      else keep.push({ name: OTHER_COLLECTION_NAME, productIds: category.productHandles });
    }
  }
  // "Otros productos" repetido (de varias rondas) se une.
  const others = keep.filter((g) => collectionNameKey(g.name) === collectionNameKey(OTHER_COLLECTION_NAME));
  const result = keep.filter((g) => collectionNameKey(g.name) !== collectionNameKey(OTHER_COLLECTION_NAME));
  if (others.length > 0) result.push({ name: OTHER_COLLECTION_NAME, productIds: Array.from(new Set(others.flatMap((g) => g.productIds))) });

  const productNames = products
    .map((p) => ({ id: p.id, name: cleanProductName(p.name) }))
    .filter((n) => n.name !== byId.get(n.id)!.name);
  return { collections: result.map((g) => ({ name: g.name, productIds: g.productIds })), productNames };
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
  /// La portada ya tiene un banner con foto (importado): se conserva y
  /// no se arma otro.
  keepsBanner?: boolean;
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

/// Portada que vende: la colección estrella arriba, las categorías en
/// orden de demanda, los más vendidos, ofertas si hay, novedades, los
/// sellos de confianza, Instagram y el catálogo completo al final.
export function planHome(
  collections: PlannedCollection[],
  products: OrganizerProduct[],
  scores: Map<string, ProductScore>,
  options: BuildPlanOptions & { discounted: number },
): HomeSectionPlan[] {
  const home: HomeSectionPlan[] = [];
  const star = collections.find((c) => c.imageUrl && c.productIds.some((id) => byActive(products, id)));
  if (star?.imageUrl && !options.keepsBanner) {
    home.push({
      type: "BANNER",
      collectionKey: star.key,
      imageUrl: star.imageUrl,
      title: star.name,
      subtitle: star.description || `Lo más pedido de la tienda`,
      buttonText: `Ver ${star.name.toLowerCase()}`.slice(0, 40),
    });
  }
  const withImage = collections.filter((c) => c.imageUrl && c.productIds.length > 0).slice(0, 6);
  if (withImage.length >= 2) home.push({ type: "CATEGORY_GRID", title: CATEGORY_GRID_TITLE, collectionKeys: withImage.map((c) => c.key) });
  const best = bestSellerIds(products, scores);
  if (best.ids.length >= 4) home.push({ type: "FEATURED_PRODUCTS", title: best.title, productIds: best.ids });
  if (options.discounted >= 3) home.push({ type: "ON_SALE_PRODUCTS", title: ON_SALE_TITLE });
  if (products.filter((p) => p.active).length >= 8) home.push({ type: "NEW_PRODUCTS", title: NEW_PRODUCTS_TITLE });
  home.push({ type: "SHIPPING_INFO_BANNERS", whatsapp: Boolean(options.whatsapp) });
  if (options.instagram) home.push({ type: "INSTAGRAM_CTA" });
  home.push({ type: "PRODUCT_CATALOG", title: CATALOG_TITLE });
  return home;
}

function byActive(products: OrganizerProduct[], id: string) {
  return products.find((p) => p.id === id)?.active ?? false;
}
