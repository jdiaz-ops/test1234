import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readProductAttributes } from "@/lib/product-attributes";
import { COLOR_FAMILY_ATTRIBUTE, COLOR_FAMILY_NAMES, NO_COLOR, isColorFamily, withColorFamily, type ColorFamily } from "@/lib/color-families";
import { readImageBytes } from "@/server/services/image-bytes";
import type { FetchLike } from "@/server/services/shopify-store-reader";

/// Familias de color con IA (ver color-families.ts): Claude mira la foto de
/// cada producto, de a lotes de COLOR_BATCH_SIZE, y propone su familia; la
/// marca (o Juan con "Entrar como") la revisa y la guarda en el atributo
/// "Familia de color", que la colección muestra sola como filtro. Las
/// fotos se bajan acá y se mandan chicas (THUMB_SIDE), así una foto pesada
/// o en un formato raro no tumba el lote: ese producto queda sin propuesta.

export class ColorFamilyError extends Error {}

export const COLOR_BATCH_SIZE = 10;
const THUMB_SIDE = 320;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const AI_TIMEOUT_MS = 50_000;

export function colorFamiliesAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ColorCandidate = {
  id: string;
  name: string;
  imageUrl: string | null;
  family: string | null;
  hasVariants: boolean;
  collections: string[];
};

/// Los productos de la tienda (sin borradores), con su familia actual y
/// sus colecciones — para elegir qué analizar.
export async function listColorCandidates(brandId: string): Promise<ColorCandidate[]> {
  const products = await prisma.product.findMany({
    where: { brandId, manual: true, status: { not: "DRAFT" } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      attributes: true,
      hasVariants: true,
      brandCollections: { select: { collection: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.imageUrl,
    family: readProductAttributes(p.attributes)[COLOR_FAMILY_ATTRIBUTE] ?? null,
    hasVariants: p.hasVariants,
    collections: p.brandCollections.map((c) => c.collection.name),
  }));
}

/// La foto en JPEG de THUMB_SIDE px, en base64. Las subidas locales
/// (/uploads/…, en desarrollo) se leen del disco.
async function thumbnail(url: string, fetchImpl: FetchLike): Promise<string | null> {
  try {
    const bytes = await readImageBytes(url, MAX_IMAGE_BYTES, fetchImpl);
    const out = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return out.toString("base64");
  } catch (err) {
    console.error("[familias-color] foto:", err instanceof Error ? err.message : err);
    return null;
  }
}

const FAMILY_HINTS = `- Nudes: beige, piel, arena, durazno muy claro, "milky" o café con leche claro.
- Rosados: del rosa pálido al fucsia, palo de rosa.
- Rojos: rojo, cereza, vino, borgoña.
- Corales y naranjas: coral, salmón, naranja, terracota encendido.
- Amarillos: amarillo, mostaza, dorado mate.
- Verdes: menta, oliva, esmeralda, verde neón.
- Azules: celeste, turquesa, azul rey, azul marino.
- Morados: lila, lavanda, uva, violeta.
- Cafés: chocolate, camel, caramelo, terracota oscuro.
- Grises: gris y plata mate.
- Negros: negro.
- Blancos: blanco, hueso, "milky white".
- Glitter: cuando lo que se ve es sobre todo escarcha, brillos o efecto metálico/espejo, de cualquier color.
- Transparentes: sin color — bases, top coat, brillo, geles transparentes ("clear").
- Multicolor: un kit, set o paleta con varios colores distintos.
- ${NO_COLOR}: el producto no tiene un color propio que elegir (limas, pinceles, lámparas, herramientas, líquidos o cremas de cuidado).`;

const SYSTEM = `Clasificas productos de una tienda de belleza (sobre todo uñas: esmaltes, geles, builder gel, polygel, acrílicos, decoración) por la familia de color del producto, para que las compradoras puedan filtrar por color. Respondes solo con el JSON pedido.`;

function prompt(names: string[]) {
  return `Para cada producto numerado (su nombre y su foto van arriba) elige UNA familia de color de esta lista, mirando el color del producto mismo — el esmalte, el gel, el polvo, la uña pintada o la muestra de color —, no el fondo, el empaque, la tapa ni el texto de la foto. El nombre ayuda ("Cover Pink" es rosado, "Clear" es transparente), pero manda lo que se ve en la foto.

${FAMILY_HINTS}

Responde con un resultado por producto, en el mismo orden: ${names.map((_, i) => i + 1).join(", ")}.`;
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["number", "family"],
        properties: {
          number: { type: "integer" },
          family: { type: "string", enum: [...COLOR_FAMILY_NAMES, NO_COLOR] },
        },
      },
    },
  },
} as const;

const responseSchema = z.object({ results: z.array(z.object({ number: z.number().int(), family: z.string() })) });

export type ColorProposal = { productId: string; family: ColorFamily | null; reason: "ia" | "sin-color" | "sin-foto" | "sin-respuesta" };

/// Propone la familia de hasta COLOR_BATCH_SIZE productos de la marca. Un
/// producto sin foto (o con una foto que no se pudo bajar) vuelve con
/// family null y reason "sin-foto".
export async function proposeColorFamilies(brandId: string, productIds: string[], fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<ColorProposal[]> {
  if (!colorFamiliesAvailable()) throw new ColorFamilyError("La IA no está configurada en este servidor.");
  const ids = Array.from(new Set(productIds)).slice(0, COLOR_BATCH_SIZE);
  const products = await prisma.product.findMany({ where: { brandId, id: { in: ids } }, select: { id: true, name: true, imageUrl: true } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p): p is (typeof products)[number] => Boolean(p));
  const thumbs = await Promise.all(ordered.map((p) => (p.imageUrl ? thumbnail(p.imageUrl, fetchImpl) : Promise.resolve(null))));
  const withPhoto = ordered.map((p, i) => ({ product: p, image: thumbs[i] })).filter((x): x is { product: (typeof products)[number]; image: string } => Boolean(x.image));
  const out = new Map<string, ColorProposal>(ordered.map((p) => [p.id, { productId: p.id, family: null, reason: "sin-foto" }]));
  if (withPhoto.length === 0) return ordered.map((p) => out.get(p.id)!);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  withPhoto.forEach(({ product, image }, i) => {
    content.push({ type: "text", text: `Producto ${i + 1}: ${product.name}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } });
  });
  content.push({ type: "text", text: prompt(withPhoto.map((x) => x.product.name)) });

  const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new ColorFamilyError("La IA no quiso revisar estas fotos.");
  const block = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  const parsed = block ? responseSchema.safeParse(JSON.parse(block.text)) : null;
  for (const { product } of withPhoto) out.set(product.id, { productId: product.id, family: null, reason: "sin-respuesta" });
  if (parsed?.success) {
    for (const r of parsed.data.results) {
      const item = withPhoto[r.number - 1];
      if (!item) continue;
      out.set(item.product.id, {
        productId: item.product.id,
        family: isColorFamily(r.family) ? r.family : null,
        reason: isColorFamily(r.family) ? "ia" : "sin-color",
      });
    }
  }
  return ordered.map((p) => out.get(p.id)!);
}

export const colorAssignmentsSchema = z
  .array(z.object({ productId: z.string().min(1).max(40), family: z.enum(COLOR_FAMILY_NAMES as [ColorFamily, ...ColorFamily[]]).nullable() }))
  .min(1)
  .max(1000);

/// Guarda las familias revisadas (null = quitarla), sin tocar los demás
/// atributos del producto. Solo productos de la marca.
export async function applyColorFamilies(brandId: string, assignments: z.infer<typeof colorAssignmentsSchema>) {
  const ids = assignments.map((a) => a.productId);
  const products = await prisma.product.findMany({ where: { brandId, id: { in: ids } }, select: { id: true, attributes: true } });
  const byId = new Map(products.map((p) => [p.id, readProductAttributes(p.attributes)]));
  let saved = 0;
  let removed = 0;
  for (const a of assignments) {
    const before = byId.get(a.productId);
    if (!before) continue;
    const after = withColorFamily(before, a.family);
    if (JSON.stringify(after) === JSON.stringify(before)) continue;
    await prisma.product.update({ where: { id: a.productId }, data: { attributes: after } });
    if (a.family) saved++;
    else removed++;
  }
  return { saved, removed };
}
