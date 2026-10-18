/// Familias de productos: los productos que son "el mismo" en otro
/// aroma, tono o tamaño pero están publicados como productos aparte
/// ("ACEITE DE CUTICULA COCO 30ML", "… UVA 30ML", "… PIÑA 30ML";
/// "VELOTERAPIA SANDIA 50GR" / "… SANDIA 130GR"). Se detectan por el
/// nombre, sin que nadie tenga que agruparlos a mano, y con eso la página
/// de un producto ofrece los demás de su familia ("otros aromas", "otros
/// tamaños") en cualquier tienda — no solo en las que usaron "Separar
/// variantes". Pedido el 2026-10-18: en amglow cada aroma es un producto
/// y al entrar a uno no se veían los otros.
///
/// Cada nombre se parte en tres: la base (lo que comparte la familia),
/// la variante (aroma, tono…) y el tamaño (número + unidad: 500ML, 1000
/// g, x 100 und). La base se reconoce de dos formas:
/// 1. Un separador en el nombre: "Gel Polish Verdes – Acida", "Crema de
///    manos (Coco)", "Limpiador de uñas 120ml aroma Sandía".
/// 2. Un prefijo común entre varios productos: "Pastilla efervescente
///    Lavanda" y "Pastilla efervescente Coco". Con una sola palabra en
///    común solo se agrupa si el resto es claramente un aroma, un tono o
///    un tamaño ("VELOTERAPIA SANDIA 50GR" sí; "Lima recta" y "Lima
///    banana" no).
/// Dentro de la familia, los que tienen el mismo tamaño son "otros
/// aromas" entre sí, y los que tienen el mismo aroma son "otros tamaños".
import { GROUP_ATTRIBUTE } from "@/lib/product-attributes";

export type FamilyInput = { id: string; name: string };

export type FamilyMember = {
  id: string;
  name: string;
  /// Los atributos que lo ubican en la familia: { Aroma: "SANDIA", Tamaño: "50GR" }.
  attrs: Record<string, string>;
};

export type ProductFamily = {
  /// Lo que comparten — el Grupo ("VELOTERAPIA", "ACEITE DE CUTICULA").
  group: string;
  /// Los ejes que distinguen a sus miembros: ["Aroma"], ["Tamaño"], ["Aroma", "Tamaño"]…
  axes: string[];
  members: FamilyMember[];
  how: "separator" | "prefix";
};

export const FAMILY_MIN_MEMBERS = 2;
/// Una "familia" de más productos que esto no es una familia sino una
/// categoría entera ("Esmalte semipermanente" × 150 colores): no se arma
/// sola, queda para hacerlo a mano.
export const FAMILY_MAX_MEMBERS = 80;

export const SIZE_AXES = new Set(["Tamaño", "Cantidad", "Número"]);

// ----------------------------------------------------------------------------
// Palabras
// ----------------------------------------------------------------------------

type Tok = { word: string; key: string };

function normalizeToken(word: string) {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const raw of text.trim().split(/\s+/)) {
    const key = normalizeToken(raw);
    if (!key) continue;
    // Sin la puntuación de los bordes: "(40" → "40", "Ref:" → "Ref".
    const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "") || raw;
    out.push({ word, key });
  }
  return out;
}

const words = (toks: Tok[]) => toks.map((t) => t.word).join(" ");
const keys = (toks: Tok[]) => toks.map((t) => t.key).join(" ");

/// Palabras que anuncian el valor ("aroma Sandía", "ref: CN-07"): no son
/// ni base ni valor. Se conservan si son la primera palabra del nombre.
const LABEL_WORDS = new Set(["aroma", "aromas", "sabor", "olor", "fragancia", "color", "tono", "talla", "tamano", "ref", "referencia"]);
const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "con", "para", "en", "y", "a", "al", "por", "sin", "the", "of"]);

function dropLabelWords(toks: Tok[]) {
  return toks.filter((t, i) => i === 0 || !LABEL_WORDS.has(t.key));
}

function stripLeadingStopwords(toks: Tok[]) {
  let i = 0;
  while (i < toks.length - 1 && STOPWORDS.has(toks[i].key)) i++;
  return toks.slice(i);
}

// ----------------------------------------------------------------------------
// Tamaños: número + unidad
// ----------------------------------------------------------------------------

const UNIT_RE =
  /^(?:ml|l|lt|lts|litro|litros|g|gr|grs|gramos|kg|kgs|kilo|kilos|oz|onza|onzas|cm|mm|m|mts|metros|pulg|pulgadas|in|und|unid|unidad|unidades|pcs|pz|pza|pzas|piezas|uds|u|par|pares|hojas|usos|w|watts|v|lb|lbs|libra|libras|servicios|sobres|aplicaciones|dosis|tips)$/;
const COUNT_UNITS = new Set(["und", "unid", "unidad", "unidades", "pcs", "pz", "pza", "pzas", "piezas", "uds", "u", "par", "pares", "hojas", "usos", "servicios", "sobres", "aplicaciones", "dosis", "tips"]);
const NUM_RE = /^\d+(?:[.,]\d+)?$/;
const GLUED_RE = /^(\d+(?:[.,]\d+)?)([a-z]+)$/;

type MeasureKind = "size" | "count" | "number";
type Size = { words: string; key: string; kind: MeasureKind };

const MEASURE_AXIS: Record<MeasureKind, string> = { size: "Tamaño", count: "Cantidad", number: "Número" };

/// Separa las medidas ("500ML", "1000 g", "x 100 und", "de 200ml", un
/// número suelto como "Gama azules 4" o "Uñas 010") del resto del nombre.
function splitSizes(toks: Tok[]): { rest: Tok[]; sizes: Size[] } {
  const rest: Tok[] = [];
  const sizes: Size[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const next = toks[i + 1];
    const glued = t.key.match(GLUED_RE);
    const prev = rest[rest.length - 1];
    let size: Tok[] | null = null;
    let kind: MeasureKind = "size";
    if (glued && UNIT_RE.test(glued[2])) {
      size = [t];
      kind = COUNT_UNITS.has(glued[2]) ? "count" : "size";
    } else if (NUM_RE.test(t.key) && next && UNIT_RE.test(next.key)) {
      size = [t, next];
      kind = COUNT_UNITS.has(next.key) ? "count" : "size";
      i++;
    } else if (NUM_RE.test(t.key) && prev?.key === "x") {
      // "Soft Gel Coffin x 100": una cantidad sin unidad.
      size = [t];
      kind = "count";
    } else if (/^x\d+$/.test(t.key)) {
      // "sandwich x240".
      size = [{ word: t.word.replace(/^x/i, ""), key: t.key.slice(1) }];
      kind = "count";
    } else if (NUM_RE.test(t.key) && i > 0) {
      // "Gama azules 4", "RUMI 109 Pastel", "Lima 100/180": un número que
      // distingue al producto.
      size = [t];
      kind = "number";
    }
    if (!size) {
      rest.push(t);
      continue;
    }
    // La "x" de "x 100 und" y el "de" de "de 200ml" no son de la base.
    if (prev && (prev.key === "x" || prev.key === "de")) rest.pop();
    sizes.push({ words: words(size), key: keys(size), kind });
  }
  return { rest, sizes };
}

// ----------------------------------------------------------------------------
// Qué es el valor: aroma, tono, tamaño…
// ----------------------------------------------------------------------------

const AROMA_WORDS = new Set(
  (
    "lavanda coco vainilla menta eucalipto rosas canela citrico citricos limon naranja mandarina mango fresa fresas chocolate cafe " +
    "maracuya jazmin manzanilla miel avena karite almendra almendras sandalo bergamota lemongrass limoncillo romero cereza cerezas uva uvas " +
    "sandia pina pera manzana durazno melon frambuesa mora moras arandano arandanos blueberry lavender coconut vanilla mint rose citrus lemon " +
    "orange strawberry honey oatmeal almond jasmine chamomile cedro pino oud ambar almizcle musk floral flores tropical caramelo talco aloe " +
    "pepino cucumber carbon charcoal neutro hierbabuena yerbabuena tutti frutti chicle bubblegum banano banana kiwi papaya guanabana lulo " +
    "cacao mocca mocha te matcha jengibre ginger clavo vino calendula yogurt yogur frutal frutas fruta natural cheesecake brownie galleta " +
    "cookie dulce avellana pistacho nutella sport fresh men bebe bebes algodon marino marina oceano brisa jabon limpio frutos bosque"
  ).split(/\s+/),
);
const AROMA_PHRASES = ["te verde", "frutos rojos", "frutos del bosque", "agua de rosas", "leche de coco", "flor de cerezo", "sal marina", "brisa marina", "sin aroma", "sin olor", "men fresh"];

const COLOR_WORDS = new Set(
  (
    "rojo roja rojos rojas rosa rosado rosada rosados rosadas azul azules verde verdes amarillo amarilla amarillos negro negra negros blanco " +
    "blanca blancos nude nudes dorado dorada oro plateado plateada plata morado morada violeta lila lilas lavanda fucsia naranja cafe marron " +
    "beige gris coral turquesa vino vinotinto borgona burgundy cereza menta oliva mostaza terracota salmon durazno melocoton transparente " +
    "clear cristal pink red blue green yellow black white gold silver purple brown grey gray orange chocolate caramelo champagne perla perlado " +
    "holografico holo glitter mate brillante neon pastel tornasol cromo chrome espejo aurora magenta cian celeste indigo ocre camel taupe " +
    "mocha mocca ivory marfil crema hueso nacarado metalizado metalico multicolor saturado saturados pasteles neones nacarados " +
    "satin satinado satinados fluor fluorescente fluorescentes foil visos sombras tonos"
  ).split(/\s+/),
);

const TAMANO_WORDS = new Set("grande mediano mediana pequeno pequena chico chica mini maxi jumbo xl familiar individual".split(/\s+/));
const TALLA_KEYS = new Set(["xs", "s", "m", "l", "xl", "xxl", "xxxl", "xss", "ml", "sm", "lxl"]);
const VARIANT_WORDS = new Set("surtido surtidos surtida surtidas mixto mixtos variado variados clasico clasica original unisex hombre mujer kids ninos nina nino arcoiris".split(/\s+/));
const TALLA_RE = /^(?:talla\s*(?:xs|s|m|l|xl|xxl|xxxl|\d{1,2}(?:[.,]5)?)|xs|s|m|l|xl|xxl|xxxl|xs\/s|m\/l|s\/m|l\/xl)$/i;
const NUMERO_RE = /^(?:#|n[°º]?\.?\s*|no\.?\s*|num\.?\s*|numero\s*)?\d{1,4}[a-z]?$/i;

/// Una palabra de valor que se reconoce sola (para agrupar con una sola
/// palabra de base).
function recognized(t: Tok) {
  return (
    AROMA_WORDS.has(t.key) || COLOR_WORDS.has(t.key) || TAMANO_WORDS.has(t.key) || TALLA_KEYS.has(t.key) || VARIANT_WORDS.has(t.key) || NUM_RE.test(t.key)
  );
}

function aromaScore(value: string) {
  const key = keys(tokenize(value));
  let score = key.split(" ").filter((k) => AROMA_WORDS.has(k)).length;
  if (AROMA_PHRASES.some((p) => key.includes(p))) score += 2;
  return score;
}

function colorScore(value: string) {
  return keys(tokenize(value))
    .split(" ")
    .filter((k) => COLOR_WORDS.has(k)).length;
}

export function hasVocabulary(value: string) {
  return aromaScore(value) > 0 || colorScore(value) > 0 || TALLA_RE.test(value.trim()) || tokenize(value).every((t) => TAMANO_WORDS.has(t.key));
}

/// El eje de una familia a partir de sus valores: la mayoría manda.
export function inferFamilyAxis(values: string[]): string {
  const clean = values.map((v) => v.trim()).filter(Boolean);
  if (clean.length === 0) return "Opción";
  const half = clean.length / 2;
  if (clean.every((v) => tokenize(v).every((t) => TAMANO_WORDS.has(t.key)))) return "Tamaño";
  if (clean.every((v) => TALLA_RE.test(v))) return "Talla";
  if (clean.every((v) => NUMERO_RE.test(v))) return "Número";
  const aroma = clean.reduce((n, v) => n + aromaScore(v), 0);
  const color = clean.reduce((n, v) => n + colorScore(v), 0);
  const aromaHits = clean.filter((v) => aromaScore(v) > 0).length;
  const colorHits = clean.filter((v) => colorScore(v) > 0).length;
  if (aromaHits >= half && aroma > color) return "Aroma";
  if (colorHits >= half && color > 0) return "Tono";
  if (clean.filter((v) => tokenize(v).every((t) => TAMANO_WORDS.has(t.key))).length > half) return "Tamaño";
  return "Opción";
}

// ----------------------------------------------------------------------------
// Separadores explícitos en el nombre
// ----------------------------------------------------------------------------

const SEPARATOR_RE = /\s+[–—-]\s+|\s+[/|]\s+/;

function valueOk(value: string) {
  const n = value.split(/\s+/).filter(Boolean).length;
  return n >= 1 && n <= 5 && value.length <= 60;
}

/// "Gel Polish Verdes – Acida 15 ml" → { base: "Gel Polish Verdes", value: "Acida 15 ml" }.
export function splitBySeparator(name: string): { base: string; value: string } | null {
  const clean = name.trim().replace(/\s+/g, " ");
  const parts = clean.split(SEPARATOR_RE);
  if (parts.length >= 2) {
    const value = parts[parts.length - 1].trim();
    const base = parts.slice(0, -1).join(" – ").trim();
    return valueOk(value) && base.length >= 3 ? { base, value } : null;
  }
  const paren = clean.match(/^(.+?)\s*\(([^()]{1,40})\)$/);
  if (paren && valueOk(paren[2].trim()) && paren[1].trim().length >= 3) return { base: paren[1].trim(), value: paren[2].trim() };
  const keyword = clean.match(/^(.+?)\s+(?:aroma|sabor|olor|fragancia|color|tono|talla|tamaño|tamano)\s*:?\s+(.{1,40})$/i);
  if (keyword && valueOk(keyword[2].trim()) && keyword[1].trim().length >= 3) return { base: keyword[1].trim(), value: keyword[2].trim() };
  const en = clean.match(/^(.+?)\s+en\s+(.{1,40})$/i);
  if (en && valueOk(en[2].trim()) && en[1].trim().length >= 3 && hasVocabulary(en[2])) return { base: en[1].trim(), value: en[2].trim() };
  return null;
}

// ----------------------------------------------------------------------------
// Detección
// ----------------------------------------------------------------------------

type Parsed = {
  id: string;
  name: string;
  /// Base + variante, sin tamaños (para agrupar por prefijo).
  rest: Tok[];
  /// Solo si el nombre tiene separador: la base exacta.
  base: Tok[] | null;
  /// Solo con separador: lo que va después (la variante).
  variant: Tok[];
  sizes: Size[];
};

function parse(p: FamilyInput): Parsed {
  const name = p.name.trim().replace(/\s+/g, " ");
  const sep = splitBySeparator(name);
  if (sep) {
    const left = splitSizes(dropLabelWords(tokenize(sep.base)));
    const right = splitSizes(dropLabelWords(tokenize(sep.value)));
    // "JELLY SPA … (40 sobres)": lo de adentro es un tamaño, no una variante.
    if (left.rest.length > 0 && right.rest.length > 0) {
      return { id: p.id, name, rest: [...left.rest, ...right.rest], base: left.rest, variant: right.rest, sizes: [...left.sizes, ...right.sizes] };
    }
  }
  const { rest, sizes } = splitSizes(dropLabelWords(tokenize(name)));
  return { id: p.id, name, rest, base: null, variant: [], sizes };
}

type ClusterMember = Parsed & { variantToks: Tok[] };
type Cluster = { label: string; depth: number; how: ProductFamily["how"]; members: ClusterMember[] };

function clustersOf(parsed: Parsed[]): Cluster[] {
  const out: Cluster[] = [];
  // 1. Con separador: por base exacta.
  const explicit = new Map<string, Parsed[]>();
  for (const p of parsed) {
    if (!p.base) continue;
    const key = keys(p.base);
    explicit.set(key, [...(explicit.get(key) ?? []), p]);
  }
  for (const members of explicit.values()) {
    if (members.length < FAMILY_MIN_MEMBERS) continue;
    out.push({
      label: words(members[0].base!),
      depth: 100,
      how: "separator",
      members: members.map((m) => ({ ...m, variantToks: stripLeadingStopwords(m.variant) })),
    });
  }
  // 2. Sin separador: por prefijo común, del más largo al más corto.
  const plain = parsed.filter((p) => !p.base);
  const maxLen = Math.max(0, ...plain.map((p) => p.rest.length));
  for (let L = maxLen; L >= 1; L--) {
    const groups = new Map<string, Parsed[]>();
    for (const p of plain) {
      if (p.rest.length < L) continue;
      const key = keys(p.rest.slice(0, L));
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    for (const members of groups.values()) {
      if (members.length < FAMILY_MIN_MEMBERS) continue;
      const base = members[0].rest.slice(0, L);
      // "Oleo de" no es una base: se prueba "Oleo" con "de Calendula".
      if (STOPWORDS.has(base[L - 1].key)) continue;
      const cms = members
        .map((m) => ({ ...m, variantToks: stripLeadingStopwords(m.rest.slice(L)) }))
        .filter((m) => m.variantToks.length <= 4);
      if (cms.length < FAMILY_MIN_MEMBERS) continue;
      // Lo que comparten al final también es de la base: "Colección candy
      // cat eye" y "Colección dark cat eye" son "Colección cat eye".
      out.push(...suffixClusters(base, cms));
      if (L === 1 && !cms.every((m) => m.variantToks.every(recognized))) continue;
      out.push({ label: words(base), depth: L, how: "prefix", members: cms });
    }
  }
  return out;
}

function suffixClusters(base: Tok[], members: ClusterMember[]): Cluster[] {
  const out: Cluster[] = [];
  const longest = Math.max(0, ...members.map((m) => m.variantToks.length));
  for (let K = longest - 1; K >= 1; K--) {
    const groups = new Map<string, ClusterMember[]>();
    for (const m of members) {
      if (m.variantToks.length <= K) continue;
      const key = keys(m.variantToks.slice(-K));
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    for (const group of groups.values()) {
      if (group.length < FAMILY_MIN_MEMBERS) continue;
      const suffix = group[0].variantToks.slice(-K);
      if (STOPWORDS.has(suffix[0].key)) continue;
      const cms = group.map((m) => ({ ...m, variantToks: stripLeadingStopwords(m.variantToks.slice(0, -K)) })).filter((m) => m.variantToks.length > 0);
      if (cms.length < FAMILY_MIN_MEMBERS) continue;
      out.push({ label: `${words(base)} ${words(suffix)}`, depth: base.length + K, how: "prefix", members: cms });
    }
  }
  return out;
}

function containsColorWord(text: string) {
  return colorScore(text) > 0;
}

/// Los miembros de un grupo que de verdad tienen con quién compararse:
/// otro aroma del mismo tamaño, u otro tamaño del mismo aroma.
function buildFamily(cluster: Cluster): { members: FamilyMember[]; axes: string[] } | null {
  const ms = cluster.members;
  const vkey = (m: ClusterMember) => keys(m.variantToks);
  const skey = (m: ClusterMember) => m.sizes.map((s) => s.key).join(" ");
  const distinctVariants = new Set(ms.map(vkey)).size;
  const distinctSizes = new Set(ms.map(skey)).size;
  let variantAxis: string | null = null;
  if (distinctVariants > 1) {
    variantAxis = inferFamilyAxis(ms.filter((m) => m.variantToks.length > 0).map((m) => words(m.variantToks)));
    if (variantAxis === "Opción" && containsColorWord(cluster.label)) variantAxis = "Tono";
  }
  let sizeAxis: string | null = null;
  if (distinctSizes > 1) {
    const kinds = new Set(ms.flatMap((m) => m.sizes.map((s) => s.kind)));
    sizeAxis = kinds.size === 1 ? MEASURE_AXIS[[...kinds][0]] : "Tamaño";
  }
  if (!variantAxis && !sizeAxis) return null;

  const inFamily = new Set<string>();
  const bySize = new Map<string, ClusterMember[]>();
  const byVariant = new Map<string, ClusterMember[]>();
  for (const m of ms) {
    bySize.set(skey(m), [...(bySize.get(skey(m)) ?? []), m]);
    byVariant.set(vkey(m), [...(byVariant.get(vkey(m)) ?? []), m]);
  }
  if (variantAxis) {
    for (const group of bySize.values()) {
      const withVariant = group.filter((m) => m.variantToks.length > 0);
      if (new Set(withVariant.map(vkey)).size < FAMILY_MIN_MEMBERS || withVariant.length > FAMILY_MAX_MEMBERS) continue;
      for (const m of withVariant) inFamily.add(m.id);
    }
  }
  if (sizeAxis) {
    for (const group of byVariant.values()) {
      const withSize = group.filter((m) => m.sizes.length > 0);
      if (new Set(withSize.map(skey)).size < FAMILY_MIN_MEMBERS || withSize.length > FAMILY_MAX_MEMBERS) continue;
      for (const m of withSize) inFamily.add(m.id);
    }
  }
  // Si todos cambian de aroma y de tamaño a la vez ("Dual System
  // sandwich x240" / "Dual System Mix x 144") no hay "otros del mismo
  // tamaño": queda un solo eje con todo el valor junto.
  if (inFamily.size === 0) {
    const axis = variantAxis ?? sizeAxis!;
    const fallback = ms.filter((m) => m.variantToks.length > 0 || m.sizes.length > 0);
    const valueOf = (m: ClusterMember) => [words(m.variantToks), m.sizes.map((s) => s.words).join(" ")].filter(Boolean).join(" ");
    if (fallback.length < FAMILY_MIN_MEMBERS || fallback.length > FAMILY_MAX_MEMBERS || new Set(fallback.map((m) => keys(tokenize(valueOf(m))))).size < FAMILY_MIN_MEMBERS) return null;
    return { members: fallback.map((m) => ({ id: m.id, name: m.name, attrs: { [axis]: valueOf(m) } })), axes: [axis] };
  }
  const members: FamilyMember[] = ms
    .filter((m) => inFamily.has(m.id))
    .map((m) => ({
      id: m.id,
      name: m.name,
      attrs: {
        ...(variantAxis && m.variantToks.length > 0 ? { [variantAxis]: words(m.variantToks) } : {}),
        ...(sizeAxis && m.sizes.length > 0 ? { [sizeAxis]: m.sizes.map((s) => s.words).join(" ") } : {}),
      },
    }));
  if (members.length < FAMILY_MIN_MEMBERS) return null;
  const axes = [variantAxis, sizeAxis].filter((a): a is string => Boolean(a));
  return { members, axes };
}

export function detectProductFamilies(products: FamilyInput[]): ProductFamily[] {
  const parsed = products.map(parse).filter((p) => p.rest.length > 0);
  const clusters = clustersOf(parsed);
  // El grupo más grande gana cada producto; a igual tamaño, la base más
  // específica.
  const scored = clusters
    .map((cluster) => ({ cluster, built: buildFamily(cluster) }))
    .filter((x): x is { cluster: Cluster; built: NonNullable<ReturnType<typeof buildFamily>> } => x.built !== null)
    .sort((a, b) => b.built.members.length - a.built.members.length || b.cluster.depth - a.cluster.depth);
  const taken = new Set<string>();
  const families: ProductFamily[] = [];
  for (const { cluster } of scored) {
    const remaining = { ...cluster, members: cluster.members.filter((m) => !taken.has(m.id)) };
    if (remaining.members.length < FAMILY_MIN_MEMBERS) continue;
    const built = buildFamily(remaining);
    if (!built) continue;
    for (const m of built.members) taken.add(m.id);
    families.push({ group: cluster.label.replace(/[\s–—\-/|:,]+$/, "").trim(), axes: built.axes, members: built.members, how: cluster.how });
  }
  return families;
}

/// La familia a la que pertenece un producto (o null si está solo).
export function familyOf(products: FamilyInput[], productId: string): ProductFamily | null {
  return detectProductFamilies(products).find((f) => f.members.some((m) => m.id === productId)) ?? null;
}

// ----------------------------------------------------------------------------
// "Otros aromas" / "otros tamaños" de un producto
// ----------------------------------------------------------------------------

export type SiblingAxisGroup<T> = {
  axis: string;
  /// "VELOTERAPIA SANDIA": el grupo más los valores de los otros ejes.
  label: string;
  current: string;
  /// El actual primero, los demás ordenados por valor.
  items: T[];
};

/// Por cada eje del producto, los demás de su grupo que coinciden en
/// todo lo otro: para "VELOTERAPIA SANDIA 50GR", los otros aromas de 50GR
/// y los otros tamaños de SANDIA.
export function buildSiblingGroups<T extends { id: string; attrs: Record<string, string> }>(group: string, current: T, members: T[]): SiblingAxisGroup<T>[] {
  const axes = Object.keys(current.attrs).filter((k) => k !== GROUP_ATTRIBUTE && current.attrs[k]);
  const out: SiblingAxisGroup<T>[] = [];
  for (const axis of axes) {
    const others = axes.filter((a) => a !== axis);
    const items = members.filter(
      (m) => m.id !== current.id && m.attrs[axis] && others.every((o) => (m.attrs[o] ?? "") === (current.attrs[o] ?? "")),
    );
    if (items.length === 0) continue;
    items.sort((a, b) => a.attrs[axis].localeCompare(b.attrs[axis], "es", { numeric: true, sensitivity: "base" }));
    out.push({
      axis,
      label: [group, ...others.map((o) => current.attrs[o]).filter(Boolean)].join(" "),
      current: current.attrs[axis],
      items: [current, ...items],
    });
  }
  return out;
}
