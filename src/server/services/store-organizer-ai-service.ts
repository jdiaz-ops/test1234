import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  MAX_MAIN_COLLECTIONS,
  proposeStructureByRules,
  sanitizeStructure,
  type OrganizerCollection,
  type OrganizerProduct,
  type StructureProposal,
} from "@/lib/store-organizer";
import { sectorFromVertical } from "@/server/services/shopify-categorize-service";

/// La estructura del catálogo con Claude: qué colecciones debería tener
/// la tienda (pocas y claras), cómo se llaman, qué producto va en cada
/// una, subcolecciones donde haya volumen, y nombres de producto mejores
/// (tildes, mayúsculas sostenidas, códigos). Con la llave configurada lo
/// hace la IA; si no está o falla, caen las reglas de store-organizer.ts.
/// Un catálogo grande va en dos pasos: primero se definen las colecciones
/// viendo todos los nombres, después se clasifica por tandas con esos
/// nombres fijos. Ver conversación del 2026-10-19.

const AI_TIMEOUT_MS = 50_000;
/// Hasta cuántos productos entran en una sola llamada (con ids).
export const MAX_PRODUCTS_PER_CALL = 350;
const BATCH_SIZE = 250;
const MAX_CATALOG_NAMES = 2000;

export type StructureInput = {
  products: OrganizerProduct[];
  collections: OrganizerCollection[];
  storeName: string;
  sector?: string | null;
};

export type StructureResult = { proposal: StructureProposal; source: "ia" | "reglas" };

export { sectorFromVertical };

export async function proposeStructure(input: StructureInput): Promise<StructureResult> {
  if (process.env.ANTHROPIC_API_KEY && input.products.length > 0) {
    try {
      const proposal = await proposeWithClaude(input);
      if (proposal && proposal.collections.length > 0) return { proposal, source: "ia" };
    } catch (err) {
      console.error("[organizador] La IA falló, se usan las reglas:", err instanceof Error ? err.message : err);
    }
  }
  return { proposal: proposeStructureByRules(input.products, input.collections), source: "reglas" };
}

function sectorOf(sector: string | null | undefined) {
  return sector?.trim() || "productos para uñas";
}

function systemPrompt(sector: string) {
  return `Eres quien organiza el catálogo de una tienda en línea colombiana de ${sector} para que venda más: pocas categorías claras, nombres cortos y productos bien ubicados. Respondes solo con el JSON pedido.`;
}

const STRUCTURE_RULES = [
  `Propón entre 5 y ${MAX_MAIN_COLLECTIONS} colecciones principales, como las usaría una tienda que vende bien de este rubro: por tipo de producto o por uso, no por color, tono, aroma ni tamaño (esas variantes van juntas dentro de la misma colección).`,
  "Nombres de colección cortos (máximo 30 caracteres), en español de Colombia, con mayúscula solo al inicio y en marcas, sin emojis, sin la palabra \"colección\" y sin el nombre de la tienda.",
  "Una descripción de una línea por colección (máximo 120 caracteres) que invite a comprar, sin emojis ni mayúsculas sostenidas.",
  "Cada producto va en exactamente UNA colección principal. No inventes productos ni ids; usa los ids tal cual.",
  "Si una colección principal queda con más de 20 productos y se parte de forma natural (por ejemplo Semipermanente → Colores, Bases y tops, Lámparas), propón subcolecciones (children) con 2 o más productos cada una; si no, children vacío.",
  "Usa \"Otros productos\" solo para lo que de verdad no encaja en ninguna, y solo si hace falta.",
  "En productNames devuelve solo los productos cuyo nombre mejora: mayúsculas sostenidas, códigos internos, errores de escritura o tildes que faltan. Conserva marca, medida y cantidad, no agregues datos que no estén, máximo 60 caracteres. Si el nombre ya está bien, no lo incluyas.",
];

const structureSchema = z.object({
  collections: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      productIds: z.array(z.string()),
      children: z.array(z.object({ name: z.string(), productIds: z.array(z.string()) })),
    }),
  ),
  productNames: z.array(z.object({ id: z.string(), name: z.string() })),
});

const STRUCTURE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          productIds: { type: "array", items: { type: "string" } },
          children: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, productIds: { type: "array", items: { type: "string" } } },
              required: ["name", "productIds"],
              additionalProperties: false,
            },
          },
        },
        required: ["name", "description", "productIds", "children"],
        additionalProperties: false,
      },
    },
    productNames: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
        required: ["id", "name"],
        additionalProperties: false,
      },
    },
  },
  required: ["collections", "productNames"],
  additionalProperties: false,
} as const;

/// Solo las colecciones (paso 1 de un catálogo grande).
const definitionSchema = z.object({
  collections: z.array(z.object({ name: z.string(), description: z.string() })),
});

const DEFINITION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, description: { type: "string" } },
        required: ["name", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["collections"],
  additionalProperties: false,
} as const;

/// Clasificación por tandas con colecciones fijas (paso 2).
const assignmentSchema = z.object({
  assignments: z.array(z.object({ id: z.string(), collection: z.string() })),
  productNames: z.array(z.object({ id: z.string(), name: z.string() })),
});

const ASSIGNMENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, collection: { type: "string" } },
        required: ["id", "collection"],
        additionalProperties: false,
      },
    },
    productNames: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
        required: ["id", "name"],
        additionalProperties: false,
      },
    },
  },
  required: ["assignments", "productNames"],
  additionalProperties: false,
} as const;

function productLine(p: OrganizerProduct, collectionNames: Map<string, string>) {
  const current = p.collectionIds.map((id) => collectionNames.get(id)).filter(Boolean).join(", ");
  const description = p.description.replace(/\s+/g, " ").trim().slice(0, 80);
  return [p.id, p.name.replace(/\s+/g, " ").trim(), current || "-", description || "-"].join(" | ");
}

function currentCollectionsText(input: StructureInput) {
  if (input.collections.length === 0) return "La tienda no tiene colecciones todavía.";
  return `Colecciones actuales (nombre | productos), solo de referencia — se pueden conservar, unir, renombrar o quitar:\n${input.collections
    .map((c) => `${c.name.replace(/\s+/g, " ").trim()} | ${c.productIds.length}`)
    .join("\n")}`;
}

async function ask<T>(system: string, user: string, schema: Record<string, unknown>, parse: (raw: unknown) => T | null, maxTokens: number): Promise<T | null> {
  const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
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

async function proposeWithClaude(input: StructureInput): Promise<StructureProposal | null> {
  const sector = sectorOf(input.sector);
  const system = systemPrompt(sector);
  const collectionNames = new Map(input.collections.map((c) => [c.id, c.name]));
  const intro = `La tienda "${input.storeName}" (${sector}) tiene ${input.products.length} productos y se va a organizar de nuevo. ${currentCollectionsText(input)}`;

  if (input.products.length <= MAX_PRODUCTS_PER_CALL) {
    const user = [
      intro,
      "",
      ...STRUCTURE_RULES,
      "",
      "Productos (id | nombre | colecciones actuales | descripción). Usa los ids tal cual:",
      ...input.products.map((p) => productLine(p, collectionNames)),
    ].join("\n");
    const raw = await ask(system, user, STRUCTURE_OUTPUT_SCHEMA, (r) => structureSchema.safeParse(r).data ?? null, 16000);
    return raw ? sanitizeStructure(raw, input.products) : null;
  }

  // Catálogo grande: primero las colecciones viendo todos los nombres…
  const names = input.products.slice(0, MAX_CATALOG_NAMES).map((p) => p.name.replace(/\s+/g, " ").trim());
  const defineUser = [
    intro,
    "",
    STRUCTURE_RULES[0],
    STRUCTURE_RULES[1],
    STRUCTURE_RULES[2],
    "Solo define las colecciones (nombre y descripción); los productos se clasifican después.",
    "",
    "Nombres de todos los productos:",
    ...names,
  ].join("\n");
  const defined = await ask(system, defineUser, DEFINITION_OUTPUT_SCHEMA, (r) => definitionSchema.safeParse(r).data ?? null, 4000);
  const fixed = (defined?.collections ?? []).map((c) => ({ name: c.name.trim().slice(0, 40), description: c.description.trim().slice(0, 160) })).filter((c) => c.name.length >= 2);
  if (fixed.length < 2) return null;

  // …y después cada tanda se clasifica con esos nombres fijos.
  const assignments = new Map<string, string>();
  const productNames: { id: string; name: string }[] = [];
  for (let i = 0; i < input.products.length; i += BATCH_SIZE) {
    const batch = input.products.slice(i, i + BATCH_SIZE);
    const user = [
      `Clasifica cada producto en UNA de estas colecciones, usando exactamente estos nombres: ${fixed.map((c) => `"${c.name}"`).join(", ")}. Si a un producto no le queda ninguna, ponlo en "Otros productos".`,
      STRUCTURE_RULES[6],
      "No inventes ids; usa los ids tal cual.",
      "",
      "Productos (id | nombre | colecciones actuales | descripción):",
      ...batch.map((p) => productLine(p, collectionNames)),
    ].join("\n");
    const result = await ask(system, user, ASSIGNMENT_OUTPUT_SCHEMA, (r) => assignmentSchema.safeParse(r).data ?? null, 12000);
    if (!result) return null;
    for (const a of result.assignments) if (!assignments.has(a.id)) assignments.set(a.id, a.collection.trim());
    productNames.push(...result.productNames);
  }
  const byName = new Map<string, { name: string; description: string; productIds: string[] }>();
  for (const c of fixed) byName.set(c.name.toLowerCase(), { ...c, productIds: [] });
  for (const [id, name] of assignments) {
    const target = byName.get(name.toLowerCase()) ?? byName.get("otros productos") ?? (() => {
      const other = { name: "Otros productos", description: "", productIds: [] as string[] };
      byName.set("otros productos", other);
      return other;
    })();
    target.productIds.push(id);
  }
  return sanitizeStructure({ collections: Array.from(byName.values()), productNames }, input.products);
}
