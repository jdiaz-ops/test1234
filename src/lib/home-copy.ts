import { z } from "zod";
import { CUSTOM_BLOCK_LAYOUTS, type CustomBlockLayout } from "@/lib/storefront-sections";
import { MAX_HOME_SECTIONS, type HomeOutline, type HomeOutlineItem, type ShopifyHomeSection } from "@/lib/shopify-theme";

/// Copia fiel de la portada con IA (pedido del 2026-10-19: "que la IA se
/// dedique a hacer una copia fiel de la tienda original, con sus
/// secciones, imágenes, textos iguales"). La IA recibe el esquema de la
/// portada original (ver buildHomeOutline en shopify-theme.ts) y responde,
/// bloque por bloque y en el mismo orden, qué sección de Marcolini lo
/// reproduce citando los ids del esquema — nunca escribe un texto. Acá se
/// valida esa respuesta y se arma con los textos, fotos y links tal cual
/// estaban: un id que no existe, que no es del tipo pedido o que ya se usó
/// se ignora, y las secciones quedan en el orden de la página original
/// aunque la IA las haya devuelto en otro. Lo que no calza en ninguna
/// sección de acá sale como "Bloque personalizado" (CUSTOM_BLOCK), con los
/// colores de su bloque ("si la sección no existe, que la cree la IA y la
/// agregue al editor").

export const HOME_COPY_TYPES = [
  "BANNER",
  "IMAGE_CAROUSEL",
  "PROMO_BANNERS",
  "CATEGORY_GRID",
  "CATEGORY_BANNERS",
  "FEATURED_COLLECTION",
  "FEATURED_PRODUCTS",
  "NEW_PRODUCTS",
  "ON_SALE_PRODUCTS",
  "PRODUCT_CATALOG",
  "VIDEO",
  "BRAND_CAROUSEL",
  "INFO_COLUMNS",
  "TEXT",
  "INSTAGRAM_CTA",
  "CUSTOM_BLOCK",
] as const;

const copyItemSchema = z.object({
  image: z.string(),
  title: z.string(),
  text: z.array(z.string()),
  link: z.string(),
});

const copySectionSchema = z.object({
  type: z.enum(HOME_COPY_TYPES),
  layout: z.union([z.literal(""), z.enum(CUSTOM_BLOCK_LAYOUTS)]),
  name: z.string(),
  title: z.string(),
  text: z.array(z.string()),
  button: z.string(),
  images: z.array(z.string()),
  products: z.string(),
  video: z.string(),
  items: z.array(copyItemSchema),
});

export const homeCopyResponseSchema = z.object({ sections: z.array(copySectionSchema) });
export type HomeCopyResponse = z.infer<typeof homeCopyResponseSchema>;

const ID = { type: "string" } as const;
const ID_LIST = { type: "array", items: ID } as const;

/// El mismo shape en JSON Schema, para la respuesta estructurada de Claude.
export const HOME_COPY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...HOME_COPY_TYPES] },
          layout: { type: "string", enum: ["", ...CUSTOM_BLOCK_LAYOUTS] },
          name: { type: "string" },
          title: ID,
          text: ID_LIST,
          button: ID,
          images: ID_LIST,
          products: ID,
          video: ID,
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { image: ID, title: ID, text: ID_LIST, link: ID },
              required: ["image", "title", "text", "link"],
              additionalProperties: false,
            },
          },
        },
        required: ["type", "layout", "name", "title", "text", "button", "images", "products", "video", "items"],
        additionalProperties: false,
      },
    },
  },
  required: ["sections"],
  additionalProperties: false,
} as const;

/// El esquema como lo lee la IA: una línea por elemento, sin las URLs de
/// las fotos (no le hacen falta y son largas).
export function outlineForPrompt(outline: HomeOutline): string {
  const lines = outline.items.map((item) => {
    const link = (href: string) => (href ? ` → ${href}` : "");
    switch (item.kind) {
      case "section":
        return `\n${item.id} BLOQUE «${item.hint}»${item.background ? ` (fondo ${item.background})` : ""}`;
      case "heading":
        return `${item.id} título h${item.level}: «${item.text}»${link(item.href)}`;
      case "text":
        return `${item.id} texto: «${item.text.replace(/\n+/g, " / ")}»${link(item.href)}`;
      case "image":
        return `${item.id} foto${item.shape ? ` ${item.shape}` : ""}${item.alt ? ` «${item.alt}»` : ""}${link(item.href)}`;
      case "link":
        return `${item.id} botón «${item.text}»${link(item.href)}`;
      case "products":
        return `${item.id} productos: ${item.handles.length} (${item.handles.slice(0, 3).join(", ")}${item.handles.length > 3 ? "…" : ""})`;
      case "video":
        return `${item.id} video`;
    }
  });
  return lines.join("\n").trim() + (outline.truncated ? "\n(la página sigue, pero el esquema se cortó acá)" : "");
}

type OutlineOf<K extends HomeOutlineItem["kind"]> = Extract<HomeOutlineItem, { kind: K }>;
type Block = OutlineOf<"section">;
type TextLike = OutlineOf<"heading" | "text" | "link">;
type Colors = { background: string | null; textColor: string | null };

/// Una tarjeta ya armada con lo que citó la IA.
type CardRead = { imageUrl: string | null; title: string; text: string; buttonText: string; href: string; shape: string | null };

const TEXT_KINDS = ["heading", "text", "link"] as const;
const BODY_KINDS = ["text", "heading"] as const;

function hrefOf(item: HomeOutlineItem | null): string {
  return item && "href" in item ? item.href : "";
}

/// El handle de la colección de un link en la forma de Shopify
/// ("/collections/anillos"); "todos los productos" no cuenta.
export function collectionHandleOf(href: string): string | null {
  const match = href.match(/^\/collections\/([^/?#]+)/i);
  if (!match) return null;
  const handle = decodeURIComponent(match[1]).toLowerCase();
  return handle === "all" ? null : handle;
}

function cardColumns(count: number) {
  if (count <= 5) return Math.max(1, count);
  return count % 3 === 0 ? 3 : 4;
}

function customBlock(
  layout: CustomBlockLayout,
  name: string,
  header: { title: string; text: string; button: OutlineOf<"link"> | null },
  colors: Colors,
  cards: CardRead[],
  image: { url: string; right: boolean } | null = null,
): ShopifyHomeSection {
  return {
    type: "CUSTOM_BLOCK",
    name: name.slice(0, 60),
    layout,
    title: header.title,
    text: header.text,
    buttonText: header.button?.text ?? "",
    buttonHref: header.button?.href ?? "",
    imageUrl: image?.url ?? null,
    imagePosition: image?.right ? "right" : "left",
    columns: cardColumns(cards.length),
    align: "center",
    background: colors.background,
    textColor: colors.textColor,
    items: cards.slice(0, 12).map((c) => ({ imageUrl: c.imageUrl, title: c.title, text: c.text, buttonText: c.buttonText, link: c.href })),
  };
}

/// Título, textos y botón de un bloque que va en una sección que no los
/// muestra (una tira de logos, banners de categoría): van en un bloque de
/// texto justo antes, para no perderlos.
function headerSection(title: string, text: string, button: OutlineOf<"link"> | null, colors: Colors, name: string): ShopifyHomeSection | null {
  if (!title && !text && !button) return null;
  if (!button && !colors.background && title.length <= 120 && text.length <= 2000) return { type: "TEXT", heading: title, body: text };
  return customBlock("text", name, { title, text, button }, colors, []);
}

/// Arma las secciones de la portada con la respuesta de la IA (ver arriba).
/// Vacío si no salió nada que valga: quien llama usa las reglas.
export function homeCopyToSections(outline: HomeOutline, plan: HomeCopyResponse): ShopifyHomeSection[] {
  const byId = new Map(outline.items.map((item, index) => [item.id.toUpperCase(), { item, index }]));
  const blockOf = new Map<string, Block>();
  let current: Block | null = null;
  for (const item of outline.items) {
    if (item.kind === "section") current = item;
    else if (current) blockOf.set(item.id, current);
  }
  const indexOf = (item: HomeOutlineItem | null) => (item ? (byId.get(item.id.toUpperCase())?.index ?? Infinity) : Infinity);
  const used = new Set<string>();
  const built: { at: number; section: ShopifyHomeSection }[] = [];

  for (const raw of plan.sections) {
    const ctx = { at: Infinity, block: null as Block | null, taken: [] as string[] };
    const pick = <K extends HomeOutlineItem["kind"]>(id: string, kinds: readonly K[]): OutlineOf<K> | null => {
      const key = id.trim().toUpperCase();
      if (!key || used.has(key)) return null;
      const found = byId.get(key);
      if (!found || !(kinds as readonly string[]).includes(found.item.kind)) return null;
      used.add(key);
      ctx.taken.push(key);
      if (found.index < ctx.at) {
        ctx.at = found.index;
        ctx.block = blockOf.get(found.item.id) ?? null;
      }
      return found.item as OutlineOf<K>;
    };

    const title = pick(raw.title, TEXT_KINDS) as TextLike | null;
    const texts = raw.text.map((id) => pick(id, BODY_KINDS)).filter((t): t is OutlineOf<"text" | "heading"> => t !== null);
    const button = pick(raw.button, ["link"] as const);
    const images = raw.images.map((id) => pick(id, ["image"] as const)).filter((i): i is OutlineOf<"image"> => i !== null);
    const products = pick(raw.products, ["products"] as const);
    const video = pick(raw.video, ["video"] as const);
    const cards: CardRead[] = raw.items
      .map((it) => {
        const image = pick(it.image, ["image"] as const);
        const cardTitle = pick(it.title, TEXT_KINDS) as TextLike | null;
        const cardTexts = it.text.map((id) => pick(id, BODY_KINDS)).filter((t): t is OutlineOf<"text" | "heading"> => t !== null);
        const cardLink = pick(it.link, ["link", "image", "heading", "text"] as const);
        const href = hrefOf(cardLink) || hrefOf(cardTitle) || (image?.href ?? "") || cardTexts.map(hrefOf).find(Boolean) || "";
        return {
          imageUrl: image?.url ?? null,
          title: cardTitle?.text ?? "",
          text: cardTexts.map((t) => t.text).join("\n\n"),
          buttonText: cardLink?.kind === "link" && cardLink.text !== cardTitle?.text ? cardLink.text : "",
          href,
          shape: image?.shape ?? null,
        };
      })
      .filter((c) => c.imageUrl || c.title || c.text);

    const colors: Colors = { background: ctx.block?.background ?? null, textColor: ctx.block?.textColor ?? null };
    const titleText = title?.text ?? "";
    const body = texts.map((t) => t.text).join("\n\n");
    const name = raw.name.trim() || ctx.block?.hint || "";
    const pictures: CardRead[] = images.map((i) => ({ imageUrl: i.url, title: "", text: "", buttonText: "", href: i.href, shape: i.shape }));
    const withImages = cards.filter((c) => c.imageUrl);
    const out: ShopifyHomeSection[] = [];
    const header = () => {
      const section = headerSection(titleText, body, button, colors, name);
      if (section) out.push(section);
    };
    const textBlock = () => {
      if (!titleText && !body && !button && cards.length === 0) return;
      if (cards.length > 0) out.push(customBlock("cards", name, { title: titleText, text: body, button }, colors, cards));
      else header();
    };

    switch (raw.type) {
      case "BANNER":
      case "IMAGE_CAROUSEL": {
        const slides = pictures.length > 0 ? pictures : withImages;
        if (slides.length === 0) {
          textBlock();
          break;
        }
        // Fotos sin texto ni links: galería. Con links o texto: banner.
        if (raw.type === "IMAGE_CAROUSEL" && !slides.some((s) => s.href) && !titleText && !body && !button) {
          out.push({ type: "IMAGE_CAROUSEL", images: slides.slice(0, 8).map((s) => s.imageUrl!) });
          break;
        }
        out.push({
          type: "BANNER",
          images: slides.slice(0, 6).map((s) => s.imageUrl!),
          links: slides.slice(0, 6).map((s) => s.href),
          title: titleText,
          subtitle: texts.map((t) => t.text).join(" "),
          buttonText: button?.text ?? "",
          buttonHref: button?.href ?? "",
        });
        break;
      }
      case "PROMO_BANNERS": {
        const promos = withImages.length > 0 ? withImages : pictures;
        if (promos.length === 0) {
          textBlock();
          break;
        }
        if (promos.length <= 3 && !promos.some((p) => p.title || p.text)) {
          header();
          out.push({ type: "PROMO_BANNERS", items: promos.map((p) => ({ imageUrl: p.imageUrl!, link: p.href })) });
        } else {
          out.push(customBlock("cards", name, { title: titleText, text: body, button }, colors, promos));
        }
        break;
      }
      case "CATEGORY_GRID":
      case "CATEGORY_BANNERS": {
        const list = cards.length > 0 ? cards : pictures;
        if (list.length === 0) {
          textBlock();
          break;
        }
        const max = raw.type === "CATEGORY_GRID" ? 6 : 3;
        const categories = list.map((c) => ({ card: c, handle: collectionHandleOf(c.href) }));
        // Todas son categorías de la tienda: la sección de categorías. Si
        // alguna lleva a otra parte, un bloque de tarjetas con sus links.
        if (categories.every((c) => c.handle) && categories.length <= max) {
          const items = categories.map((c) => ({ collectionHandle: c.handle!, imageUrl: c.card.imageUrl, label: c.card.title.slice(0, 80) }));
          if (raw.type === "CATEGORY_GRID") {
            out.push({ type: "CATEGORY_GRID", title: titleText, subtitle: body, items });
          } else {
            header();
            out.push({ type: "CATEGORY_BANNERS", items });
          }
        } else {
          out.push(customBlock("cards", name, { title: titleText, text: body, button }, colors, list));
        }
        break;
      }
      case "FEATURED_COLLECTION":
      case "FEATURED_PRODUCTS":
      case "NEW_PRODUCTS":
      case "ON_SALE_PRODUCTS":
      case "PRODUCT_CATALOG": {
        const handle = collectionHandleOf(button?.href ?? "") ?? collectionHandleOf(hrefOf(title));
        // Un párrafo arriba de la lista va en su propio bloque de texto.
        const lead = body ? headerSection("", body, null, colors, name) : null;
        if (lead) out.push(lead);
        if (raw.type === "FEATURED_COLLECTION" && handle) {
          out.push({ type: "FEATURED_COLLECTION", collectionHandle: handle, title: titleText });
        } else if ((raw.type === "FEATURED_PRODUCTS" || raw.type === "FEATURED_COLLECTION") && products) {
          out.push({ type: "FEATURED_PRODUCTS", productHandles: products.handles.slice(0, 24), title: titleText });
        } else if (raw.type === "FEATURED_PRODUCTS" && handle) {
          out.push({ type: "FEATURED_COLLECTION", collectionHandle: handle, title: titleText });
        } else if (raw.type === "NEW_PRODUCTS" || raw.type === "ON_SALE_PRODUCTS" || raw.type === "PRODUCT_CATALOG") {
          // Se arman solas: valen si la original mostraba algo ahí.
          if (title || products) out.push({ type: raw.type, title: titleText });
        }
        break;
      }
      case "VIDEO":
        if (video) out.push({ type: "VIDEO", url: video.url, title: titleText });
        else textBlock();
        break;
      case "BRAND_CAROUSEL": {
        const logos = withImages.length > 0 ? withImages : pictures;
        if (logos.length === 0) break;
        header();
        out.push({ type: "BRAND_CAROUSEL", items: logos.slice(0, 12).map((l) => ({ imageUrl: l.imageUrl!, link: l.href })) });
        break;
      }
      case "INFO_COLUMNS": {
        if (cards.length === 0) {
          textBlock();
          break;
        }
        // Los sellos son cortos: con más de 4 o textos largos, tarjetas.
        if (cards.length <= 4 && cards.every((c) => c.title.length <= 60 && c.text.length <= 120 && !c.buttonText)) {
          header();
          out.push({
            type: "INFO_COLUMNS",
            items: cards.map((c) => ({ title: c.title, description: c.text, imageUrl: c.imageUrl, link: c.href })),
          });
        } else {
          out.push(customBlock("cards", name, { title: titleText, text: body, button }, colors, cards));
        }
        break;
      }
      case "TEXT":
        textBlock();
        break;
      case "INSTAGRAM_CTA":
        if (titleText || body) out.push({ type: "INSTAGRAM_CTA", title: titleText, description: body.replace(/\n+/g, " ") });
        break;
      case "CUSTOM_BLOCK": {
        let layout: CustomBlockLayout = raw.layout || (cards.length > 0 ? "cards" : images.length > 0 ? "image-text" : "text");
        let list = cards;
        if (layout === "image-text") {
          const image = images[0] ?? null;
          if (image) {
            const right = indexOf(image) > Math.min(indexOf(title), ...texts.map(indexOf));
            out.push(customBlock("image-text", name, { title: titleText, text: body, button }, colors, list, { url: image.url, right }));
            break;
          }
          layout = list.length > 0 ? "cards" : "text";
        }
        if ((layout === "cards" || layout === "quotes" || layout === "accordion") && list.length === 0) list = pictures;
        if (!titleText && !body && !button && list.length === 0) break;
        out.push(customBlock(layout, name, { title: titleText, text: body, button }, colors, list));
        break;
      }
    }

    if (out.length === 0) {
      // No salió nada: lo citado queda libre para otra sección.
      for (const key of ctx.taken) used.delete(key);
      continue;
    }
    out.forEach((section, i) => built.push({ at: ctx.at + i / 10, section }));
  }

  return built
    .sort((a, b) => a.at - b.at)
    .map((b) => b.section)
    .slice(0, MAX_HOME_SECTIONS);
}
