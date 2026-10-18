import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  extractProfileByRules,
  hasProfileData,
  sanitizeProfile,
  type ExtractedProfile,
} from "@/lib/legal-extract";
import { sectorFromVertical } from "@/server/services/shopify-categorize-service";

/// Datos del perfil de la marca (razón social, NIT, dirección, ciudad,
/// correo, teléfono y una descripción corta) sacados de las políticas y
/// páginas de su tienda anterior. Con ANTHROPIC_API_KEY los lee Claude y
/// redacta la descripción; lo que la IA no encuentre lo buscan las
/// reglas de legal-extract.ts, que también son el respaldo si no hay
/// llave. Solo se usa desde "Duplicar tienda" (admin). Ver conversación
/// del 2026-10-18.

const AI_TIMEOUT_MS = 50_000;
const MAX_TEXT_PER_DOC = 12_000;
const MAX_DOCS = 6;

export type ExtractInput = {
  storeName?: string | null;
  metaDescription?: string | null;
  announcements?: string[];
  categories?: string[];
  texts: { title: string; text: string }[];
  sector?: string | null;
};

export type ExtractResult = { fields: ExtractedProfile; source: "ia" | "reglas" };

const outputSchema = z.object({
  legalName: z.string().nullable(),
  taxId: z.string().nullable(),
  fiscalAddress: z.string().nullable(),
  city: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  description: z.string().nullable(),
});

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    legalName: { type: ["string", "null"] },
    taxId: { type: ["string", "null"] },
    fiscalAddress: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
  },
  required: ["legalName", "taxId", "fiscalAddress", "city", "email", "phone", "description"],
  additionalProperties: false,
} as const;

export { sectorFromVertical };

export async function extractBrandProfile(input: ExtractInput): Promise<ExtractResult> {
  const docs = input.texts.slice(0, MAX_DOCS).map((d) => ({ title: d.title.slice(0, 100), text: d.text.slice(0, MAX_TEXT_PER_DOC) }));
  const rules = extractProfileByRules({ texts: docs.map((d) => d.text), metaDescription: input.metaDescription });
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const ai = await extractWithClaude({ ...input, texts: docs });
      if (ai) {
        // Campo por campo: lo que la IA no encontró lo ponen las reglas.
        const fields = { ...rules };
        for (const key of Object.keys(fields) as (keyof ExtractedProfile)[]) if (ai[key]) fields[key] = ai[key];
        return { fields, source: "ia" };
      }
    } catch (err) {
      console.error("[perfil] La IA falló, se usan las reglas:", err instanceof Error ? err.message : err);
    }
  }
  return { fields: rules, source: "reglas" };
}

async function extractWithClaude(input: ExtractInput): Promise<ExtractedProfile | null> {
  const sector = input.sector?.trim() || "productos para uñas";
  const context = [
    input.storeName ? `Nombre de la tienda: ${input.storeName}` : "",
    input.metaDescription ? `Descripción de la página: ${input.metaDescription}` : "",
    input.announcements?.length ? `Barra de anuncio: ${input.announcements.join(" · ")}` : "",
    input.categories?.length ? `Categorías: ${input.categories.slice(0, 20).join(", ")}` : "",
  ].filter(Boolean);
  const user = [
    `Esta es una tienda colombiana de ${sector} que se está pasando a Marcolini. De sus textos (políticas, términos, contacto) saca los datos de la empresa responsable y escribe una descripción corta de la marca.`,
    "- legalName: la razón social tal cual aparece (con S.A.S., LTDA…), o el nombre completo de la persona natural responsable. null si no está.",
    "- taxId: el NIT con dígito de verificación si aparece (solo números y guion). null si no está.",
    "- fiscalAddress: la dirección física (calle, carrera…) sin ciudad. null si no está.",
    "- city: la ciudad de la empresa. null si no está.",
    "- email y phone: el correo y el teléfono o WhatsApp de contacto de la tienda. null si no están.",
    `- description: una descripción de la marca para su ficha, de máximo 150 caracteres, en español de Colombia, en tercera persona, sin emojis, sin comillas y sin decir "tienda en línea". Escríbela con lo que se vea de la tienda; si no hay nada, null.`,
    "No inventes datos: si algo no aparece en los textos, va null. Responde solo con el JSON pedido.",
    "",
    ...context,
    "",
    ...input.texts.flatMap((d) => [`### ${d.title}`, d.text, ""]),
  ].join("\n");

  const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: "Sacas datos de empresa de los textos legales de una tienda en línea colombiana. Nunca inventas: lo que no está, va null. Respondes solo con el JSON pedido.",
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") return null;
  const block = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!block) return null;
  const parsed = outputSchema.safeParse(JSON.parse(block.text));
  if (!parsed.success) return null;
  const clean = sanitizeProfile(parsed.data);
  return hasProfileData(clean) ? clean : null;
}
