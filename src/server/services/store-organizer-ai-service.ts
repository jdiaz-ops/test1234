import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { MAX_MAIN_COLLECTIONS, type OrganizerCollection, type OrganizerProduct } from "@/lib/store-organizer";
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
