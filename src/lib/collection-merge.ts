/// Menos colecciones cuando la tienda tiene de más.
///
/// Muchas tiendas arman una colección por cada variante de lo mismo:
/// "Gel Polish Azules", "Gel Polish Rosados"… con un producto cada una.
/// Para la tienda en Marcolini eso es una sola categoría. Acá vive la
/// parte pura: la regla sin IA (unir las colecciones pequeñas que
/// comparten las primeras palabras), la limpieza de lo que propone la IA
/// y el armado de la propuesta (qué se une con qué). La IA está en
/// shopify-categorize-service.ts; la elección, en shopify-importer.tsx.
/// Ver conversación del 2026-10-18.

import { normalizeText } from "@/lib/shopify-categorize";
import { slugify } from "@/lib/shopify-csv";

export type MergeSourceCollection = { handle: string; name: string; productHandles: string[] };

/// Una colección de la propuesta: su nombre, las originales que la
/// forman (una sola si no se unió con nada) y la unión de sus productos.
export type MergedCollection = {
  handle: string;
  name: string;
  sourceHandles: string[];
  productHandles: string[];
};

export type MergeProposal = { collections: MergedCollection[]; source: "ia" | "reglas" };

/// Hasta cuántos productos tiene una colección "pequeña", candidata a
/// unirse con sus parecidas.
export const SMALL_COLLECTION = 3;
const PREFIX_WORDS = 2;
const MIN_GROUP = 2;
const MAX_NAME = 60;
/// Palabras que no pueden cerrar un nombre ("Kit de" → "Kit").
const TRAILING_STOP_WORDS = new Set(["de", "del", "la", "el", "los", "las", "y", "e", "o", "u", "para", "con", "en", "por", "sin", "a"]);

function words(name: string) {
  return normalizeText(name).split(" ").filter(Boolean);
}

/// Las primeras palabras del nombre con su escritura original, para
/// nombrar el grupo ("Gel Polish Azules" → "Gel Polish").
function originalPrefix(name: string, count: number) {
  const tokens = name.replace(/\s+/g, " ").trim().split(" ");
  const kept: string[] = [];
  for (const token of tokens) {
    if (normalizeText(token)) kept.push(token);
    if (kept.length === count) break;
  }
  while (kept.length > 0 && TRAILING_STOP_WORDS.has(normalizeText(kept[kept.length - 1]))) kept.pop();
  return kept.join(" ");
}

function unionProducts(sources: MergeSourceCollection[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const source of sources) {
    for (const handle of source.productHandles) {
      if (seen.has(handle)) continue;
      seen.add(handle);
      out.push(handle);
    }
  }
  return out;
}

/// Handle de una colección propuesta: el original si es una sola; si une
/// varias, uno nuevo a partir del nombre, distinto de los que ya existen.
function groupHandle(name: string, sources: MergeSourceCollection[], taken: Set<string>) {
  if (sources.length === 1) return sources[0].handle;
  const base = slugify(name) || "coleccion";
  // Si una de las originales ya tiene ese handle o se llama como el
  // grupo, el grupo se queda con el suyo (y con su slug en la tienda).
  const own = sources.find((s) => s.handle === base) ?? sources.find((s) => normalizeText(s.name) === normalizeText(name));
  if (own) return own.handle;
  let handle = base;
  for (let n = 2; taken.has(handle); n++) handle = `${base}-${n}`;
  return handle;
}

/// Arma la propuesta a partir de grupos (nombre + originales que lo
/// forman). Lo que no quedó en ningún grupo sigue tal cual, al final.
/// Devuelve null cuando no cambia nada respecto a lo original.
export function buildMergeProposal(
  groups: { name: string; sourceHandles: string[] }[],
  collections: MergeSourceCollection[],
  source: MergeProposal["source"],
): MergeProposal | null {
  const byHandle = new Map(collections.map((c) => [c.handle, c]));
  const assigned = new Set<string>();
  const merged: { name: string; sources: MergeSourceCollection[] }[] = [];
  for (const group of groups) {
    const name = group.name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
    const sources: MergeSourceCollection[] = [];
    for (const handle of group.sourceHandles) {
      const collection = byHandle.get(handle);
      if (!collection || assigned.has(handle)) continue;
      assigned.add(handle);
      sources.push(collection);
    }
    if (sources.length === 0) continue;
    merged.push({ name: name.length >= 2 ? name : sources[0].name, sources });
  }
  for (const collection of collections) {
    if (!assigned.has(collection.handle)) merged.push({ name: collection.name, sources: [collection] });
  }

  const unchanged =
    merged.length === collections.length &&
    merged.every((m, i) => m.sources.length === 1 && normalizeText(m.name) === normalizeText(collections[i].name));
  if (unchanged) return null;

  const taken = new Set(collections.map((c) => c.handle));
  const result: MergedCollection[] = [];
  for (const m of merged) {
    const handle = groupHandle(m.name, m.sources, taken);
    taken.add(handle);
    result.push({
      handle,
      name: m.name,
      sourceHandles: m.sources.map((s) => s.handle),
      productHandles: unionProducts(m.sources),
    });
  }
  return { collections: result, source };
}

/// La regla sin IA: las colecciones pequeñas que comparten las dos
/// primeras palabras se unen bajo esas palabras ("Gel Polish Azules" +
/// "Gel Polish Rosados" → "Gel Polish"); si ya existe una colección que
/// se llama así, las absorbe. Las repetidas (mismo nombre) también se
/// unen. Lo demás queda igual.
export function proposeMergeByRules(collections: MergeSourceCollection[]): MergeProposal | null {
  if (collections.length < 2) return null;
  const groups = new Map<string, { name: string; sourceHandles: string[] }>();
  const grouped = new Set<string>();

  // 1. Repetidas.
  const byName = new Map<string, MergeSourceCollection[]>();
  for (const c of collections) {
    const key = normalizeText(c.name);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), c]);
  }
  for (const [key, list] of byName) {
    if (list.length < 2) continue;
    groups.set(`name:${key}`, { name: list[0].name, sourceHandles: list.map((c) => c.handle) });
    for (const c of list) grouped.add(c.handle);
  }

  // 1b. Mismos productos: dos colecciones con exactamente los mismos
  // productos son una sola (WooCommerce las repite con otro nombre o
  // como categoría y etiqueta). Se queda con el nombre que empieza en
  // mayúscula, o el primero.
  const bySet = new Map<string, MergeSourceCollection[]>();
  for (const c of collections) {
    if (grouped.has(c.handle) || c.productHandles.length === 0) continue;
    const key = Array.from(new Set(c.productHandles)).sort().join("|");
    bySet.set(key, [...(bySet.get(key) ?? []), c]);
  }
  for (const [key, list] of bySet) {
    if (list.length < 2) continue;
    const name = list.find((c) => /^[A-ZÁÉÍÓÚÑ]/.test(c.name))?.name ?? list[0].name;
    groups.set(`set:${key}`, { name, sourceHandles: list.map((c) => c.handle) });
    for (const c of list) grouped.add(c.handle);
  }

  // 2. Pequeñas con el mismo comienzo.
  const byPrefix = new Map<string, MergeSourceCollection[]>();
  for (const c of collections) {
    if (grouped.has(c.handle) || c.productHandles.length > SMALL_COLLECTION) continue;
    const w = words(c.name);
    if (w.length <= PREFIX_WORDS) continue;
    const prefix = originalPrefix(c.name, PREFIX_WORDS);
    const key = normalizeText(prefix);
    if (!key) continue;
    byPrefix.set(key, [...(byPrefix.get(key) ?? []), c]);
  }
  for (const [key, list] of byPrefix) {
    if (list.length < MIN_GROUP) continue;
    const name = originalPrefix(list[0].name, PREFIX_WORDS);
    // Una colección que ya se llama como el grupo lo encabeza.
    const existing = collections.find((c) => !grouped.has(c.handle) && normalizeText(c.name) === key);
    const sources = existing ? [existing, ...list] : list;
    groups.set(`prefix:${key}`, { name: existing?.name ?? name, sourceHandles: sources.map((c) => c.handle) });
    for (const c of sources) grouped.add(c.handle);
  }

  if (groups.size === 0) return null;
  // Los grupos van en el lugar de su primera colección, para no
  // desordenar el menú.
  const ordered: { name: string; sourceHandles: string[] }[] = [];
  const placed = new Set<string>();
  for (const c of collections) {
    if (placed.has(c.handle)) continue;
    const group = Array.from(groups.values()).find((g) => g.sourceHandles.includes(c.handle));
    if (group) {
      ordered.push(group);
      for (const h of group.sourceHandles) placed.add(h);
    } else {
      ordered.push({ name: c.name, sourceHandles: [c.handle] });
      placed.add(c.handle);
    }
  }
  return buildMergeProposal(ordered, collections, "reglas");
}

/// Limpia lo que devuelve la IA: solo handles que existen, cada original
/// en un solo grupo, y lo que la IA dejó por fuera sigue igual.
export function sanitizeMergeProposal(
  proposal: { name: string; sourceHandles: string[] }[],
  collections: MergeSourceCollection[],
): MergeProposal | null {
  return buildMergeProposal(proposal, collections, "ia");
}

/// "/collections/gel-polish-azules" (o la URL completa) → "gel-polish-azules".
export function collectionHandleFromHref(href: string): string | null {
  const match = href.match(/\/collections\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
}

/// El menú de la tienda con las colecciones unidas: los enlaces a las
/// originales de un grupo se vuelven uno solo, con el nombre del grupo,
/// en el lugar del primero. Si el menú viene en mayúsculas, el nuevo
/// también.
export function menuForProposal<L extends { label: string; href: string; children?: L[] }>(links: L[], proposal: MergeProposal): L[] {
  const groupBySource = new Map<string, MergedCollection>();
  for (const m of proposal.collections) {
    if (m.sourceHandles.length > 1) for (const h of m.sourceHandles) groupBySource.set(h, m);
  }
  if (groupBySource.size === 0) return links;
  const labels = links.map((l) => l.label.trim()).filter((l) => /[a-záéíóúñ]/i.test(l));
  const uppercase = labels.length > 0 && labels.filter((l) => l === l.toUpperCase()).length >= labels.length * 0.8;
  const out: L[] = [];
  const seen = new Set<string>();
  for (const rawLink of links) {
    // Los submenús se traducen igual.
    const link = rawLink.children ? { ...rawLink, children: menuForProposal(rawLink.children, proposal) } : rawLink;
    const handle = collectionHandleFromHref(link.href);
    const group = handle ? groupBySource.get(handle) : undefined;
    if (!group) {
      out.push(link);
      continue;
    }
    if (seen.has(group.handle)) continue;
    seen.add(group.handle);
    out.push({ ...link, label: uppercase ? group.name.toUpperCase() : group.name, href: `/collections/${group.handle}` });
  }
  return out;
}
