import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  proposeMergeByRules,
  sanitizeMergeProposal,
  type MergeProposal,
  type MergeSourceCollection,
} from "@/lib/collection-merge";
import {
  OTHER_COLLECTION_NAME,
  proposeCollectionsByRules,
  sanitizeProposal,
  type CategorizeProduct,
  type ProposedCollection,
} from "@/lib/shopify-categorize";

/// Propone las categorías de una tienda que en Shopify no tiene
/// colecciones. Con ANTHROPIC_API_KEY configurada (la misma de "Redactar
/// con IA" del perfil) lo hace Claude, que nombra y agrupa como lo haría
/// una tienda de uñas; si no está o falla, caen las reglas de
/// shopify-categorize.ts. El navegador manda tandas de hasta
/// MAX_PRODUCTS_PER_CALL productos: la primera define las categorías
/// (viendo los nombres de todo el catálogo) y las siguientes solo
/// clasifican con esas mismas categorías. Ver conversación del 2026-10-17.

export const MAX_PRODUCTS_PER_CALL = 150;
const MAX_CATALOG_NAMES = 2000;
const AI_TIMEOUT_MS = 50_000;

/// El rubro de la marca entra al texto de la IA, para que sirva fuera de
/// uñas. Sale del vertical de la marca (BrandProfile.verticalId →
/// Vertical.name); sin vertical, o si es el de uñas, queda el de Marcolini.
const DEFAULT_SECTOR = "productos para uñas";

export function sectorFromVertical(verticalName: string | null | undefined): string {
  const name = verticalName?.replace(/\s+/g, " ").trim();
  if (!name || /u[ñn]as|nail/i.test(name)) return DEFAULT_SECTOR;
  return name.toLowerCase();
}

function sectorOf(sector: string | null | undefined) {
  return sector?.trim() || DEFAULT_SECTOR;
}

function systemPrompt(sector: string) {
  return `Organizas el catálogo de una tienda en línea colombiana de ${sector}${sector === DEFAULT_SECTOR ? " (manicuristas y técnicas de uñas)" : ""}. Respondes solo con el JSON pedido.`;
}

const proposalSchema = z.object({
  categories: z.array(z.object({ name: z.string(), productHandles: z.array(z.string()) })),
});

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          productHandles: { type: "array", items: { type: "string" } },
        },
        required: ["name", "productHandles"],
        additionalProperties: false,
      },
    },
  },
  required: ["categories"],
  additionalProperties: false,
} as const;

export type ProposeInput = {
  products: CategorizeProduct[];
  /// Nombres de todo el catálogo, solo en la primera tanda, para que las
  /// categorías sirvan para todos los productos y no solo para estos.
  catalogNames?: string[];
  /// Categorías ya definidas (tandas siguientes): solo se clasifica.
  categories?: string[];
  /// Rubro de la marca (ver sectorFromVertical).
  sector?: string | null;
};

export type ProposeResult = {
  collections: ProposedCollection[];
  source: "ia" | "reglas";
  method?: "tipo" | "palabras" | "ninguno";
};

export async function proposeCollections(input: ProposeInput): Promise<ProposeResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const collections = await proposeWithClaude(input);
      if (collections) return { collections, source: "ia" };
    } catch (err) {
      console.error("[categorizar] La IA falló, se usan las reglas:", err instanceof Error ? err.message : err);
    }
  }
  const rules = proposeCollectionsByRules(input.products);
  return { collections: rules.collections, source: "reglas", method: rules.method };
}

function productLine(p: CategorizeProduct) {
  const parts = [p.handle, p.name.replace(/\s+/g, " ").trim()];
  if (p.type?.trim()) parts.push(`tipo: ${p.type.trim()}`);
  if (p.tags?.length) parts.push(`etiquetas: ${p.tags.slice(0, 8).join(", ")}`);
  return parts.join(" | ");
}

async function proposeWithClaude(input: ProposeInput): Promise<ProposedCollection[] | null> {
  const sector = sectorOf(input.sector);
  const products = input.products.slice(0, MAX_PRODUCTS_PER_CALL);
  const fixed = (input.categories ?? []).map((c) => c.trim()).filter(Boolean);
  const instructions = fixed.length
    ? `Clasifica cada producto en UNA de estas categorías, usando exactamente estos nombres: ${fixed
        .map((c) => `"${c}"`)
        .join(", ")}. Si a un producto no le queda ninguna, ponlo en "${OTHER_COLLECTION_NAME}".`
    : [
        `Propón entre 3 y 10 categorías para esta tienda, como las usaría una tienda de ${sector} en Colombia${
          sector === DEFAULT_SECTOR ? ' (por ejemplo "Esmaltes semipermanentes", "Soft gel y tips", "Placas de stamping", "Herramientas")' : ""
        }.`,
        "Nombres cortos (máximo 30 caracteres), en español de Colombia, sin emojis y sin la palabra \"categoría\".",
        "Cada producto va en exactamente UNA categoría. No inventes productos ni handles.",
        input.catalogNames?.length
          ? `Para que las categorías sirvan para todo el catálogo, estos son los nombres de todos los productos de la tienda (solo de referencia, no los clasifiques):\n${input.catalogNames
              .slice(0, MAX_CATALOG_NAMES)
              .join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
  const user = `${instructions}\n\nProductos a clasificar (handle | nombre | tipo | etiquetas). Usa los handles tal cual:\n${products
    .map(productLine)
    .join("\n")}`;

  const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt(sector),
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!block) return null;
  const parsed = proposalSchema.safeParse(JSON.parse(block.text));
  if (!parsed.success) return null;
  const clean = sanitizeProposal(parsed.data.categories, products);
  return clean.length > 0 ? clean : null;
}

// ---------------------------------------------------------------------------
// Menos colecciones para una tienda que trae de más (ver collection-merge.ts).
// ---------------------------------------------------------------------------

const mergeSchema = z.object({
  collections: z.array(z.object({ name: z.string(), sourceHandles: z.array(z.string()) })),
});

const MERGE_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    collections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          sourceHandles: { type: "array", items: { type: "string" } },
        },
        required: ["name", "sourceHandles"],
        additionalProperties: false,
      },
    },
  },
  required: ["collections"],
  additionalProperties: false,
} as const;

export type MergeInput = {
  collections: (MergeSourceCollection & { sampleNames?: string[] })[];
  sector?: string | null;
};

/// Propone unir las colecciones que son la misma categoría: con IA si está
/// configurada; si no está o falla, con la regla de collection-merge.ts.
/// null cuando no hay nada que simplificar (o la IA dice que así está bien).
export async function proposeCollectionMerge(input: MergeInput): Promise<MergeProposal | null> {
  if (input.collections.length < 2) return null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await proposeMergeWithClaude(input);
      if (result.ok) return result.proposal;
    } catch (err) {
      console.error("[reorganizar] La IA falló, se usa la regla:", err instanceof Error ? err.message : err);
    }
  }
  return proposeMergeByRules(input.collections);
}

async function proposeMergeWithClaude(
  input: MergeInput,
): Promise<{ ok: true; proposal: MergeProposal | null } | { ok: false }> {
  const sector = sectorOf(input.sector);
  const lines = input.collections.map((c) => {
    const parts = [c.handle, c.name.replace(/\s+/g, " ").trim(), `${c.productHandles.length} productos`];
    if (c.sampleNames?.length) parts.push(`ejemplos: ${c.sampleNames.slice(0, 3).join(", ")}`);
    return parts.join(" | ");
  });
  const user = [
    `Esta tienda de ${sector} tiene ${input.collections.length} colecciones y se va a armar de nuevo en otra plataforma. Revisa si la estructura se puede simplificar:`,
    "- Une en una sola las colecciones que son la misma categoría de producto (por ejemplo, varias colecciones de un mismo tipo de producto separadas por color, tono o tamaño son UNA categoría).",
    "- No unas categorías de productos distintos solo por tener menos colecciones.",
    "- Nombres cortos (máximo 30 caracteres), en español de Colombia, sin emojis y sin el nombre de la tienda. Corrige errores de escritura evidentes y usa mayúscula solo al inicio, salvo en marcas.",
    "- Cada colección original va en exactamente UNA colección nueva, por su handle, y ninguna queda por fuera. No inventes handles.",
    "- Conserva un orden lógico para el menú de la tienda.",
    "Si la estructura ya está bien, devuélvela igual.",
    "",
    "Colecciones (handle | nombre | productos | ejemplos de productos). Usa los handles tal cual:",
    ...lines,
  ].join("\n");

  const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt(sector),
    output_config: { effort: "low", format: { type: "json_schema", schema: MERGE_OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return { ok: false };
  const block = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!block) return { ok: false };
  const parsed = mergeSchema.safeParse(JSON.parse(block.text));
  if (!parsed.success) return { ok: false };
  return { ok: true, proposal: sanitizeMergeProposal(parsed.data.collections, input.collections) };
}
