import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/// "Duplicar tienda" → "Desde archivos": para las marcas que no tienen
/// web y venden por WhatsApp con catálogos en PDF, fotos sueltas,
/// pantallazos o listas de precios. Claude lee cada pieza (una página de
/// PDF ya convertida en imagen en el navegador, una foto, o un pedazo de
/// texto) y saca los productos; después, con todo junto, ordena las
/// categorías, une las fotos sueltas con su producto y propone colores.
/// Solo lee: lo que sale entra por el mismo camino que el link de una
/// tienda (importar-shopify, colecciones, diseño). Ver
/// catalog-files-reader.tsx.

export class CatalogFilesError extends Error {}

const AI_TIMEOUT_MS = 55_000;
const MODEL = "claude-opus-5-5";

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const BOX_SCHEMA = {
  type: "object",
  properties: {
    x0: { type: "number" },
    y0: { type: "number" },
    x1: { type: "number" },
    y1: { type: "number" },
  },
  required: ["x0", "y0", "x1", "y1"],
  additionalProperties: false,
} as const;

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["catalog", "product_photo", "logo", "other"] },
    photoCaption: { type: "string" },
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          price: nullable({ type: "number" }),
          compareAtPrice: nullable({ type: "number" }),
          category: { type: "string" },
          sku: { type: "string" },
          weightGrams: nullable({ type: "number" }),
          options: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, values: { type: "array", items: { type: "string" } } },
              required: ["name", "values"],
              additionalProperties: false,
            },
          },
          photoBox: nullable(BOX_SCHEMA),
        },
        required: ["name", "description", "price", "compareAtPrice", "category", "sku", "weightGrams", "options", "photoBox"],
        additionalProperties: false,
      },
    },
    brand: {
      type: "object",
      properties: {
        name: { type: "string" },
        instagram: { type: "string" },
        whatsapp: { type: "string" },
        colors: { type: "array", items: { type: "string" } },
      },
      required: ["name", "instagram", "whatsapp", "colors"],
      additionalProperties: false,
    },
  },
  required: ["kind", "photoCaption", "products", "brand"],
  additionalProperties: false,
} as const;

const boxSchema = z.object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() });

const extractedProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number().nullable(),
  compareAtPrice: z.number().nullable(),
  category: z.string(),
  sku: z.string(),
  weightGrams: z.number().nullable(),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  photoBox: boxSchema.nullable(),
});

const extractSchema = z.object({
  kind: z.enum(["catalog", "product_photo", "logo", "other"]),
  photoCaption: z.string(),
  products: z.array(extractedProductSchema),
  brand: z.object({
    name: z.string(),
    instagram: z.string(),
    whatsapp: z.string(),
    colors: z.array(z.string()),
  }),
});

export type ExtractedProduct = z.infer<typeof extractedProductSchema>;
export type ExtractResult = z.infer<typeof extractSchema>;

export type ExtractInput =
  | { kind: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string; label: string }
  | { kind: "text"; text: string; label: string };

const SYSTEM =
  "Ayudas a armar la tienda en línea de una marca colombiana pequeña que hoy vende por WhatsApp. Lees sus catálogos, fotos, pantallazos y listas de precios y sacas los productos tal como aparecen, sin inventar nada. Respondes solo con el JSON pedido.";

const EXTRACT_INSTRUCTIONS = [
  "Saca los productos que aparecen en este material de la marca.",
  "- kind: \"catalog\" si es una página de catálogo, lista de precios, pantallazo o texto con productos; \"product_photo\" si es una foto de UN producto sin datos (entonces products va vacío y photoCaption describe el producto en pocas palabras: qué es, color, forma, texto visible); \"logo\" si es el logo de la marca; \"other\" si no sirve.",
  "- name: el nombre del producto como lo escribe la marca, con mayúscula inicial. description: el texto que acompaña al producto (beneficios, materiales, medidas), en frases completas; vacío si no hay.",
  "- price: el precio en pesos colombianos como número (\"$35.000\" → 35000; \"35k\" → 35000). compareAtPrice: el precio antes, si aparece tachado o como \"antes\"; si no, null. Si no hay precio, null.",
  "- category: la categoría o sección donde aparece (título de la página o sección del catálogo); si no hay, propón una corta en español.",
  "- options: variantes que se pueden elegir (Talla: S, M, L; Color: Rojo, Azul), máximo 3. Vacío si no hay.",
  "- weightGrams solo si aparece el peso o el contenido en gramos; si no, null. sku: la referencia o código si aparece; si no, vacío.",
  "- photoBox: si es una imagen y el producto tiene su foto en ella, el recuadro de ESA foto en coordenadas de 0 a 1000 (x0,y0 arriba a la izquierda; x1,y1 abajo a la derecha), ajustado a la foto del producto sin el texto. null si no tiene foto o si es texto.",
  "- brand: nombre de la marca, Instagram (sin @), WhatsApp (solo números) y los colores de marca en hexadecimal (#RRGGBB) si se ven; vacío si no.",
  "No repitas un producto dentro de la misma respuesta.",
].join("\n");

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new CatalogFilesError("Falta configurar ANTHROPIC_API_KEY para leer archivos con IA.");
  }
  return new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 1 });
}

async function askJson(content: Anthropic.Beta.BetaContentBlockParam[], schema: Record<string, unknown>, maxTokens: number) {
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new CatalogFilesError("La IA no pudo leer este archivo.");
  if (response.stop_reason === "max_tokens") {
    throw new CatalogFilesError("Este archivo trae demasiados productos para leerlo de una vez: divídelo en partes.");
  }
  const block = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!block) throw new CatalogFilesError("La IA no devolvió resultado para este archivo.");
  return JSON.parse(block.text) as unknown;
}

function clampBox(box: z.infer<typeof boxSchema> | null) {
  if (!box) return null;
  const c = (n: number) => Math.max(0, Math.min(1000, n));
  const x0 = c(Math.min(box.x0, box.x1));
  const x1 = c(Math.max(box.x0, box.x1));
  const y0 = c(Math.min(box.y0, box.y1));
  const y1 = c(Math.max(box.y0, box.y1));
  // Un recuadro diminuto no es una foto usable.
  return x1 - x0 < 30 || y1 - y0 < 30 ? null : { x0, y0, x1, y1 };
}

export async function extractCatalogItems(input: ExtractInput): Promise<ExtractResult> {
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    input.kind === "image"
      ? [
          { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } },
          { type: "text", text: `${EXTRACT_INSTRUCTIONS}\n\nArchivo: ${input.label}` },
        ]
      : [{ type: "text", text: `${EXTRACT_INSTRUCTIONS}\n\nArchivo: ${input.label}\n\n<material>\n${input.text}\n</material>` }];
  const parsed = extractSchema.safeParse(await askJson(content, EXTRACT_SCHEMA, 16000));
  if (!parsed.success) throw new CatalogFilesError("La IA devolvió algo que no pudimos leer. Intenta de nuevo.");
  const result = parsed.data;
  result.products = result.products
    .filter((p) => p.name.trim().length >= 2)
    .map((p) => ({
      ...p,
      name: p.name.trim().slice(0, 255),
      description: p.description.trim().slice(0, 5000),
      category: p.category.trim().slice(0, 80),
      sku: p.sku.trim().slice(0, 120),
      price: p.price != null && p.price > 0 ? p.price : null,
      compareAtPrice: p.compareAtPrice != null && p.compareAtPrice > 0 ? p.compareAtPrice : null,
      weightGrams: p.weightGrams != null && p.weightGrams > 0 ? p.weightGrams : null,
      options: p.options
        .map((o) => ({ name: o.name.trim().slice(0, 40), values: Array.from(new Set(o.values.map((v) => v.trim()).filter(Boolean))).slice(0, 30) }))
        .filter((o) => o.name && o.values.length > 0)
        .slice(0, 3),
      photoBox: input.kind === "image" ? clampBox(p.photoBox) : null,
    }));
  return result;
}

// ---------------------------------------------------------------------------
// Organizar todo junto
// ---------------------------------------------------------------------------

const ORGANIZE_SCHEMA = {
  type: "object",
  properties: {
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" } },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
    photoAssignments: {
      type: "array",
      items: {
        type: "object",
        properties: { photoId: { type: "string" }, productId: { type: "string" } },
        required: ["photoId", "productId"],
        additionalProperties: false,
      },
    },
    storeName: { type: "string" },
    palette: nullable({
      type: "object",
      properties: {
        fondo: { type: "string" },
        texto: { type: "string" },
        botones: { type: "string" },
        principal: { type: "string" },
        secundario: { type: "string" },
      },
      required: ["fondo", "texto", "botones", "principal", "secundario"],
      additionalProperties: false,
    }),
  },
  required: ["categories", "photoAssignments", "storeName", "palette"],
  additionalProperties: false,
} as const;

const organizeSchema = z.object({
  categories: z.array(z.object({ from: z.string(), to: z.string() })),
  photoAssignments: z.array(z.object({ photoId: z.string(), productId: z.string() })),
  storeName: z.string(),
  palette: z
    .object({ fondo: z.string(), texto: z.string(), botones: z.string(), principal: z.string(), secundario: z.string() })
    .nullable(),
});

export type OrganizeInput = {
  products: { id: string; name: string; category: string; price: number | null }[];
  photos: { id: string; caption: string }[];
  brandNames: string[];
  brandColors: string[];
};

export type OrganizeResult = z.infer<typeof organizeSchema>;

const HEX = /^#[0-9a-f]{6}$/i;

export async function organizeCatalog(input: OrganizeInput): Promise<OrganizeResult> {
  const categories = Array.from(new Set(input.products.map((p) => p.category).filter(Boolean)));
  const text = [
    "Termina de organizar el catálogo de esta marca:",
    "1. categories: une las categorías repetidas o casi iguales en un nombre corto y claro (máximo 30 caracteres, en español, sin emojis), entre 2 y 12 categorías en total. Devuelve una fila por cada categoría de la lista con su nombre final (from = tal cual aparece, to = el final).",
    "2. photoAssignments: cada foto suelta, al producto que muestra (usa los ids tal cual). Si una foto no corresponde con seguridad a ningún producto, no la asignes. Varias fotos pueden ir al mismo producto.",
    "3. storeName: el nombre de la marca.",
    "4. palette: colores para la tienda en #RRGGBB a partir de los colores de marca (fondo claro y legible, texto oscuro, botones y principal con el color de marca, secundario suave); null si no hay colores de marca.",
    "",
    `Categorías: ${categories.join(" | ") || "(ninguna)"}`,
    `Nombres de marca vistos: ${input.brandNames.join(" | ") || "(ninguno)"}`,
    `Colores de marca vistos: ${input.brandColors.join(" ") || "(ninguno)"}`,
    "",
    "Productos (id | nombre | categoría | precio):",
    ...input.products.map((p) => `${p.id} | ${p.name} | ${p.category} | ${p.price ?? ""}`),
    "",
    "Fotos sueltas (id | lo que muestra):",
    ...(input.photos.length > 0 ? input.photos.map((p) => `${p.id} | ${p.caption}`) : ["(ninguna)"]),
  ].join("\n");
  const parsed = organizeSchema.safeParse(await askJson([{ type: "text", text }], ORGANIZE_SCHEMA, 12000));
  if (!parsed.success) throw new CatalogFilesError("La IA devolvió algo que no pudimos leer. Intenta de nuevo.");
  const productIds = new Set(input.products.map((p) => p.id));
  const photoIds = new Set(input.photos.map((p) => p.id));
  const result = parsed.data;
  result.photoAssignments = result.photoAssignments.filter((a) => productIds.has(a.productId) && photoIds.has(a.photoId));
  result.categories = result.categories
    .map((c) => ({ from: c.from, to: c.to.trim().slice(0, 80) }))
    .filter((c) => c.to.length >= 2);
  if (result.palette && !Object.values(result.palette).every((v) => HEX.test(v))) result.palette = null;
  result.storeName = result.storeName.trim().slice(0, 120);
  return result;
}
