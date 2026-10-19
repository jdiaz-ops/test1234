import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  ANNOUNCEMENT_MAX,
  COPY_LIMITS,
  MAX_FEATURED_COLLECTIONS,
  MAX_MAIN_COLLECTIONS,
  RECENT_DAYS,
  sanitizeProductCopy,
  type ExistingSectionSummary,
  type OrganizerCollection,
  type OrganizerPlan,
  type OrganizerProduct,
  type ProductCopy,
  type RawHomeComposition,
} from "@/lib/store-organizer";
import { sectorFromVertical } from "@/server/services/shopify-categorize-service";

/// La estructura del catálogo con Claude, en dos pasos cortos para que
/// ninguna petición se pase del tiempo máximo de Vercel (Rumi tiene 379
/// productos y una sola llamada tardaba más de un minuto):
/// 1. Definir: viendo los nombres de todo el catálogo, qué colecciones
///    principales debería tener la tienda (pocas y claras), con una
///    descripción y, donde haya volumen, subcolecciones.
/// 2. Clasificar: por tandas de productos, en cuál de esas colecciones va
///    cada uno (y en qué subcolección), más los nombres que mejoran. Los
///    productos van numerados (#1, #2…) en vez de con sus ids largos, para
///    que la respuesta sea corta y rápida.
/// 3. Componer la portada: con el catálogo ya organizado y lo que la
///    portada tenía (banners, videos importados), qué secciones van y en
///    qué orden, siguiendo una línea directiva de conversión (ver
///    composeHomeWithClaude). Pedido el 2026-10-19: "que la IA se
///    encargue pero con una línea directiva".
/// 4. Fichas de producto: por tandas, solo para los productos que no
///    tienen ficha, con la misma directiva (qué es, qué gana quien compra,
///    qué incluye, cómo se usa, datos reales). Las fichas que existen no
///    se tocan (ver describeProductsWithClaude). "Estas filosofías deben
///    existir en toda la tienda, no solo en la portada" (2026-10-19).
/// El navegador encadena los pasos (ver store-organizer-tool.tsx). Sin
/// llave, o si la IA falla, caen las reglas de store-organizer.ts.

const AI_TIMEOUT_MS = 45_000;
/// Productos por tanda de clasificación.
export const CLASSIFY_BATCH_SIZE = 120;
const MAX_CATALOG_NAMES = 2000;

export { sectorFromVertical };

export type DefinedCollection = { name: string; description: string; children: string[] };
export type Assignment = { id: string; collection: string; child: string | null };
export type ClassifyResult = { assignments: Assignment[]; productNames: { id: string; name: string }[] };

export function aiAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function sectorOf(sector: string | null | undefined) {
  return sector?.trim() || "productos para uñas";
}

function systemPrompt(sector: string) {
  return `Eres quien organiza el catálogo de una tienda en línea colombiana de ${sector} para que venda más: pocas categorías claras, nombres cortos y productos bien ubicados. Respondes solo con el JSON pedido.`;
}

async function ask<T>(system: string, user: string, schema: Record<string, unknown>, parse: (raw: unknown) => T | null, maxTokens: number): Promise<T | null> {
  const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 0 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!block) return null;
  return parse(JSON.parse(block.text));
}

// ---------------------------------------------------------------------------
// Paso 1: definir las colecciones
// ---------------------------------------------------------------------------

const definitionSchema = z.object({
  collections: z.array(z.object({ name: z.string(), description: z.string(), children: z.array(z.string()) })),
});

const DEFINITION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          children: { type: "array", items: { type: "string" } },
        },
        required: ["name", "description", "children"],
        additionalProperties: false,
      },
    },
  },
  required: ["collections"],
  additionalProperties: false,
} as const;

export type DefineInput = {
  products: OrganizerProduct[];
  collections: OrganizerCollection[];
  storeName: string;
  sector?: string | null;
};

export async function defineCollectionsWithClaude(input: DefineInput): Promise<DefinedCollection[] | null> {
  const sector = sectorOf(input.sector);
  const current =
    input.collections.length === 0
      ? "La tienda no tiene colecciones todavía."
      : `Colecciones actuales (nombre | productos), solo de referencia — se pueden conservar, unir, renombrar o quitar:\n${input.collections
          .map((c) => `${c.name.replace(/\s+/g, " ").trim()} | ${c.productIds.length}`)
          .join("\n")}`;
  const names = input.products.slice(0, MAX_CATALOG_NAMES).map((p) => p.name.replace(/\s+/g, " ").trim());
  const user = [
    `La tienda "${input.storeName}" (${sector}) tiene ${input.products.length} productos y se va a organizar de nuevo para que venda más. ${current}`,
    "",
    `Define entre 5 y ${MAX_MAIN_COLLECTIONS} colecciones principales, como las usaría una tienda que vende bien de este rubro: por tipo de producto o por uso, no por color, tono, aroma ni tamaño (esas variantes van juntas dentro de la misma colección).`,
    "Nombres cortos (máximo 30 caracteres), en español de Colombia, con mayúscula solo al inicio y en marcas, sin emojis, sin la palabra \"colección\" y sin el nombre de la tienda.",
    "Una descripción de una línea por colección (máximo 120 caracteres) que invite a comprar, sin emojis ni mayúsculas sostenidas.",
    "Si una colección va a quedar con más de 20 productos y se parte de forma natural (por ejemplo Semipermanente → Colores, Bases y tops, Lámparas), pon esas subcolecciones en children (nombres cortos); si no, children vacío.",
    "No pongas una colección \"Otros productos\": lo que no encaje se maneja después.",
    "Solo define las colecciones; los productos se clasifican en el paso siguiente.",
    "",
    "Nombres de todos los productos:",
    ...names,
  ].join("\n");
  const raw = await ask(systemPrompt(sector), user, DEFINITION_OUTPUT_SCHEMA, (r) => definitionSchema.safeParse(r).data ?? null, 3000);
  if (!raw) return null;
  const seen = new Set<string>();
  const out: DefinedCollection[] = [];
  for (const c of raw.collections) {
    const name = c.name.replace(/\s+/g, " ").trim().slice(0, 40);
    const key = name.toLowerCase();
    if (name.length < 2 || seen.has(key) || /^otros productos$/i.test(name)) continue;
    seen.add(key);
    const children = Array.from(new Set(c.children.map((ch) => ch.replace(/\s+/g, " ").trim().slice(0, 40)).filter((ch) => ch.length >= 2))).slice(0, 8);
    out.push({ name, description: c.description.replace(/\s+/g, " ").trim().slice(0, 160), children });
    if (out.length >= MAX_MAIN_COLLECTIONS + 2) break;
  }
  return out.length >= 2 ? out : null;
}

// ---------------------------------------------------------------------------
// Paso 2: clasificar una tanda
// ---------------------------------------------------------------------------

const assignmentSchema = z.object({
  assignments: z.array(z.object({ n: z.number(), collection: z.string(), child: z.string() })),
  productNames: z.array(z.object({ n: z.number(), name: z.string() })),
});

const ASSIGNMENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: { n: { type: "integer" }, collection: { type: "string" }, child: { type: "string" } },
        required: ["n", "collection", "child"],
        additionalProperties: false,
      },
    },
    productNames: {
      type: "array",
      items: {
        type: "object",
        properties: { n: { type: "integer" }, name: { type: "string" } },
        required: ["n", "name"],
        additionalProperties: false,
      },
    },
  },
  required: ["assignments", "productNames"],
  additionalProperties: false,
} as const;

export type ClassifyInput = {
  products: OrganizerProduct[];
  /// Nombres de las colecciones actuales (id → nombre), para mostrar en
  /// qué colección estaba cada producto.
  currentNames: Map<string, string>;
  collections: DefinedCollection[];
  sector?: string | null;
};

export async function classifyWithClaude(input: ClassifyInput): Promise<ClassifyResult | null> {
  const sector = sectorOf(input.sector);
  const products = input.products.slice(0, CLASSIFY_BATCH_SIZE);
  const options = input.collections
    .map((c) => (c.children.length > 0 ? `"${c.name}" (subcolecciones: ${c.children.map((ch) => `"${ch}"`).join(", ")})` : `"${c.name}"`))
    .join(", ");
  const lines = products.map((p, i) => {
    const current = p.collectionIds.map((id) => input.currentNames.get(id)).filter(Boolean).join(", ");
    const description = p.description.replace(/\s+/g, " ").trim().slice(0, 80);
    return `#${i + 1} | ${p.name.replace(/\s+/g, " ").trim()} | ${current || "-"} | ${description || "-"}`;
  });
  const user = [
    `Clasifica cada producto de esta tienda de ${sector} en exactamente UNA de estas colecciones, usando los nombres tal cual: ${options}.`,
    "Si la colección tiene subcolecciones, pon en child la que corresponda (nombre tal cual); si no, child vacío.",
    "Si a un producto no le queda ninguna, pon collection \"Otros productos\" y child vacío. Usa solo esa opción cuando de verdad no encaje.",
    "En productNames devuelve solo los productos cuyo nombre mejora: mayúsculas sostenidas, códigos internos, errores de escritura o tildes que faltan. Conserva marca, medida y cantidad, no agregues datos que no estén, máximo 60 caracteres. Si el nombre ya está bien, no lo incluyas.",
    "Responde con el número de cada producto (n), tal cual aparece.",
    "",
    "Productos (#n | nombre | colecciones actuales | descripción):",
    ...lines,
  ].join("\n");
  const raw = await ask(systemPrompt(sector), user, ASSIGNMENT_OUTPUT_SCHEMA, (r) => assignmentSchema.safeParse(r).data ?? null, 6000);
  if (!raw) return null;
  const byName = new Map(input.collections.map((c) => [c.name.toLowerCase(), c]));
  const assignments: Assignment[] = [];
  const seen = new Set<number>();
  for (const a of raw.assignments) {
    const product = products[a.n - 1];
    if (!product || seen.has(a.n)) continue;
    seen.add(a.n);
    const collection = byName.get(a.collection.trim().toLowerCase());
    const child = collection?.children.find((ch) => ch.toLowerCase() === a.child.trim().toLowerCase()) ?? null;
    assignments.push({ id: product.id, collection: collection?.name ?? "Otros productos", child });
  }
  const productNames: { id: string; name: string }[] = [];
  const named = new Set<number>();
  for (const n of raw.productNames) {
    const product = products[n.n - 1];
    const name = n.name.replace(/\s+/g, " ").trim().slice(0, 255);
    if (!product || named.has(n.n) || name.length < 2 || name === product.name) continue;
    named.add(n.n);
    productNames.push({ id: product.id, name });
  }
  return { assignments, productNames };
}

// ---------------------------------------------------------------------------
// Paso 3: componer la portada
// ---------------------------------------------------------------------------

const HOME_SECTION_TYPES = [
  "BANNER",
  "KEEP",
  "CATEGORY_GRID",
  "CATEGORY_BANNERS",
  "FEATURED_COLLECTION",
  "FEATURED_PRODUCTS",
  "ON_SALE_PRODUCTS",
  "NEW_PRODUCTS",
  "TEXT",
  "SHIPPING_INFO_BANNERS",
  "INSTAGRAM_CTA",
  "PRODUCT_CATALOG",
] as const;

const compositionSchema = z.object({
  sections: z.array(
    z.object({
      type: z.string(),
      keepId: z.string(),
      collections: z.array(z.string()),
      title: z.string(),
      subtitle: z.string(),
      buttonText: z.string(),
      body: z.string(),
    }),
  ),
  announcement: z.string(),
  notes: z.string(),
});

const COMPOSITION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: HOME_SECTION_TYPES },
          keepId: { type: "string" },
          collections: { type: "array", items: { type: "string" } },
          title: { type: "string" },
          subtitle: { type: "string" },
          buttonText: { type: "string" },
          body: { type: "string" },
        },
        required: ["type", "keepId", "collections", "title", "subtitle", "buttonText", "body"],
        additionalProperties: false,
      },
    },
    announcement: { type: "string" },
    notes: { type: "string" },
  },
  required: ["sections", "announcement", "notes"],
  additionalProperties: false,
} as const;

export type ComposeInput = {
  storeName: string;
  sector?: string | null;
  /// El plan ya armado (colecciones en orden de demanda y cifras).
  plan: OrganizerPlan;
  products: OrganizerProduct[];
  /// Lo que la portada tiene hoy (activo), para conservar lo que aporte.
  existingSections: ExistingSectionSummary[];
  instagram: boolean;
  /// Texto de la barra de anuncio actual, o null si no tiene.
  announcement: string | null;
};

/// La línea directiva: qué lleva una portada que convierte y en qué
/// orden. La IA decide con los datos de la tienda qué secciones van, qué
/// se conserva de lo importado y los textos; sanitizeHomeComposition
/// (store-organizer.ts) valida lo que responde.
export const HOME_DIRECTIVE = [
  "Arma la portada con esta línea directiva (una portada que vende):",
  "1. Cabecera, un solo mensaje. Si hay un banner o carrusel importado con fotos, consérvalo con KEEP (su número en keepId). Si no, una sección BANNER de la colección con más demanda que tenga foto (su nombre en collections): title de máximo 40 caracteres que diga qué es, subtitle de máximo 90 que diga qué gana quien compra, buttonText de máximo 25 que empiece con un verbo (\"Ver esmaltes\"). Nunca las dos cosas.",
  "2. Cómo se compra: CATEGORY_GRID con las colecciones principales que tienen foto (de 2 a 6 nombres en collections) o, si solo hay 3 fuertes, CATEGORY_BANNERS con esas 3.",
  "3. Prueba social: FEATURED_PRODUCTS (los más vendidos; el título lo pone el sistema).",
  `4. Ganchos, solo con sustento: ON_SALE_PRODUCTS si hay 3 o más productos con descuento; NEW_PRODUCTS si hay productos nuevos y más de 8 activos; FEATURED_COLLECTION (máximo ${MAX_FEATURED_COLLECTIONS}) para una colección con 4 o más productos que valga la pena mostrar completa, con su nombre en collections y un title.`,
  "5. Lo importado que aporte, en el lugar que le corresponda (KEEP): un video, fotos de marca o banners de categorías sí; un banner repetido, roto o de una promoción vieja no. Un texto importado solo si es un mensaje real de la marca.",
  "6. Confianza: SHIPPING_INFO_BANNERS una vez; un TEXT de bienvenida (title de máximo 60 caracteres y body de 120 a 300: qué vende la tienda y por qué comprar ahí, con los datos de arriba, sin inventar premios, años ni cifras); INSTAGRAM_CTA solo si la tienda tiene Instagram.",
  "7. PRODUCT_CATALOG siempre de último.",
  "Entre 6 y 10 secciones. Cada tipo una sola vez, salvo KEEP y FEATURED_COLLECTION.",
  "Textos en español de Colombia, directos y concretos, sin emojis, sin mayúsculas sostenidas, sin signos de admiración y sin palabras como exclusivo, premium, lujo, increíble o curado. No prometas lo que no esté en los datos: ni envío gratis, ni porcentajes, ni tiempos de entrega.",
  `announcement: si la tienda no tiene barra de anuncio, una frase de máximo ${ANNOUNCEMENT_MAX - 10} caracteres con un dato real de arriba (ofertas, novedades, envíos a todo el país); si ya tiene barra o no hay nada que decir, vacía.`,
  "notes: en una frase de máximo 200 caracteres, por qué la portada quedó así.",
  "Campos que no apliquen: cadena vacía o lista vacía.",
].join("\n");

export async function composeHomeWithClaude(input: ComposeInput): Promise<RawHomeComposition | null> {
  const sector = sectorOf(input.sector);
  const since = Date.now() - RECENT_DAYS * 86_400_000;
  const active = input.products.filter((p) => p.active);
  const recent = active.filter((p) => p.createdAt.getTime() >= since).length;
  const stats = input.plan.stats;
  const activeIds = new Set(active.map((p) => p.id));
  const collections = input.plan.collections.map((c) => {
    const count = c.productIds.filter((id) => activeIds.has(id)).length;
    return `${c.name} | ${count} | ${c.sold} | ${c.imageUrl ? "sí" : "no"} | ${c.description || "-"}`;
  });
  const existing = input.existingSections.map((s, i) => `S${i + 1} | ${s.type} | ${s.label}`);
  const user = [
    `Tienda "${input.storeName}" (${sector}). ${active.length} productos activos (${stats.withSales} con ventas en la tienda, ${stats.discounted} con descuento, ${recent} nuevos en el último mes). Instagram: ${input.instagram ? "sí" : "no"}. Barra de anuncio: ${input.announcement ? `ya tiene una ("${input.announcement}")` : "no tiene"}.`,
    "",
    "Colecciones nuevas, en orden de demanda (nombre | productos activos | vendidos | foto | descripción):",
    ...collections,
    "",
    existing.length > 0
      ? "Secciones que tiene hoy la portada (número | tipo | qué tiene). Se conservan con una sección KEEP y su número en keepId:"
      : "La portada de hoy no tiene nada propio que conservar.",
    ...existing,
    "",
    HOME_DIRECTIVE,
  ].join("\n");
  const system = `Eres quien arma la portada de una tienda en línea colombiana de ${sector} para que convierta visitas en compras. Respondes solo con el JSON pedido.`;
  return ask(system, user, COMPOSITION_OUTPUT_SCHEMA, (r) => compositionSchema.safeParse(r).data ?? null, 3000);
}

// ---------------------------------------------------------------------------
// Paso 4: fichas de producto
// ---------------------------------------------------------------------------

/// Productos por tanda (cada ficha pesa unos 250 tokens de respuesta).
export const DESCRIBE_BATCH_SIZE = 8;
const CURRENT_DESCRIPTION_MAX = 500;

const copySchema = z.object({
  products: z.array(
    z.object({
      n: z.number(),
      keep: z.boolean(),
      summary: z.string(),
      benefits: z.array(z.string()),
      includes: z.string(),
      usage: z.string(),
      specs: z.array(z.string()),
      note: z.string(),
    }),
  ),
});

const COPY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          keep: { type: "boolean" },
          summary: { type: "string" },
          benefits: { type: "array", items: { type: "string" } },
          includes: { type: "string" },
          usage: { type: "string" },
          specs: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
        required: ["n", "keep", "summary", "benefits", "includes", "usage", "specs", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["products"],
  additionalProperties: false,
} as const;

/// La línea directiva de la ficha de producto (la misma filosofía de la
/// portada: concreto, con sustento, sin humo).
export const PRODUCT_DIRECTIVE = [
  "Escribe la ficha de cada producto para que venda, con esta línea directiva:",
  `- summary: una o dos frases (máximo ${COPY_LIMITS.summary - 20} caracteres): qué es y el beneficio principal para quien lo usa.`,
  `- benefits: de 3 a ${COPY_LIMITS.benefits} puntos concretos (máximo ${COPY_LIMITS.benefit - 10} caracteres cada uno): qué resuelve, resultado, duración, facilidad de uso. Nada de adjetivos vacíos.`,
  "- includes: qué trae (cantidad, piezas, contenido en ml o g) si se sabe; si no, vacío.",
  "- usage: cómo se usa en una o dos frases, si aplica; si no, vacío.",
  `- specs: hasta ${COPY_LIMITS.specs} datos técnicos que estén en el nombre, en las variantes o en la descripción actual (contenido, duración, compatibilidad, material); no inventes ninguno.`,
  "- note: un cuidado o advertencia real, si la descripción actual lo trae; si no, vacío.",
  "- keep: true solo si con la información disponible no se puede escribir una ficha honesta (deja lo demás vacío); estos productos no tienen descripción todavía.",
  "Español de Colombia, tratando de tú, directo, sin emojis, sin mayúsculas sostenidas, sin signos de admiración y sin palabras como exclusivo, premium, lujo, increíble o el mejor del mercado. No prometas resultados médicos ni garantías. No inventes marcas, cifras, certificaciones, tiempos de envío ni descuentos.",
  "Responde con el número de cada producto (n), tal cual aparece.",
].join("\n");

export type DescribeInput = {
  products: OrganizerProduct[];
  /// Colección en la que va a quedar cada producto (id → nombre).
  collectionOf: Map<string, string>;
  storeName: string;
  sector?: string | null;
};

export type DescribeResult = Map<string, { keep: boolean; copy: ProductCopy | null }>;

function money(value: number) {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

export async function describeProductsWithClaude(input: DescribeInput): Promise<DescribeResult | null> {
  const sector = sectorOf(input.sector);
  const products = input.products.slice(0, DESCRIBE_BATCH_SIZE);
  const lines = products.map((p, i) => {
    const price = p.compareAtPrice != null && p.compareAtPrice > p.price ? `${money(p.price)} (antes ${money(p.compareAtPrice)})` : money(p.price);
    const variants = p.variantLabels.length > 0 ? p.variantLabels.slice(0, 12).join(", ") : "-";
    const current = p.description.replace(/\s+/g, " ").trim().slice(0, CURRENT_DESCRIPTION_MAX) || "(vacía)";
    return `#${i + 1} | ${p.name.replace(/\s+/g, " ").trim()} | ${price} | ${input.collectionOf.get(p.id) ?? "-"} | ${variants} | ${current}`;
  });
  const user = [
    `Tienda "${input.storeName}" (${sector}).`,
    "",
    PRODUCT_DIRECTIVE,
    "",
    "Productos sin ficha (#n | nombre | precio | colección | variantes | descripción actual, si hay algo):",
    ...lines,
  ].join("\n");
  const system = `Eres quien escribe las fichas de producto de una tienda en línea colombiana de ${sector} para que vendan. Respondes solo con el JSON pedido.`;
  const raw = await ask(system, user, COPY_OUTPUT_SCHEMA, (r) => copySchema.safeParse(r).data ?? null, 6000);
  if (!raw) return null;
  const out: DescribeResult = new Map();
  for (const item of raw.products) {
    const product = products[item.n - 1];
    if (!product || out.has(product.id)) continue;
    out.set(product.id, item.keep ? { keep: true, copy: null } : { keep: false, copy: sanitizeProductCopy(item) });
  }
  return out;
}
