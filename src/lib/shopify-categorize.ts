/// Propone categorías (colecciones) para una tienda que en Shopify no
/// tiene ninguna, a partir de lo que sí se lee: el Tipo de producto, las
/// etiquetas y el nombre. Reglas puras, pensadas para tiendas de productos
/// para uñas (el nicho de Marcolini). La versión con IA vive en
/// shopify-categorize-service.ts y cae acá si no está configurada o falla.
/// Ver conversación del 2026-10-17.

export type CategorizeProduct = {
  handle: string;
  name: string;
  type?: string | null;
  tags?: string[];
};

export type ProposedCollection = {
  name: string;
  productHandles: string[];
};

export const OTHER_COLLECTION_NAME = "Otros productos";

/// En orden de prioridad: lo específico antes que lo genérico ("top coat
/// para soft gel" es de soft gel, no de preparación).
const NAIL_CATEGORIES: { name: string; keywords: string[] }[] = [
  { name: "Kits y combos", keywords: ["kit", "kits", "combo", "combos", "set", "sets", "pack", "packs"] },
  {
    name: "Soft gel y tips",
    keywords: ["soft gel", "softgel", "acrysoft", "tips", "tip", "press on", "press-on", "presson", "gel x", "gelx", "gel-x", "full cover", "unas postizas", "extensiones"],
  },
  {
    name: "Esmaltes",
    keywords: ["esmalte", "esmaltes", "polish", "semipermanente", "semipermanentes", "semi-permanente", "semi permanente", "gel polish", "laca", "lacas", "color gel", "shellac", "esmaltado"],
  },
  { name: "Acrílico", keywords: ["acrilico", "acrilicos", "acrylic", "polimero", "polimeros", "monomero", "monomeros", "polvo acrilico"] },
  {
    name: "Gel de construcción",
    keywords: ["builder", "constructor", "construccion", "polygel", "poly gel", "polig", "hard gel", "gel duro", "rubber base", "base rubber", "gel de construccion", "gel constructor"],
  },
  { name: "Stamping", keywords: ["stamping", "placa", "placas", "plate", "plates", "estampado", "sello", "sellos", "raspador", "scraper"] },
  {
    name: "Decoración",
    keywords: ["decoracion", "decoraciones", "nail art", "glitter", "glitters", "foil", "foils", "strass", "cristales", "cristal", "rhinestone", "rhinestones", "charm", "charms", "dije", "dijes", "sticker", "stickers", "calcomania", "calcomanias", "pegatina", "pegatinas", "pigmento", "pigmentos", "cromo", "chrome", "holo", "holografico", "cat eye", "ojo de gato", "sirena", "mirror", "espejo", "flakes", "hojuelas", "piedras", "piedra", "perlas", "escarcha"],
  },
  {
    name: "Herramientas y equipos",
    keywords: ["pincel", "pinceles", "brush", "brushes", "lima", "limas", "file", "files", "buffer", "pusher", "empujador", "alicate", "alicates", "cortaunas", "cutter", "tijera", "tijeras", "pinza", "pinzas", "espatula", "spatula", "torno", "tornos", "drill", "broca", "brocas", "bit", "bits", "fresa", "fresas", "lampara", "lamparas", "lamp", "uv", "led", "dotting", "punteador", "palillo", "palillos", "paleta", "aspiradora", "extractor", "organizador", "exhibidor"],
  },
  {
    name: "Preparación y cuidado",
    keywords: ["primer", "bond", "bonder", "deshidratador", "dehydrator", "prep", "cleaner", "limpiador", "removedor", "remover", "acetona", "aceite", "oil", "cuticula", "cuticle", "crema", "hidratante", "top coat", "topcoat", "top", "base coat", "basecoat", "base", "fortalecedor", "tratamiento", "algodon", "toallas", "wipes", "cleanser", "antiseptico", "alcohol", "finish", "sellador"],
  },
];

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const KEYWORD_REGEX = NAIL_CATEGORIES.map((category) => ({
  name: category.name,
  regex: new RegExp(`(^|\\s)(${category.keywords.map((k) => normalizeText(k).replace(/\s+/g, "\\s+")).join("|")})(\\s|$)`),
}));

/// La categoría del nicho que un texto sugiere ("Pinceles finos" →
/// "Herramientas y equipos"; "Semipermanentes" → "Esmaltes"), o null.
export function nicheCategoryOf(text: string): string | null {
  const haystack = normalizeText(text);
  return KEYWORD_REGEX.find((c) => c.regex.test(haystack))?.name ?? null;
}

function cleanType(value: string | null | undefined) {
  const type = (value ?? "").trim().slice(0, 80);
  return type.length >= 2 && !/^(sin categor[ií]a|uncategori[sz]ed)$/i.test(type) ? type : "";
}

/// Agrupa por el Tipo de producto cuando la mayoría lo tiene (es lo que
/// las marcas usan como categoría cuando no arman colecciones); si no,
/// por palabras clave del nicho. Los que no caen en ninguna van a "Otros
/// productos". Devuelve también cómo se armó, para explicarlo en pantalla.
export function proposeCollectionsByRules(products: CategorizeProduct[]): {
  collections: ProposedCollection[];
  method: "tipo" | "palabras" | "ninguno";
} {
  if (products.length === 0) return { collections: [], method: "ninguno" };
  const groups = new Map<string, ProposedCollection>();
  const add = (name: string, handle: string) => {
    const key = normalizeText(name);
    const group = groups.get(key) ?? { name, productHandles: [] };
    group.productHandles.push(handle);
    groups.set(key, group);
  };

  const withType = products.filter((p) => cleanType(p.type)).length;
  if (withType / products.length >= 0.6) {
    for (const product of products) add(cleanType(product.type) || OTHER_COLLECTION_NAME, product.handle);
    return { collections: finish(groups), method: "tipo" };
  }

  let matched = 0;
  for (const product of products) {
    const haystack = normalizeText(`${product.name} ${product.type ?? ""} ${(product.tags ?? []).join(" ")}`);
    const category = KEYWORD_REGEX.find((c) => c.regex.test(haystack));
    if (category) matched++;
    add(category?.name ?? OTHER_COLLECTION_NAME, product.handle);
  }
  if (matched === 0) return { collections: [], method: "ninguno" };
  return { collections: finish(groups), method: "palabras" };
}

/// "Otros productos" siempre de último, y nunca una categoría vacía.
function finish(groups: Map<string, ProposedCollection>): ProposedCollection[] {
  const list = Array.from(groups.values()).filter((g) => g.productHandles.length > 0);
  const otherKey = normalizeText(OTHER_COLLECTION_NAME);
  return [
    ...list.filter((g) => normalizeText(g.name) !== otherKey),
    ...list.filter((g) => normalizeText(g.name) === otherKey),
  ];
}

/// Limpia lo que devuelve la IA (o cualquier propuesta): solo handles que
/// existen, cada producto en una sola categoría, sin categorías vacías, y
/// los que quedaron por fuera van a "Otros productos".
export function sanitizeProposal(
  proposal: { name: string; productHandles: string[] }[],
  products: CategorizeProduct[],
): ProposedCollection[] {
  const valid = new Set(products.map((p) => p.handle));
  const assigned = new Set<string>();
  const groups = new Map<string, ProposedCollection>();
  for (const item of proposal) {
    const name = item.name.trim().replace(/\s+/g, " ").slice(0, 80);
    if (name.length < 2) continue;
    const key = normalizeText(name);
    const group = groups.get(key) ?? { name, productHandles: [] };
    for (const handle of item.productHandles) {
      if (!valid.has(handle) || assigned.has(handle)) continue;
      assigned.add(handle);
      group.productHandles.push(handle);
    }
    groups.set(key, group);
  }
  const leftovers = products.filter((p) => !assigned.has(p.handle)).map((p) => p.handle);
  if (leftovers.length > 0) {
    const key = normalizeText(OTHER_COLLECTION_NAME);
    const group = groups.get(key) ?? { name: OTHER_COLLECTION_NAME, productHandles: [] };
    group.productHandles.push(...leftovers);
    groups.set(key, group);
  }
  return finish(groups);
}
