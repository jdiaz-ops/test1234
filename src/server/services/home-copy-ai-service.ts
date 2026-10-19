import Anthropic from "@anthropic-ai/sdk";
import { HOME_COPY_OUTPUT_SCHEMA, homeCopyResponseSchema, homeCopyToSections, outlineForPrompt } from "@/lib/home-copy";
import type { HomeOutline, ShopifyHomeSection } from "@/lib/shopify-theme";

/// La copia fiel de la portada con Claude (ver home-copy.ts): la IA mira
/// el esquema de la portada original y dice qué sección de Marcolini arma
/// cada bloque, citando ids — nunca escribe un texto. Una sola llamada: el
/// esquema de una portada entra entero (ver OUTLINE_MAX_ITEMS). Sin llave,
/// o si la respuesta no sirve, null y quien llama sigue con las reglas.

const AI_TIMEOUT_MS = 110_000;

export function homeCopyAvailable() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `Copias la página de inicio de una tienda en línea a Marcolini (una plataforma de tiendas) igual a como está en la tienda original: las mismas secciones, en el mismo orden, con sus fotos, textos, botones y links. No escribes, no corriges ni inventas ningún texto: solo eliges qué sección de Marcolini reproduce cada bloque y citas los ids del esquema que van en ella. Respondes solo con el JSON pedido.`;

function userPrompt(outline: HomeOutline, storeName: string | null) {
  return `Tienda: ${storeName?.trim() || "sin nombre"}

Este es el esquema de la portada original, de arriba abajo. Cada línea es un elemento con su id: BLOQUE (S…) es donde empieza una sección de la página; título (H…), texto (T…), foto (I…: "ancha", "cuadrada", "alta", o "pequeña" si es un ícono o un logo), botón (L…), productos (P…: una lista o carrusel de productos) y video (V…). "→" es a dónde lleva: /collections/… es una categoría, /products/… un producto, /pages/… una página.

${outlineForPrompt(outline)}

Arma la portada en Marcolini igual a la original:
- Recorre los bloques en orden. Cada bloque suele ser una sección; si un bloque trae cosas distintas (un título con productos y debajo un banner), van en varias secciones seguidas.
- Cita los ids exactos y cada id una sola vez. No inventes: lo que no está en el esquema no va. Lo que no aplique va vacío ("" o []).
- Usa la sección que reproduce lo que muestra cada bloque:
  · BANNER: una o varias fotos grandes a lo ancho (un slideshow o un banner con foto), con el título, texto y botón que lleva (en un slideshow, los del primer slide).
  · IMAGE_CAROUSEL: fotos a lo ancho sin texto ni links.
  · PROMO_BANNERS: dos o tres fotos lado a lado, cada una con su link (en items).
  · CATEGORY_GRID: categorías en cuadrícula (hasta 6), cada una con su foto y su nombre, con links a /collections/… (en items).
  · CATEGORY_BANNERS: dos o tres categorías en banners grandes con foto (en items).
  · FEATURED_COLLECTION: los productos de una categoría con un link a esa categoría (cítalo en button) y su título.
  · FEATURED_PRODUCTS: una lista de productos (cita el P… en products) con su título.
  · NEW_PRODUCTS, ON_SALE_PRODUCTS o PRODUCT_CATALOG: solo si el bloque es de novedades, de ofertas o de todos los productos y no hay una lista P… para citar.
  · VIDEO: un video (cita el V…) con su título.
  · BRAND_CAROUSEL: una tira de logos (en items o images).
  · INFO_COLUMNS: hasta 4 sellos cortos (envíos, pagos, garantía…) con ícono o foto pequeña (en items).
  · TEXT: un título con párrafos, sin botón.
  · INSTAGRAM_CTA: un bloque que invita a seguir la cuenta de Instagram.
  · CUSTOM_BLOCK: todo lo que no calce exacto en las anteriores, con su layout:
      text = título, textos y botón (por ejemplo sobre un color de fondo);
      image-text = una foto al lado de un título, textos y botón (la foto en images);
      cards = tarjetas o columnas, cada una con su foto, título, textos y link (en items); también una cuadrícula de fotos con links;
      accordion = preguntas frecuentes (la pregunta en title y la respuesta en text de cada item);
      quotes = testimonios (el testimonio en text, el nombre en title y la foto en image de cada item).
    En name pon un nombre corto en español para que la marca lo reconozca en el editor ("Testimonios", "Nuestra historia").
- items: una entrada por tarjeta, categoría, logo o pregunta, con su foto (image), su título (title), sus textos (text) y su link (link: el botón o link de esa tarjeta).
- layout va solo en CUSTOM_BLOCK; en las demás, "".
- Omite lo que no es contenido de la portada: avisos de cookies, formularios, buscadores y textos sueltos de controles.`;
}

export async function copyHomeWithClaude(outline: HomeOutline, storeName: string | null): Promise<ShopifyHomeSection[] | null> {
  if (!homeCopyAvailable() || outline.items.length === 0) return null;
  const client = new Anthropic({ timeout: AI_TIMEOUT_MS, maxRetries: 0 });
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16_000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: HOME_COPY_OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: userPrompt(outline, storeName) }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  const block = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  if (!block) return null;
  const parsed = homeCopyResponseSchema.safeParse(JSON.parse(block.text));
  if (!parsed.success) return null;
  return homeCopyToSections(outline, parsed.data);
}
