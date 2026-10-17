import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
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
  const products = input.products.slice(0, MAX_PRODUCTS_PER_CALL);
  const fixed = (input.categories ?? []).map((c) => c.trim()).filter(Boolean);
  const instructions = fixed.length
    ? `Clasifica cada producto en UNA de estas categorías, usando exactamente estos nombres: ${fixed
        .map((c) => `"${c}"`)
        .join(", ")}. Si a un producto no le queda ninguna, ponlo en "${OTHER_COLLECTION_NAME}".`
    : [
        "Propón entre 3 y 10 categorías para esta tienda, como las usaría una tienda de productos para uñas en Colombia (por ejemplo \"Esmaltes semipermanentes\", \"Soft gel y tips\", \"Placas de stamping\", \"Herramientas\").",
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
    system:
      "Organizas el catálogo de una tienda en línea colombiana de productos para uñas (manicuristas y técnicas de uñas). Respondes solo con el JSON pedido.",
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
