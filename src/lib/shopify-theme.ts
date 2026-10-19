import { GOOGLE_FONT_OPTIONS } from "@/lib/brand-theme";
import type { CustomBlockLayout } from "@/lib/storefront-sections";
import { decodeHtmlEntities } from "@/lib/html-entities";
import { categoryNameFromUrl, handleFromUrl, isCategoryUrl, isProductUrl, isStorePagePath, menuHrefToShopify } from "@/lib/store-scrape";

/// Lee el HTML público de la portada de una tienda Shopify y saca lo que
/// sirve para dejar "Diseño" y el menú armados sin que la marca mande
/// nada (2026-10-17): colores (los temas de Shopify los publican como
/// variables CSS en el HTML), tipografías, logo, favicon, nombre y los
/// links del menú principal. Es heurístico — cada tema nombra sus
/// variables distinto — así que cada cosa puede venir en null y el
/// importador lo dice; nunca se inventa un color. Código puro (sin red),
/// el que descarga es shopify-store-reader.ts.

export type ShopifyThemeColors = {
  fondo: string;
  texto: string;
  botones: string;
  principal: string;
  secundario: string;
};

export type ShopifyThemeFonts = {
  /// Las familias tal como las usa el tema de Shopify (para mostrarlas).
  headingFamily: string | null;
  bodyFamily: string | null;
  /// Las de nuestro catálogo (GOOGLE_FONT_OPTIONS): la misma si existe,
  /// si no la más parecida. Al leer la tienda por link, la misma de la
  /// tienda si Google Fonts la tiene (ver exactFonts en
  /// shopify-store-reader.ts); `*Exact` dice si quedó la misma.
  headingFont: string;
  bodyFont: string;
  headingExact: boolean;
  bodyExact: boolean;
};

/// `children`: el submenú (solo cuando lo hay), hasta tres niveles.
export type ShopifyMenuLink = { label: string; href: string; children?: ShopifyMenuLink[] };

export type ShopifyPayments = {
  /// Medios que la tienda muestra en el pie de página (Visa, PSE, Nequi…).
  methods: string[];
  /// Pasarelas detectadas por los scripts que carga (Wompi, Addi, PayU…).
  gateways: string[];
};

export type ShopifyPixels = {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  googleAnalyticsId: string | null;
};

export type ShopifySocial = {
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
};

export type ShopifyThemeInfo = {
  storeName: string | null;
  /// <meta name="description"> de la portada: sirve para la descripción
  /// corta del perfil (ver brand-profile-extract-service.ts).
  metaDescription: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: ShopifyThemeColors | null;
  fonts: ShopifyThemeFonts | null;
  menu: ShopifyMenuLink[];
  payments: ShopifyPayments;
  pixels: ShopifyPixels;
  social: ShopifySocial;
  /// Textos de la barra de anuncio (hasta 4).
  announcements: string[];
  /// Páginas propias enlazadas en la portada (/pages/{handle}).
  pageLinks: ShopifyPageLink[];
  /// Políticas enlazadas en la portada (/policies/{kind}).
  policyLinks: ShopifyPolicyKind[];
  /// Secciones de la portada reconocidas, en orden.
  homeSections: ShopifyHomeSection[];
  /// Quién leyó la portada: "ia" cuando la copió la IA a partir del
  /// esquema de la página (ver home-copy.ts); si no, las reglas de acá.
  homeSource?: "ia" | "reglas";
};

export type ShopifyPageLink = { handle: string; label: string };

export const SHOPIFY_POLICY_KINDS = [
  "shipping-policy",
  "refund-policy",
  "privacy-policy",
  "terms-of-service",
  "contact-information",
  "legal-notice",
] as const;
export type ShopifyPolicyKind = (typeof SHOPIFY_POLICY_KINDS)[number];

/// Título en español por si la página de la política no trae uno.
export const POLICY_TITLES: Record<ShopifyPolicyKind, string> = {
  "shipping-policy": "Política de envíos",
  "refund-policy": "Política de cambios y devoluciones",
  "privacy-policy": "Política de privacidad",
  "terms-of-service": "Términos y condiciones",
  "contact-information": "Información de contacto",
  "legal-notice": "Aviso legal",
};

export type ShopifyPageContent = { title: string | null; bodyHtml: string };

export type ShopifyHomeSection =
  /// `links`: el link de cada foto (mismo orden que `images`; "" = sin link),
  /// para sliders cuyas fotos llevan a una colección cada una.
  | { type: "BANNER"; images: string[]; title: string; subtitle: string; buttonText: string; buttonHref: string; links?: string[] }
  | { type: "FEATURED_COLLECTION"; collectionHandle: string; title: string }
  | { type: "TEXT"; heading: string; body: string }
  | { type: "CATEGORY_GRID"; title: string; subtitle?: string; items: { collectionHandle: string; imageUrl: string | null; label: string }[] }
  /// Dos o tres categorías con foto grande (formato banner).
  | { type: "CATEGORY_BANNERS"; items: { collectionHandle: string; imageUrl: string | null; label: string }[] }
  | { type: "VIDEO"; url: string; title: string }
  | { type: "FEATURED_PRODUCTS"; productHandles: string[]; title: string }
  /// Listas que acá se arman solas: novedades, ofertas, todo el catálogo.
  | { type: "NEW_PRODUCTS"; title: string }
  | { type: "ON_SALE_PRODUCTS"; title: string }
  | { type: "PRODUCT_CATALOG"; title: string }
  | { type: "IMAGE_CAROUSEL"; images: string[] }
  /// Dos o tres fotos lado a lado, cada una con su link (no de categoría).
  | { type: "PROMO_BANNERS"; items: { imageUrl: string; link: string }[] }
  | { type: "BRAND_CAROUSEL"; items: { imageUrl: string; link: string }[] }
  | { type: "INSTAGRAM_CTA"; title: string; description: string }
  /// `imageUrl`: cajitas que son una imagen (ícono con el texto adentro).
  | { type: "INFO_COLUMNS"; items: { title: string; description: string; imageUrl?: string | null; link?: string }[] }
  /// Lo que no calza en ninguna de las anteriores (ver CUSTOM_BLOCK en
  /// storefront-sections.ts), con los colores de la sección original. Los
  /// links van en la forma de Shopify, como en las demás.
  | {
      type: "CUSTOM_BLOCK";
      name: string;
      layout: CustomBlockLayout;
      title: string;
      text: string;
      buttonText: string;
      buttonHref: string;
      imageUrl: string | null;
      imagePosition: "left" | "right";
      columns: number;
      align: "left" | "center";
      background: string | null;
      textColor: string | null;
      items: { imageUrl: string | null; title: string; text: string; buttonText: string; link: string }[];
    };

const MAX_MENU_LINKS = 12;
/// Secciones de la portada que se traen como máximo (las mismas que acepta
/// la importación, ver secciones/importar-shopify).
export const MAX_HOME_SECTIONS = 20;

// ----------------------------------------------------------------------------
// Utilidades de HTML (sin parser: con expresiones regulares alcanza para
// lo que se busca, y no se carga nada en el servidor).
// ----------------------------------------------------------------------------

const decodeEntities = decodeHtmlEntities;

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return null;
  return decodeEntities((match[1] ?? match[2] ?? match[3] ?? "").trim());
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function absoluteUrl(src: string | null, baseUrl: string): string | null {
  if (!src) return null;
  const value = src.trim();
  if (!value || value.startsWith("data:") || value.startsWith("javascript:")) return null;
  try {
    return new URL(value.startsWith("//") ? `https:${value}` : value, baseUrl).href;
  } catch {
    return null;
  }
}

function headerHtml(html: string) {
  const start = html.search(/<header[\s>]/i);
  if (start < 0) return null;
  const end = html.lastIndexOf("</header>");
  return html.slice(start, end > start ? end + 9 : Math.min(html.length, start + 200_000));
}

// ----------------------------------------------------------------------------
// Colores
// ----------------------------------------------------------------------------

const BACKGROUND_PROPS = [
  "--color-background",
  "--color-base-background-1",
  "--color-body",
  "--colorbody",
  "--color-body-bg",
  "--color-bg",
  "--background-color",
  "--bg-color",
  "--body-bg",
  "--color-background-1",
  "--background",
  // WordPress (bloques), Astra.
  "--wp--preset--color--base",
  "--ast-global-color-5",
  "--ast-global-color-4",
];
const TEXT_PROPS = [
  "--color-foreground",
  "--color-base-text",
  "--color-text",
  "--colortextbody",
  "--text-color",
  "--color-body-text",
  "--color-text-body",
  "--body-color",
  "--foreground",
  // WordPress (bloques), Elementor, Astra.
  "--wp--preset--color--contrast",
  "--e-global-color-text",
  "--ast-global-color-3",
  "--ast-global-color-2",
];
const BUTTON_PROPS = [
  "--color-button",
  "--color-primary-button-background",
  "--color-base-accent-1",
  "--color-btn-primary",
  "--colorbtnprimary",
  "--button-background",
  "--color-button-background",
  "--button-bg-color",
  "--primary-button-background",
  "--button-background-color",
  "--color-btn-bg",
  "--btn-primary-bg",
  "--button-color",
  // Elementor, Astra, WordPress (bloques).
  "--e-global-color-primary",
  "--ast-global-color-0",
  "--wp--preset--color--primary",
];
const ACCENT_PROPS = [
  "--color-base-accent-1",
  "--color-accent",
  "--e-global-color-accent",
  "--e-global-color-primary",
  "--ast-global-color-0",
  "--wp--preset--color--primary",
  "--accent-color",
  "--color-link",
  "--colorlink",
  "--color-primary",
  "--primary-color",
  "--colorprimary",
  "--color-button",
  "--color-btn-primary",
  "--colorbtnprimary",
];
const BACKGROUND_2_PROPS = [
  "--color-base-background-2",
  "--color-background-2",
  "--color-secondary-background",
  "--colorbodyalt",
  "--color-body-alt",
];

/// Todas las variables CSS declaradas en los <style> del HTML, en orden de
/// aparición (la primera declaración de cada una es la del cuerpo de la
/// página en los temas tipo Dawn: `body, .color-scheme-1 { ... }`).
function collectCustomProps(html: string): Map<string, string[]> {
  const props = new Map<string, string[]>();
  const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  const declaration = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g;
  for (const block of styles) {
    for (const match of block.matchAll(declaration)) {
      const name = match[1].toLowerCase();
      const list = props.get(name) ?? [];
      list.push(match[2].trim());
      props.set(name, list);
    }
  }
  return props;
}

function channel(n: number) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

/// "#fff", "#ffffff", "#ffffffcc", "rgb(255, 255, 255)", "rgba(...)" o el
/// "255, 255, 255" que usa Dawn → "#ffffff". null si no es un color plano
/// (un gradiente, "transparent", etc.).
export function cssColorToHex(raw: string, props?: Map<string, string[]>, depth = 0): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  const ref = value.match(/^var\((--[a-z0-9_-]+)(?:\s*,\s*([^)]+))?\)$/);
  if (ref) {
    if (depth > 2) return null;
    const resolved = props?.get(ref[1])?.[0];
    if (resolved) return cssColorToHex(resolved, props, depth + 1);
    return ref[2] ? cssColorToHex(ref[2], props, depth + 1) : null;
  }
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) return `#${h.split("").map((c) => c + c).join("")}`;
    return `#${h.slice(0, 6)}`;
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,?\s*([\d.]+)\s*,?\s*([\d.]+)/);
  if (rgb) return `#${channel(Number(rgb[1]))}${channel(Number(rgb[2]))}${channel(Number(rgb[3]))}`;
  const triplet = value.match(/^([\d.]+)\s*,?\s+?([\d.]+)\s*,?\s+?([\d.]+)$/) ?? value.match(/^([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)$/);
  if (triplet) return `#${channel(Number(triplet[1]))}${channel(Number(triplet[2]))}${channel(Number(triplet[3]))}`;
  return null;
}

function firstColor(props: Map<string, string[]>, candidates: string[]): string | null {
  for (const name of candidates) {
    const values = props.get(name);
    if (!values) continue;
    for (const value of values) {
      const hex = cssColorToHex(value, props);
      if (hex) return hex;
    }
  }
  return null;
}

/// Mezcla un color con blanco (0 = el color, 1 = blanco) — para el fondo
/// de la barra de anuncio cuando el tema no trae un segundo fondo.
export function tintHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => channel(c + (255 - c) * amount);
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

const ELEMENTOR_STOCK_COLORS = new Set(["#6ec1e4", "#61ce70", "#54595f"]);

/// Un esquema de color de un tema de Shopify (Dawn: ".color-scheme-1";
/// Horizon: ".color-scheme-2"…) con sus variables.
type SchemeBlock = { name: string; props: Map<string, string[]> };

function schemeBlocks(html: string): SchemeBlock[] {
  const out: SchemeBlock[] = [];
  for (const style of html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []) {
    for (const rule of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/--color-background\s*:/.test(rule[2])) continue;
      for (const cls of rule[1].matchAll(/\.(color-[a-z0-9_-]+)/gi)) {
        const name = cls[1].toLowerCase();
        if (out.some((b) => b.name === name)) continue;
        const props = new Map<string, string[]>();
        for (const d of rule[2].matchAll(/(--[a-zA-Z0-9_-]+)\s*:\s*([^;}]+)/g)) {
          const key = d[1].toLowerCase();
          props.set(key, [...(props.get(key) ?? []), d[2].trim()]);
        }
        out.push({ name, props });
      }
    }
  }
  return out;
}

/// Qué esquema pinta el cuerpo de la página. Horizon pone un esquema por
/// sección (el de :root puede ser el de la barra de anuncio, no el de la
/// página — amglowspa.com salió con fondo rosa por eso), así que manda el
/// que más ocupa en las secciones del contenido; si no, el de <body>; si
/// no, el que Dawn pega a body ("body, .color-scheme-1 {"); si no, el primero.
function bodySchemeName(html: string, blocks: SchemeBlock[]): string | null {
  if (blocks.length === 0) return null;
  const names = new Set(blocks.map((b) => b.name));
  const tokenIn = (part: string) => {
    for (const m of part.matchAll(/\b(color-[a-z0-9_-]+)\b/gi)) {
      const name = m[1].toLowerCase();
      if (names.has(name)) return name;
    }
    return null;
  };
  const mainStart = html.search(/<main\b/i);
  const main = mainStart >= 0 ? (innerHtmlAt(html, mainStart) ?? "") : "";
  const counts = new Map<string, number>();
  const starts = Array.from(main.matchAll(/<(?:div|section)\b[^>]*id=["']shopify-section-[^"']*["'][^>]*>/gi))
    .map((m) => m.index)
    .filter((i): i is number => i != null);
  for (const [k, start] of starts.entries()) {
    // Cada sección cuenta por lo que ocupa: dos barras angostas de texto
    // en rojo no pintan la página (beautysolutionshop.com, 2026-10-19).
    const part = main.slice(start, starts[k + 1] ?? main.length);
    const name = tokenIn(part);
    if (name) counts.set(name, (counts.get(name) ?? 0) + part.length);
  }
  let best: string | null = null;
  for (const [name, count] of counts) if (best == null || count > (counts.get(best) ?? 0)) best = name;
  if (best) return best;
  const body = html.match(/<body\b[^>]*>/i)?.[0] ?? "";
  const onBody = tokenIn(attr(body, "class") ?? "");
  if (onBody) return onBody;
  const dawn = html.match(/(?:^|[\s,;}])body\s*,\s*\.(color-[a-z0-9_-]+)\s*\{/i)?.[1] ?? html.match(/\.(color-[a-z0-9_-]+)\s*,\s*body\s*\{/i)?.[1];
  if (dawn && names.has(dawn.toLowerCase())) return dawn.toLowerCase();
  return blocks[0].name;
}

/// El esquema de la barra de anuncio (su fondo es el "secundario").
function announcementSchemeName(html: string, blocks: SchemeBlock[]): string | null {
  if (blocks.length === 0) return null;
  const names = new Set(blocks.map((b) => b.name));
  const at = html.search(/class=["'][^"']*announcement/i);
  if (at < 0) return null;
  const window = html.slice(Math.max(0, at - 1500), at + 1500);
  for (const m of window.matchAll(/\b(color-[a-z0-9_-]+)\b/gi)) {
    const name = m[1].toLowerCase();
    if (names.has(name)) return name;
  }
  return null;
}

export function extractColors(html: string): ShopifyThemeColors | null {
  const global = collectCustomProps(html);
  const blocks = schemeBlocks(html);
  const bodyScheme = blocks.find((b) => b.name === bodySchemeName(html, blocks));
  // Las variables del esquema del cuerpo mandan; las globales completan.
  const props = new Map(global);
  if (bodyScheme) for (const [key, values] of bodyScheme.props) props.set(key, [...values, ...(global.get(key) ?? [])]);
  let fondo = firstColor(props, BACKGROUND_PROPS);
  let texto = firstColor(props, TEXT_PROPS);
  let botones = firstColor(props, BUTTON_PROPS);
  let principal = firstColor(props, ACCENT_PROPS);
  const announcement = blocks.find((b) => b.name === announcementSchemeName(html, blocks));
  const fondo2 = (announcement && announcement !== bodyScheme ? firstColor(announcement.props, BACKGROUND_PROPS) : null) ?? firstColor(props, BACKGROUND_2_PROPS);

  if (!fondo && !texto && !botones && !principal) {
    const meta = html.match(/<meta[^>]+name=["']theme-color["'][^>]*>/i)?.[0];
    const themeColor = meta ? cssColorToHex(attr(meta, "content") ?? "") : null;
    if (!themeColor) return null;
    botones = themeColor;
    principal = themeColor;
  }
  fondo = fondo ?? "#ffffff";
  texto = texto ?? (luminance(fondo) > 0.5 ? "#111111" : "#ffffff");
  // Fondo y texto iguales es una lectura fallida, no un diseño.
  if (fondo === texto) texto = luminance(fondo) > 0.5 ? "#111111" : "#ffffff";
  botones = botones ?? principal ?? texto;
  principal = principal ?? botones;
  const secundario = fondo2 && fondo2 !== fondo ? fondo2 : tintHex(principal, 0.86);
  // La paleta por defecto de Elementor (azul #6ec1e4, verde #61ce70, gris
  // #7a7a7a) sale en cualquier sitio que no la cambió: no es la de la
  // marca, y es mejor no traer colores que traer esos.
  if (ELEMENTOR_STOCK_COLORS.has((botones ?? "").toLowerCase()) || ELEMENTOR_STOCK_COLORS.has((principal ?? "").toLowerCase())) return null;
  return { fondo, texto, botones, principal, secundario };
}

// ----------------------------------------------------------------------------
// Tipografías
// ----------------------------------------------------------------------------

const HEADING_FONT_PROPS = [
  "--font-heading-family",
  "--font-stack-heading",
  "--font-heading",
  "--heading-font-family",
  "--font-family-heading",
  "--typeheaderprimary",
  "--font-stack-header",
  "--font-headings",
  "--heading-font",
  "--font-header",
  "--headings-font-family",
  // Elementor y WordPress (bloques).
  "--e-global-typography-primary-font-family",
  "--wp--preset--font-family--heading",
];
const BODY_FONT_PROPS = [
  "--font-body-family",
  "--font-stack-body",
  "--font-body",
  "--body-font-family",
  "--font-family-body",
  "--typebodyprimary",
  "--font-base",
  "--body-font",
  "--font-text",
  "--font-family",
  // Elementor y WordPress (bloques).
  "--e-global-typography-text-font-family",
  "--wp--preset--font-family--body",
];
const GENERIC_FAMILIES = new Set([
  "sans-serif",
  "serif",
  "monospace",
  "system-ui",
  "inherit",
  "initial",
  "cursive",
  "fantasy",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "ui-sans-serif",
  "ui-serif",
]);

/// La primera familia real de una lista CSS ("'Playfair Display', Georgia,
/// serif" → "Playfair Display").
function firstFamily(raw: string, props: Map<string, string[]>, depth = 0): string | null {
  for (const part of raw.split(",")) {
    const item = part.trim();
    const ref = item.match(/^var\((--[a-z0-9_-]+)/i);
    if (ref) {
      const resolved = depth < 2 ? props.get(ref[1].toLowerCase())?.[0] : null;
      const family = resolved ? firstFamily(resolved, props, depth + 1) : null;
      if (family) return family;
      continue;
    }
    const name = item.replace(/^["']|["']$/g, "").trim();
    if (!name || GENERIC_FAMILIES.has(name.toLowerCase())) continue;
    return name.slice(0, 60);
  }
  return null;
}

function firstFont(props: Map<string, string[]>, candidates: string[], role: "heading" | "body"): string | null {
  for (const name of candidates) {
    for (const value of props.get(name) ?? []) {
      const family = firstFamily(value, props);
      if (family) return family;
    }
  }
  // Cualquier variable que hable de fuente y del rol.
  const roleWords = role === "heading" ? /head|title|header/ : /body|base|text/;
  for (const [name, values] of props) {
    if (!/font|type/.test(name) || !roleWords.test(name) || /size|weight|scale|style|spacing|line|transform/.test(name)) continue;
    for (const value of values) {
      const family = firstFamily(value, props);
      if (family) return family;
    }
  }
  return null;
}

/// Qué letra de nuestro catálogo se parece más a cada familia típica de
/// Shopify. Minúsculas. Lo que no esté acá cae en la heurística serif/sans.
const FONT_ALIASES: Record<string, string> = {
  assistant: "Karla",
  lato: "Karla",
  mulish: "Karla",
  cabin: "Karla",
  "harmonia sans": "Karla",
  "open sans": "Inter",
  roboto: "Inter",
  helvetica: "Inter",
  "helvetica neue": "Inter",
  arial: "Inter",
  rubik: "Inter",
  nunito: "Nunito Sans",
  quicksand: "Poppins",
  "josefin sans": "Raleway",
  "tenor sans": "Raleway",
  oswald: "Montserrat",
  futura: "Montserrat",
  avenir: "Montserrat",
  "avenir next": "Montserrat",
  "proxima nova": "Montserrat",
  "source sans pro": "Work Sans",
  "dm sans": "Work Sans",
  manrope: "Work Sans",
  garamond: "Lora",
  "eb garamond": "Lora",
  "libre baskerville": "Lora",
  baskerville: "Lora",
  georgia: "Lora",
  "times new roman": "Lora",
  merriweather: "Lora",
  "pt serif": "Lora",
  "crimson text": "Lora",
  "libre caslon text": "Lora",
  "noto serif": "Lora",
  cormorant: "Playfair Display",
  "cormorant garamond": "Playfair Display",
  "bodoni moda": "Playfair Display",
  "abril fatface": "DM Serif Display",
  prata: "DM Serif Display",
};

const SERIF_HINT = /serif|garamond|baskerville|caslon|bodoni|didot|georgia|times|cormorant|playfair|merriweather|lora|prata|abril/;

export function closestFont(family: string | null, role: "heading" | "body"): { value: string; exact: boolean } {
  if (!family) return { value: role === "heading" ? "Instrument Sans" : "Karla", exact: false };
  const key = family.trim().toLowerCase();
  const exact = GOOGLE_FONT_OPTIONS.find((f) => f.value.toLowerCase() === key);
  if (exact) return { value: exact.value, exact: true };
  const alias = FONT_ALIASES[key];
  if (alias) return { value: alias, exact: false };
  if (SERIF_HINT.test(key) && !/sans/.test(key)) {
    return { value: role === "heading" ? "Playfair Display" : "Lora", exact: false };
  }
  return { value: role === "heading" ? "Montserrat" : "Inter", exact: false };
}

/// Las letras por los selectores de siempre en el CSS del HTML: `body {
/// font-family }` para el cuerpo y `h1, h2… { font-family }` para los
/// títulos. Así las declaran Astra, Elementor y la mayoría de temas de
/// WordPress, que no usan variables con nombre.
function fontsBySelector(html: string, props: Map<string, string[]>): { body: string | null; heading: string | null } {
  let body: string | null = null;
  let heading: string | null = null;
  const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const block of styles) {
    const css = block.replace(/^<style[^>]*>/i, "").replace(/<\/style>$/i, "");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const declarations = rule[2];
      const family = declarations.match(/(?:^|[;\s])font-family\s*:\s*([^;}]+)/i)?.[1];
      if (!family) continue;
      const selectors = rule[1].split(",").map((s) => s.trim().toLowerCase());
      const isBody = selectors.some((s) => /^(html|body|p|\.ast-body|\.elementor-widget-text-editor)$/.test(s));
      const isHeading = selectors.some((s) => /^(h1|h2|h3|\.entry-title|\.elementor-heading-title|\.wp-block-heading)(\s.*)?$/.test(s));
      if (!isBody && !isHeading) continue;
      const resolved = firstFamily(family, props);
      if (!resolved) continue;
      if (isBody && !body) body = resolved;
      if (isHeading && !heading) heading = resolved;
    }
  }
  return { body, heading };
}

/// Las familias que la página carga de Google Fonts (<link> o @import),
/// en orden: "css2?family=Poppins:wght@400&family=Playfair+Display…" o
/// "css?family=Poppins:400|Playfair+Display:700".
export function googleFontFamilies(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s)>]+)/gi)) {
    const query = match[1].replace(/&amp;/g, "&");
    for (const param of query.split("&")) {
      const [key, value] = param.split("=");
      if (key !== "family" || !value) continue;
      for (const item of decodeURIComponent(value.replace(/\+/g, " ")).split("|")) {
        const name = item.split(":")[0].trim();
        if (name && !out.includes(name)) out.push(name);
      }
    }
  }
  return out.slice(0, 6);
}

export function extractFonts(html: string): ShopifyThemeFonts | null {
  const props = collectCustomProps(html);
  let headingFamily = firstFont(props, HEADING_FONT_PROPS, "heading");
  let bodyFamily = firstFont(props, BODY_FONT_PROPS, "body");
  if (!headingFamily && !bodyFamily) {
    const bySelector = fontsBySelector(html, props);
    bodyFamily = bySelector.body;
    headingFamily = bySelector.heading;
  }
  if (!headingFamily && !bodyFamily) {
    // Los @font-face que el tema carga, en orden: la primera suele ser la
    // del cuerpo y la siguiente distinta, la de los títulos.
    const faces: string[] = [];
    for (const match of html.matchAll(/@font-face\s*{[^}]*font-family\s*:\s*([^;}]+)/gi)) {
      const family = firstFamily(match[1], props);
      if (family && !faces.includes(family)) faces.push(family);
    }
    bodyFamily = faces[0] ?? null;
    headingFamily = faces[1] ?? faces[0] ?? null;
  }
  if (!headingFamily && !bodyFamily) {
    // Lo que carga de Google Fonts: la serif o de display va a títulos.
    const linked = googleFontFamilies(html);
    bodyFamily = linked.find((f) => !SERIF_HINT.test(f.toLowerCase())) ?? linked[0] ?? null;
    headingFamily = linked.find((f) => f !== bodyFamily && SERIF_HINT.test(f.toLowerCase())) ?? linked.find((f) => f !== bodyFamily) ?? bodyFamily;
  }
  if (!headingFamily && !bodyFamily) return null;
  headingFamily = headingFamily ?? bodyFamily;
  bodyFamily = bodyFamily ?? headingFamily;
  const heading = closestFont(headingFamily, "heading");
  const body = closestFont(bodyFamily, "body");
  return {
    headingFamily,
    bodyFamily,
    headingFont: heading.value,
    bodyFont: body.value,
    headingExact: heading.exact,
    bodyExact: body.exact,
  };
}

// ----------------------------------------------------------------------------
// Logo, favicon y nombre
// ----------------------------------------------------------------------------

/// La imagen más grande de un srcset ("a_200x.png 200w, a_400x.png 400w").
function largestFromSrcset(srcset: string | null): string | null {
  if (!srcset) return null;
  let best: { url: string; width: number } | null = null;
  for (const entry of srcset.split(",")) {
    const [url, descriptor] = entry.trim().split(/\s+/);
    if (!url) continue;
    const width = descriptor ? parseFloat(descriptor) || 0 : 0;
    if (!best || width > best.width) best = { url, width };
  }
  return best?.url ?? null;
}

export function extractLogoUrl(html: string, baseUrl: string): string | null {
  const scope = headerHtml(html) ?? html.slice(0, 200_000);
  const images = scope.match(/<img\b[^>]*>/gi) ?? [];
  let best: { url: string; score: number } | null = null;
  for (const tag of images) {
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    const srcset = largestFromSrcset(attr(tag, "srcset") ?? attr(tag, "data-srcset"));
    const url = absoluteUrl(srcset ?? src, baseUrl) ?? absoluteUrl(src, baseUrl);
    if (!url || !/^https?:/.test(url) || /\.svg\b.*#|\/icons?\//i.test(url)) continue;
    const haystack = `${attr(tag, "class") ?? ""} ${attr(tag, "alt") ?? ""} ${url}`.toLowerCase();
    let score = /logo/.test(haystack) ? 10 : 0;
    if (/payment|badge|flag|icon|sprite|pixel|track/.test(haystack)) score -= 5;
    if (!best || score > best.score) best = { url, score };
  }
  if (best && best.score >= 10) return best.url;
  // Fuera del encabezado, cualquier imagen que se llame logo.
  const anywhere = html.match(/<img\b[^>]*logo[^>]*>/i)?.[0];
  if (anywhere) {
    const src = attr(anywhere, "src") ?? attr(anywhere, "data-src");
    return absoluteUrl(src, baseUrl);
  }
  return best?.url ?? null;
}

export function extractFaviconUrl(html: string, baseUrl: string): string | null {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  let touch: string | null = null;
  let icon: string | null = null;
  for (const tag of links) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const href = absoluteUrl(attr(tag, "href"), baseUrl);
    if (!href || /\.ico(\?|$)/i.test(href)) continue;
    if (/apple-touch-icon/.test(rel)) touch = touch ?? href;
    else if (/\bicon\b/.test(rel)) icon = icon ?? href;
  }
  return touch ?? icon;
}

export function extractMetaDescription(html: string): string | null {
  const meta =
    html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]*>/i)?.[0];
  const content = meta ? attr(meta, "content") : null;
  const clean = (content ?? "").replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 500) : null;
}

export function extractStoreName(html: string): string | null {
  const meta = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*>/i)?.[0];
  const fromMeta = meta ? attr(meta, "content") : null;
  if (fromMeta) return fromMeta.slice(0, 120);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (!title) return null;
  return stripTags(title).split(/\s[–—|-]\s/)[0].trim().slice(0, 120) || null;
}

// ----------------------------------------------------------------------------
// Menú
// ----------------------------------------------------------------------------

const SKIPPED_PATHS = /^\/(cart|account|search|checkout|policies|apps|password|challenge)(\/|$)/i;

/// Deja la ruta interna limpia: sin el dominio de la tienda, sin el
/// prefijo de idioma ("/es/collections/x" → "/collections/x") y sin query.
function cleanHref(href: string, baseUrl: string): string | null {
  const value = decodeEntities(href.trim());
  if (!value || value.startsWith("#") || /^(javascript|mailto|tel):/i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value.startsWith("//") ? `https:${value}` : value, baseUrl);
  } catch {
    return null;
  }
  const base = new URL(baseUrl);
  const sameHost = url.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
  if (!sameHost) return /^https?:$/.test(url.protocol) ? url.href : null;
  let path = url.pathname.replace(/\/+$/, "") || "/";
  path = path.replace(/^\/[a-z]{2}(-[a-z]{2})?(?=\/(collections|products|pages|blogs)(\/|$))/i, "");
  if (SKIPPED_PATHS.test(path)) return null;
  return path;
}

const MAX_MENU_CHILDREN = 24;
const MAX_MENU_DEPTH = 3;

export function extractMenu(html: string, baseUrl: string): ShopifyMenuLink[] {
  const header = headerHtml(html);
  if (!header) return [];
  // El menú de computadora suele ser el primer <nav> con links a
  // colecciones; si no hay, todo el encabezado (el del celular repite los
  // mismos links y se quitan por duplicados).
  const navs = header.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi) ?? [];
  const scope =
    navs.find((nav) => (nav.match(/href=["'][^"']*\/(collections|products|pages|product-category|categoria-producto|producto)\//gi) ?? []).length >= 1) ??
    header;
  const items = parseMenuTree(scope, baseUrl);
  // Los botones del encabezado por fuera del menú (el "DESCUENTOS" de
  // Rumi) van al final como ítems sueltos; se repiten en las versiones
  // para tablet y celular, por eso se quitan los repetidos.
  if (scope !== header) {
    const seen = new Set(items.map((item) => item.href));
    for (const button of headerButtons(header.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ""), baseUrl)) {
      if (items.length >= MAX_MENU_LINKS) break;
      if (seen.has(button.href)) continue;
      seen.add(button.href);
      items.push(button);
    }
  }
  return items;
}

/// Links con pinta de botón (class button/btn) a páginas de la misma
/// tienda. Los externos (WhatsApp) y el carrito o la cuenta no cuentan.
function headerButtons(html: string, baseUrl: string): ShopifyMenuLink[] {
  const out: ShopifyMenuLink[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const tag = `<a ${m[1]}>`;
    if (!/\b(?:[\w-]*button[\w-]*|btn[\w-]*)\b/i.test(attr(tag, "class") ?? "")) continue;
    const href = attr(tag, "href");
    const clean = href ? cleanHref(href, baseUrl) : null;
    if (!clean || !clean.startsWith("/") || clean === "/") continue;
    const label = stripTags(m[2]).slice(0, 60);
    if (label) out.push({ label, href: clean });
  }
  return out;
}

/// El menú con sus submenús, leyendo la estructura <ul>/<li>: un <ul>
/// dentro de un <li> es el submenú de ese ítem (WordPress/Elementor,
/// Horizon); en Dawn el padre es un <summary> y el <ul> va adentro del
/// <details>. Un padre sin link propio queda con "#". Ver conversación
/// del 2026-10-18 (el mega menú de Rumi).
function parseMenuTree(scope: string, baseUrl: string): ShopifyMenuLink[] {
  type Frame = {
    items: ShopifyMenuLink[];
    /// El ítem del <li> abierto (dueño del <ul> que venga adentro).
    current: ShopifyMenuLink | null;
    liOpen: boolean;
    /// Ya se tomó el link (o el <summary>) de este <li>: otro link en el
    /// mismo <li> ("Ver todo", el de adentro del <summary>) se ignora.
    liTaken: boolean;
    seen: Set<string>;
    depth: number;
  };
  const root: Frame = { items: [], current: null, liOpen: false, liTaken: false, seen: new Set(), depth: 1 };
  const stack: Frame[] = [root];
  const top = () => stack[stack.length - 1];
  // Los links ya vistos en el submenú de cada ítem: un mega menú en
  // columnas reparte los hijos de un mismo padre en varios <ul>.
  const seenOf = new Map<ShopifyMenuLink, Set<string>>();
  const addItem = (frame: Frame, label: string, href: string | null) => {
    if (href && frame.seen.has(href)) return null;
    if (frame.items.length >= (frame.depth === 1 ? MAX_MENU_LINKS : MAX_MENU_CHILDREN)) return null;
    if (href) frame.seen.add(href);
    const link: ShopifyMenuLink = { label, href: href ?? "#" };
    frame.items.push(link);
    return link;
  };
  const take = (frame: Frame, label: string, href: string | null) => {
    if (frame.liOpen) frame.liTaken = true;
    const link = addItem(frame, label, href);
    if (link) frame.current = link;
  };
  const linkInside = (fragment: string) => {
    const href = fragment.match(/<a\b[^>]*\bhref=["']([^"']*)["']/i)?.[1];
    return href ? cleanHref(href, baseUrl) : null;
  };
  for (const m of scope.matchAll(/<(\/?)(ul|ol|li|summary)\b[^>]*>|<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const tag = m[2]?.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      if (m[1] === "/") {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const frame = top();
      if (!frame.liOpen) {
        // Una lista suelta (la de arriba del todo o una envoltura): sigue
        // al mismo nivel.
        stack.push({ ...frame, current: null, liOpen: false, liTaken: false });
      } else if (frame.current && frame.depth < MAX_MENU_DEPTH) {
        // Un <ul> adentro de un ítem es su submenú (hasta tres niveles).
        const parent = frame.current;
        parent.children = parent.children ?? [];
        let seen = seenOf.get(parent);
        if (!seen) seenOf.set(parent, (seen = new Set()));
        stack.push({ items: parent.children, current: null, liOpen: false, liTaken: false, seen, depth: frame.depth + 1 });
      } else {
        // El submenú de un ítem repetido (o un cuarto nivel): se descarta.
        stack.push({ items: [], current: null, liOpen: false, liTaken: false, seen: new Set(), depth: frame.depth + 1 });
      }
      continue;
    }
    if (tag === "li") {
      const frame = top();
      frame.liOpen = m[1] !== "/";
      frame.liTaken = false;
      frame.current = null;
      continue;
    }
    if (tag === "summary") {
      if (m[1] === "/") continue;
      const frame = top();
      if (frame.liOpen && frame.liTaken) continue;
      const start = (m.index ?? 0) + m[0].length;
      const end = scope.indexOf("</summary>", start);
      const inner = scope.slice(start, end < 0 ? undefined : end);
      const label = stripTags(inner).slice(0, 60);
      if (!label) continue;
      // Un <summary> con link adentro (Horizon) es un padre con link propio.
      take(frame, label, linkInside(inner));
      continue;
    }
    if (m[3] != null) {
      const frame = top();
      if (frame.liOpen && frame.liTaken) continue;
      const href = attr(`<a ${m[3]}>`, "href");
      const label = stripTags(m[4]).slice(0, 60);
      if (!label) continue;
      const clean = href ? cleanHref(href, baseUrl) : null;
      if (href && !clean && !/^#?$/.test(href.trim())) continue; // carrito, cuenta, buscador…
      take(frame, label, clean);
    }
  }
  // Un padre sin link y sin submenú no sirve de nada.
  const prune = (items: ShopifyMenuLink[]): ShopifyMenuLink[] =>
    items
      .map((item) => (item.children ? { ...item, children: prune(item.children) } : item))
      .map((item) => (item.children && item.children.length === 0 ? { label: item.label, href: item.href } : item))
      .filter((item) => item.href !== "#" || (item.children && item.children.length > 0));
  return prune(root.items);
}

/// Traduce un link del menú de Shopify a la ruta de la vitrina de
/// Marcolini. null = no tiene equivalente (una página o un blog que no se
/// importan, una colección que no existe acá).
export function mapShopifyMenuHref(
  href: string,
  maps: {
    collectionSlugByHandle: Map<string, string>;
    productSlugByHandle: Map<string, string>;
    pageSlugByHandle?: Map<string, string>;
  },
): string | null {
  // "#" = un ítem del menú sin link (solo abre su submenú).
  if (href.trim() === "#" || href.trim() === "") return "#";
  if (/^https?:\/\//i.test(href)) return href;
  if (href === "/") return "/";
  if (/^\/collections(\/all)?$/i.test(href)) return "/coleccion";
  const page = href.match(/^\/pages\/([^/?#]+)/i);
  if (page) {
    const slug = maps.pageSlugByHandle?.get(decodeURIComponent(page[1]).toLowerCase());
    return slug ? `/pagina/${slug}` : null;
  }
  const product = href.match(/^\/(?:collections\/[^/]+\/)?products\/([^/?#]+)/i);
  if (product) {
    const slug = maps.productSlugByHandle.get(decodeURIComponent(product[1]).toLowerCase());
    return slug ? `/${slug}` : null;
  }
  const collection = href.match(/^\/collections\/([^/?#]+)/i);
  if (collection) {
    const slug = maps.collectionSlugByHandle.get(decodeURIComponent(collection[1]).toLowerCase());
    return slug ? `/coleccion/${slug}` : null;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Pasarelas y medios de pago, píxeles, redes y barra de anuncio
// ----------------------------------------------------------------------------

/// Los íconos de pago del pie de página (payment_type_svg_tag de Shopify)
/// traen un id "pi-visa", "pi-pse"… y casi siempre un <title> legible.
const PAYMENT_ID_NAMES: Record<string, string> = {
  visa: "Visa",
  master: "Mastercard",
  mastercard: "Mastercard",
  american_express: "American Express",
  diners_club: "Diners Club",
  discover: "Discover",
  jcb: "JCB",
  unionpay: "UnionPay",
  maestro: "Maestro",
  paypal: "PayPal",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  shop_pay: "Shop Pay",
  shopify_pay: "Shop Pay",
  pse: "PSE",
  nequi: "Nequi",
  bancolombia: "Bancolombia",
  efecty: "Efecty",
  baloto: "Baloto",
  daviplata: "Daviplata",
  addi: "Addi",
  sistecredito: "Sistecrédito",
  mercado_pago: "Mercado Pago",
  payu: "PayU",
  wompi: "Wompi",
  rappipay: "RappiPay",
  klarna: "Klarna",
  bitcoin: "Bitcoin",
};

const GATEWAY_PATTERNS: [RegExp, string][] = [
  [/wompi\.co/i, "Wompi"],
  [/epayco/i, "ePayco"],
  [/mercadopago|mercadolibre/i, "Mercado Pago"],
  [/payu(latam)?\./i, "PayU"],
  [/\baddi\.com|addi-widget|cdn\.addi/i, "Addi"],
  [/\bbold\.co/i, "Bold"],
  [/sistecredito/i, "Sistecrédito"],
  [/placetopay|evertec/i, "PlacetoPay"],
  [/paypal(objects)?\.com/i, "PayPal"],
  [/kushki/i, "Kushki"],
  [/openpay/i, "Openpay"],
  [/\bcobru\b/i, "Cobru"],
  [/shop\.app|shopify-pay|shop-pay|pay\.shopify\.com/i, "Shopify Payments / Shop Pay"],
];

function titleCase(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function extractPayments(html: string): ShopifyPayments {
  const methods: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    methods.push(name.trim());
  };
  for (const match of html.matchAll(/<title[^>]*id=["']pi-([a-z0-9_]+)["'][^>]*>([^<]*)<\/title>/gi)) {
    add(match[2].trim() || PAYMENT_ID_NAMES[match[1].toLowerCase()] || titleCase(match[1]));
  }
  for (const match of html.matchAll(/aria-labelledby=["']pi-([a-z0-9_]+)["']/gi)) {
    const id = match[1].toLowerCase();
    if (!seen.has((PAYMENT_ID_NAMES[id] ?? titleCase(id)).toLowerCase())) add(PAYMENT_ID_NAMES[id] ?? titleCase(id));
  }
  for (const match of html.matchAll(/<img\b[^>]*payment[^>]*>/gi)) {
    const alt = attr(match[0], "alt");
    if (alt) add(alt);
  }
  // Pasarelas: por los scripts/links que carga la página.
  const sources = [
    ...Array.from(html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)).map((m) => m[1]),
    ...Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[1].slice(0, 20_000)),
  ].join("\n");
  const gateways: string[] = [];
  for (const [pattern, name] of GATEWAY_PATTERNS) {
    if (pattern.test(sources) && !gateways.includes(name)) gateways.push(name);
  }
  return { methods, gateways };
}

export function extractPixels(html: string): ShopifyPixels {
  const meta = html.match(/fbq\(\s*["']init["']\s*,\s*["'](\d{6,20})["']/)?.[1] ?? html.match(/facebook\.com\/tr\?id=(\d{6,20})/)?.[1] ?? null;
  const tiktok = html.match(/ttq\.load\(\s*["']([A-Z0-9]{8,40})["']/)?.[1] ?? null;
  const ga = html.match(/\bG-[A-Z0-9]{6,12}\b/)?.[0] ?? null;
  return { metaPixelId: meta, tiktokPixelId: tiktok, googleAnalyticsId: ga };
}

const SOCIAL_SKIP = new Set(["p", "reel", "reels", "explore", "share", "sharer", "sharer.php", "share.php", "intent", "hashtag", "stories", "tag", "accounts"]);

export function extractSocial(html: string): ShopifySocial {
  const social: ShopifySocial = { instagram: null, tiktok: null, facebook: null, whatsapp: null, email: null, phone: null };
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = decodeEntities(match[1].trim());
    if (!social.email && /^mailto:/i.test(href)) {
      const email = href.slice(7).split("?")[0].trim();
      if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) social.email = email;
      continue;
    }
    if (!social.phone && /^tel:/i.test(href)) {
      const phone = href.slice(4).replace(/[^\d+]/g, "");
      if (phone.replace(/\D/g, "").length >= 7) social.phone = phone;
      continue;
    }
    let url: URL;
    try {
      url = new URL(href.startsWith("//") ? `https:${href}` : href);
    } catch {
      continue;
    }
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!social.instagram && host === "instagram.com" && first && !SOCIAL_SKIP.has(first.toLowerCase())) {
      social.instagram = first.replace(/^@/, "");
    } else if (!social.tiktok && host === "tiktok.com" && first.startsWith("@")) {
      social.tiktok = first.slice(1);
    } else if (!social.facebook && (host === "facebook.com" || host === "fb.com") && first && !SOCIAL_SKIP.has(first.toLowerCase())) {
      social.facebook = first;
    } else if (!social.whatsapp && (host === "wa.me" || host === "api.whatsapp.com" || host === "whatsapp.com")) {
      const digits = (host === "wa.me" ? first : (url.searchParams.get("phone") ?? "")).replace(/\D/g, "");
      if (digits.length >= 10) social.whatsapp = digits;
    }
  }
  return social;
}

export function extractAnnouncements(html: string): string[] {
  const texts: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const text = stripTags(raw);
    if (text.length < 3 || text.length > 200) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    texts.push(text);
  };
  // Shopify la llama "announcement"; en WordPress y otras suele ser una
  // barra superior (topbar, promo-bar, marquee, ticker).
  const bar = "(?:announcement|topbar|top-bar|promo-bar|header-top|ticker|notice-bar|site-notice|marquee)";
  for (const match of html.matchAll(new RegExp(`<(span|p|a)\\b[^>]*class=["'][^"']*${bar}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "gi"))) push(match[2]);
  // También los bloques (un marquee de "10% de descuento" en la portada).
  for (const match of html.matchAll(new RegExp(`<div\\b[^>]*class=["'][^"']*${bar}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, "gi"))) push(match[1]);
  return texts.slice(0, 4);
}

/// `extraCss`: hojas de estilo enlazadas que el lector bajó aparte cuando
/// la portada no trae colores ni letra en línea (Elementor guarda sus
/// colores y letras globales en un .css propio). Solo cuentan para
/// colores y letra.
export function parseShopifyStorefront(html: string, baseUrl: string, extraCss?: string): ShopifyThemeInfo {
  const styled = extraCss ? `${html}<style>${extraCss}</style>` : html;
  return {
    storeName: extractStoreName(html),
    metaDescription: extractMetaDescription(html),
    logoUrl: extractLogoUrl(html, baseUrl),
    faviconUrl: extractFaviconUrl(html, baseUrl),
    colors: extractColors(styled),
    fonts: extractFonts(styled),
    menu: extractMenu(html, baseUrl),
    payments: extractPayments(html),
    pixels: extractPixels(html),
    social: extractSocial(html),
    announcements: extractAnnouncements(html),
    pageLinks: extractPageLinks(html, baseUrl),
    policyLinks: extractPolicyLinks(html),
    homeSections: extractHomeSections(html, baseUrl, extraCss),
  };
}

// ----------------------------------------------------------------------------
// Páginas, políticas y portada (2026-10-18)
// ----------------------------------------------------------------------------

/// El HTML interno del elemento que abre en `start` (índice de su "<tag"),
/// contando aperturas y cierres del mismo tag para no cortarse en el
/// primer cierre anidado.
function innerHtmlAt(html: string, start: number): string | null {
  const tagMatch = html.slice(start, start + 40).match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagMatch) return null;
  const tag = tagMatch[1].toLowerCase();
  const openEnd = html.indexOf(">", start);
  if (openEnd < 0) return null;
  if (html[openEnd - 1] === "/") return "";
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1] === "/") {
      depth--;
      if (depth === 0) return html.slice(openEnd + 1, m.index);
    } else if (!m[0].endsWith("/>")) {
      depth++;
    }
  }
  return null;
}

/// Páginas propias enlazadas en cualquier parte de la portada
/// (encabezado, pie): /pages/{handle}.
export function extractPageLinks(html: string, baseUrl: string): ShopifyPageLink[] {
  const links: ShopifyPageLink[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(`<a ${match[1]}>`, "href");
    if (!href) continue;
    const clean = cleanHref(href, baseUrl);
    const page = clean?.match(/^\/pages\/([^/?#]+)$/i);
    if (!page) continue;
    const handle = decodeURIComponent(page[1]).toLowerCase();
    if (seen.has(handle)) continue;
    const label = stripTags(match[2]).slice(0, 60) || handle;
    seen.add(handle);
    links.push({ handle, label });
    if (links.length >= 15) break;
  }
  return links;
}

export function extractPolicyLinks(html: string): ShopifyPolicyKind[] {
  const found: ShopifyPolicyKind[] = [];
  for (const match of html.matchAll(/\/policies\/([a-z-]+)/gi)) {
    const kind = match[1].toLowerCase() as ShopifyPolicyKind;
    if ((SHOPIFY_POLICY_KINDS as readonly string[]).includes(kind) && !found.includes(kind)) found.push(kind);
  }
  return found;
}

/// Deja absolutos los src/href relativos del contenido (Shopify usa
/// "//cdn.shopify.com/…" y rutas internas).
function absolutizeUrls(html: string, baseUrl: string) {
  return html.replace(/\b(src|href)=(["'])([^"']+)\2/gi, (whole, name: string, quote: string, value: string) => {
    const absolute = absoluteUrl(value, baseUrl);
    return absolute ? `${name}=${quote}${absolute}${quote}` : whole;
  });
}

const PAGE_BODY_PATTERNS = [
  /<div\b[^>]*class=["'][^"']*shopify-policy__body[^"']*["'][^>]*>/i,
  /<(?:div|section)\b[^>]*class=["'][^"']*\brte\b[^"']*["'][^>]*>/i,
  /<(?:div|section)\b[^>]*class=["'][^"']*page(?:__|-)content[^"']*["'][^>]*>/i,
  /<article\b[^>]*>/i,
];

/// El título y el cuerpo (HTML) de una página o política de Shopify: lo
/// que está dentro de <main>, buscando el bloque de texto enriquecido
/// (.rte) que usa el editor de Shopify.
export function extractPageContent(html: string, baseUrl: string): ShopifyPageContent | null {
  const mainStart = html.search(/<main\b/i);
  const scope = (mainStart >= 0 ? innerHtmlAt(html, mainStart) : null) ?? html.replace(/^[\s\S]*<body\b[^>]*>/i, "");
  const title = stripTags(scope.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").slice(0, 100) || null;
  let body: string | null = null;
  for (const pattern of PAGE_BODY_PATTERNS) {
    const match = scope.match(pattern);
    if (match?.index != null) {
      body = innerHtmlAt(scope, match.index);
      if (body) break;
    }
  }
  // Sin bloque de texto enriquecido (una página armada con Elementor u
  // otro constructor): se limpia como la portada — sin menús, formularios,
  // duplicados para celular ni avisos — y las fotos quedan con su URL real.
  if (body == null) body = cleanBuilderContent(scope.replace(/<h1\b[\s\S]*?<\/h1>/i, ""), baseUrl);
  body = absolutizeUrls(
    body
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, ""),
    baseUrl,
  ).trim();
  if (!body && !title) return null;
  return { title, bodyHtml: body.slice(0, 50_000) };
}

function sectionImages(inner: string, baseUrl: string, max = 6): string[] {
  const urls: string[] = [];
  for (const tag of inner.match(/<img\b[^>]*>/gi) ?? []) {
    const srcset = largestFromSrcset(attr(tag, "srcset") ?? attr(tag, "data-srcset"));
    const src = attr(tag, "src") ?? attr(tag, "data-src");
    const url = absoluteUrl(srcset ?? src, baseUrl) ?? absoluteUrl(src, baseUrl);
    if (!url || !/^https?:/.test(url) || /\.svg(\?|$)|placeholder|\/icons?\/|data:image/i.test(url)) continue;
    if (!urls.includes(url)) urls.push(url);
    if (urls.length >= max) break;
  }
  return urls;
}

function firstText(inner: string, tags: string, max: number) {
  const match = inner.match(new RegExp(`<(${tags})\\b[^>]*>([\\s\\S]*?)</\\1>`, "i"));
  return match ? stripTags(match[2]).slice(0, max) : "";
}

function allParagraphs(inner: string, max: number) {
  const texts: string[] = [];
  for (const match of inner.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(match[1]);
    if (text) texts.push(text);
  }
  return texts.join("\n\n").slice(0, max);
}

function firstButton(inner: string, baseUrl: string) {
  const match = inner.match(/<a\b([^>]*class=["'][^"']*(?:button|btn)[^"']*["'][^>]*)>([\s\S]*?)<\/a>/i);
  if (!match) return { text: "", href: "" };
  const href = attr(`<a ${match[1]}>`, "href");
  return { text: stripTags(match[2]).slice(0, 40), href: (href && cleanHref(href, baseUrl)) || "" };
}

function collectionHandles(inner: string, max: number) {
  const handles: string[] = [];
  for (const match of inner.matchAll(/href=["'][^"']*\/collections\/([^"'/?#]+)/gi)) {
    const handle = decodeURIComponent(match[1]).toLowerCase();
    if (handle === "all" || handles.includes(handle)) continue;
    handles.push(handle);
    if (handles.length >= max) break;
  }
  return handles;
}

function productHandles(inner: string, max: number) {
  const handles: string[] = [];
  for (const match of inner.matchAll(/href=["'][^"']*\/products\/([^"'/?#]+)/gi)) {
    const handle = decodeURIComponent(match[1]).toLowerCase();
    if (handles.includes(handle)) continue;
    handles.push(handle);
    if (handles.length >= max) break;
  }
  return handles;
}

/// Las secciones de la portada que sabemos traducir a la home de Marcolini
/// (ver storefront-sections.ts): banners y slideshows, colección
/// destacada, texto, imagen con texto, lista de colecciones, video,
/// producto destacado y columnas informativas. Está pensado para los
/// temas tipo Dawn (los ids "shopify-section-…__image_banner"); en otros
/// temas se reconoce por las clases.
export function extractHomeSections(html: string, baseUrl: string, extraCss = ""): ShopifyHomeSection[] {
  const sections: ShopifyHomeSection[] = [];
  for (const match of html.matchAll(/<(?:div|section)\b[^>]*id=["']shopify-section-[^"']*["'][^>]*>/gi)) {
    if (match.index == null) continue;
    const tag = match[0];
    const id = (attr(tag, "id") ?? "").toLowerCase();
    const cls = (attr(tag, "class") ?? "").toLowerCase();
    if (/header|footer|announcement|newsletter|email|cart|popup|apps|custom[-_]liquid/.test(`${id} ${cls}`)) continue;
    const inner = innerHtmlAt(html, match.index);
    if (!inner) continue;
    const innerClasses = (inner.slice(0, 1500).match(/class=["']([^"']+)["']/gi) ?? []).join(" ").toLowerCase();
    // Los ids llevan "template--1__gallery_abc": con guiones, para que las
    // palabras se reconozcan como en las clases.
    const key = `${id} ${cls} ${innerClasses}`.replace(/_/g, "-");

    if (/slideshow|image[-_]banner|\bhero\b|\bbanner\b/.test(key)) {
      const images = sectionImages(inner, baseUrl);
      const title = firstText(inner, "h1|h2|h3", 120);
      const subtitle = allParagraphs(inner, 240);
      const button = firstButton(inner, baseUrl);
      if (images.length > 0 || title) {
        sections.push({ type: "BANNER", images, title, subtitle, buttonText: button.text, buttonHref: button.href });
      }
      continue;
    }
    if (/featured[-_]collection|product[-_]list|featured[-_]products|product[-_]grid|products?[-_]carousel/.test(key)) {
      const title = firstText(inner, "h2|h3", 120);
      const [collectionHandle] = collectionHandles(inner, 1);
      if (collectionHandle) {
        sections.push({ type: "FEATURED_COLLECTION", collectionHandle, title });
        continue;
      }
      // Horizon: una lista de productos de "todos" (con su "Ver todo" a
      // /collections/all) se arma sola acá; si no, los productos listados.
      const handles = productHandles(inner, 8);
      if (/\/collections\/all\b/i.test(inner) && !ON_SALE_RE.test(title)) sections.push({ type: "NEW_PRODUCTS", title });
      else if (handles.length > 0) sections.push(productListSection(key, title, handles));
      continue;
    }
    if (/logo[-_]list|brand[-_]list|logos/.test(key)) {
      const items: { imageUrl: string; link: string }[] = [];
      for (const link of inner.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
        const [imageUrl] = sectionImages(link[2], baseUrl, 1);
        if (imageUrl && !items.some((i) => i.imageUrl === imageUrl)) items.push({ imageUrl, link: mapHref(attr(`<a ${link[1]}>`, "href"), baseUrl) });
      }
      for (const imageUrl of sectionImages(inner, baseUrl, 12)) if (!items.some((i) => i.imageUrl === imageUrl)) items.push({ imageUrl, link: "" });
      if (items.length >= 3) sections.push({ type: "BRAND_CAROUSEL", items: items.slice(0, 12) });
      continue;
    }
    if (/\bgallery\b|media[-_]grid|image[-_]gallery/.test(key)) {
      const images = sectionImages(inner, baseUrl, 8);
      if (images.length >= 2) sections.push({ type: "IMAGE_CAROUSEL", images });
      continue;
    }
    if (/testimonial|email|newsletter|marquee/.test(key)) continue;
    if (/collection[-_]list/.test(key)) {
      const items: { collectionHandle: string; imageUrl: string | null; label: string }[] = [];
      for (const link of inner.matchAll(/<a\b([^>]*href=["'][^"']*\/collections\/([^"'/?#]+)[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
        const collectionHandle = decodeURIComponent(link[2]).toLowerCase();
        if (collectionHandle === "all" || items.some((i) => i.collectionHandle === collectionHandle)) continue;
        items.push({ collectionHandle, imageUrl: sectionImages(link[3], baseUrl, 1)[0] ?? null, label: stripTags(link[3]).slice(0, 40) });
        if (items.length >= 6) break;
      }
      if (items.length > 0) sections.push({ type: "CATEGORY_GRID", title: firstText(inner, "h2|h3", 120), items });
      continue;
    }
    if (/image[-_]with[-_]text|media[-_]with[-_]text|multirow/.test(key)) {
      const images = sectionImages(inner, baseUrl, 1);
      const title = firstText(inner, "h2|h3", 120);
      const button = firstButton(inner, baseUrl);
      if (images.length > 0 || title) {
        sections.push({ type: "BANNER", images, title, subtitle: allParagraphs(inner, 240), buttonText: button.text, buttonHref: button.href });
      }
      continue;
    }
    if (/rich[-_]text/.test(key)) {
      const heading = firstText(inner, "h1|h2|h3", 120);
      const body = allParagraphs(inner, 2000);
      if (heading || body) sections.push({ type: "TEXT", heading, body });
      continue;
    }
    if (/\bvideo\b/.test(key)) {
      const url =
        inner.match(/<iframe\b[^>]*src=["']([^"']*(?:youtube|youtu\.be|vimeo)[^"']*)["']/i)?.[1] ??
        inner.match(/href=["']([^"']*(?:youtube\.com\/watch|youtu\.be\/|vimeo\.com\/)[^"']*)["']/i)?.[1] ??
        "";
      if (url) sections.push({ type: "VIDEO", url: decodeEntities(url).slice(0, 300), title: firstText(inner, "h2|h3", 120) });
      continue;
    }
    if (/featured[-_]product/.test(key)) {
      const handles = productHandles(inner, 8);
      if (handles.length > 0) sections.push({ type: "FEATURED_PRODUCTS", productHandles: handles, title: firstText(inner, "h2|h3", 120) });
      continue;
    }
    if (/multicolumn/.test(key)) {
      const items: { title: string; description: string }[] = [];
      for (const card of inner.matchAll(/<(li|div)\b[^>]*class=["'][^"']*multicolumn(?:-list__item|-card)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)) {
        const title = firstText(card[2], "h3|h2|h4", 60);
        const description = allParagraphs(card[2], 120);
        if (title || description) items.push({ title, description });
        if (items.length >= 4) break;
      }
      if (items.length > 0) sections.push({ type: "INFO_COLUMNS", items });
      continue;
    }
  }
  // Sin secciones de Shopify reconocidas (WooCommerce, Tiendanube o un
  // tema raro) se lee la portada por lo que contiene.
  if (sections.length === 0) return extractGenericHomeSections(html, baseUrl, extraCss);
  return sections.slice(0, MAX_HOME_SECTIONS);
}

// ----------------------------------------------------------------------------
// Portada de tiendas que no son Shopify (2026-10-18)
// ----------------------------------------------------------------------------
//
// WordPress con WooCommerce (Elementor, Gutenberg, Divi, Flatsome, sliders
// como Revolution o Smart Slider), Tiendanube y cualquier otra tienda no
// traen ids "shopify-section-…", así que la portada se reconoce por lo que
// contiene, en el orden en que aparece: sliders y banners (fotos grandes
// con título y botón), cuadrículas de categorías (links a
// /product-category/x), listas de productos (links a /product/x), videos
// de YouTube/Vimeo, bloques de texto y columnas informativas. Lo que ya se
// tomó para una sección no se vuelve a leer como otra. Pedido el
// 2026-10-18: Rumi y amglow (WooCommerce) se importaron sin portada.

type Range = { start: number; end: number };
type PlacedSection = { at: number; section: ShopifyHomeSection };

const VOID_TAGS = new Set(["img", "br", "hr", "input", "meta", "link", "source", "track", "wbr", "area", "base", "col", "embed", "param"]);

function inRanges(index: number, ranges: Range[]) {
  return ranges.some((r) => index >= r.start && index < r.end);
}

/// Dónde termina (índice después del cierre) el elemento que abre en
/// `start` — el hermano de innerHtmlAt.
function elementEndAt(html: string, start: number): number | null {
  const tagMatch = html.slice(start, start + 40).match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagMatch) return null;
  const tag = tagMatch[1].toLowerCase();
  const openEnd = html.indexOf(">", start);
  if (openEnd < 0) return null;
  if (html[openEnd - 1] === "/" || VOID_TAGS.has(tag)) return openEnd + 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = openEnd + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1] === "/") {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else if (!m[0].endsWith("/>")) {
      depth++;
    }
  }
  return null;
}

/// Quita los elementos enteros (con todo lo anidado) cuya apertura calza
/// con el patrón.
function removeElements(html: string, openTag: RegExp): string {
  const re = new RegExp(openTag.source, "gi");
  let out = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index < cursor) continue;
    const end = elementEndAt(html, m.index);
    if (end == null) continue;
    out += html.slice(cursor, m.index);
    cursor = end;
    re.lastIndex = end;
  }
  return out + html.slice(cursor);
}

const NOISE_BLOCK_RE =
  /<(?:div|section|ul|ol|aside)\b[^>]*\b(?:class|id)=["'][^"']*(?:cookie|popup|pop-up|modal|off-?canvas|mini-?cart|cart-drawer|elementor-location-(?:header|footer)|elementor-popup|site-header|site-footer|masthead|colophon|breadcrumb|mega-?menu|newsletter|mailchimp|wp-block-woocommerce-breadcrumbs|whatsapp-button|back-to-top|scroll-top)[^"']*["']/;

/// El cuerpo de la portada sin encabezado, pie, menús, formularios,
/// scripts ni avisos: lo que queda es el contenido de la página.
function homeScope(html: string): string {
  let scope = html.replace(/<!--[\s\S]*?-->/g, "");
  scope = removeElements(scope, /<(?:script|style|noscript|template|svg)\b/);
  const main = scope.search(/<main\b/i);
  scope = main >= 0 ? (innerHtmlAt(scope, main) ?? scope) : scope.replace(/^[\s\S]*?<body\b[^>]*>/i, "");
  scope = removeElements(scope, /<(?:header|footer|nav|aside|form)\b/);
  // Elementor y otros arman una versión para celular aparte (la misma
  // foto en chico): se deja la de computadora.
  scope = removeElements(scope, HIDDEN_ON_DESKTOP_RE);
  return removeElements(scope, NOISE_BLOCK_RE);
}

const HIDDEN_ON_DESKTOP_RE =
  /<(?:div|section|header|footer|article|figure|ul|li)\b[^>]*\bclass=["'][^"']*(?:elementor-hidden-desktop|\bhidden-desktop\b|\bhide-desktop\b|\bhidden-lg\b|\bmobile-only\b|\bonly-mobile\b|\bvisible-xs\b)[^"']*["']/;

/// Fondos definidos en CSS (en los <style> de la página o en las hojas
/// que el lector bajó aparte): Elementor pone la foto de cada slide así,
/// ".elementor-repeater-item-70c8e4d .swiper-slide-bg{background-image:
/// url(…)}", y no en el HTML.
type CssBackground = { selector: string; url: string };

function parseCssBackgrounds(css: string): CssBackground[] {
  const out: CssBackground[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const url = m[2].match(/background(?:-image)?\s*:\s*url\((['"]?)([^'")]+)\1\)/i)?.[2];
    if (url) out.push({ selector: m[1].trim(), url: url.trim() });
  }
  return out;
}

const CSS_KEY_CLASS_RE = /^(?:elementor-repeater-item-[a-z0-9]+|elementor-element-[a-z0-9]+)$/i;

/// La primera foto de fondo que el CSS le pone a un elemento (por sus
/// clases con id de Elementor) o a algo adentro de él.
function cssBackgroundFor(classAttr: string, backgrounds: CssBackground[], baseUrl: string): string | null {
  if (backgrounds.length === 0) return null;
  for (const token of classAttr.split(/\s+/)) {
    if (!CSS_KEY_CLASS_RE.test(token)) continue;
    const re = new RegExp(`\\.${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    const rule = backgrounds.find((b) => re.test(b.selector));
    const url = rule ? absoluteUrl(decodeEntities(rule.url), baseUrl) : null;
    if (url && /^https?:/.test(url) && !IMAGE_NOISE_RE.test(url)) return url;
  }
  return null;
}

function inlineStyles(html: string) {
  return (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? []).map((block) => block.replace(/^<style\b[^>]*>/i, "").replace(/<\/style>$/i, "")).join("\n");
}

/// WordPress guarda copias por tamaño ("foto-300x300.jpg"): la misma foto
/// en otro tamaño no cuenta dos veces.
function imageKey(url: string) {
  return url.replace(/-\d{2,4}x\d{2,4}(\.[a-z]{3,4})(?:\?.*)?$/i, "$1").replace(/\?.*$/, "");
}

const IMAGE_NOISE_RE =
  /\.svg(?:\?|$)|\.gif(?:\?|$)|placeholder|data:image|\/wp-includes\/|\/wp-content\/plugins\/|[-_/.]icons?[-_./]|[-_/]logo[-_./s]|spinner|preloader|loading|blank\.|pixel|1x1|gravatar|emoji|favicon|captcha/i;

function tinyImageTag(tag: string) {
  const width = parseInt(attr(tag, "width") ?? "", 10);
  const height = parseInt(attr(tag, "height") ?? "", 10);
  if (width > 0 && width < 120 && (!height || height < 120)) return true;
  return /\b(?:avatar|emoji|icon|logo|wp-smiley|payment|badge)\b/i.test(`${attr(tag, "class") ?? ""} ${attr(tag, "alt") ?? ""}`);
}

function imageUrlOf(tag: string, baseUrl: string): string | null {
  const srcset = largestFromSrcset(attr(tag, "data-lazy-srcset") ?? attr(tag, "data-srcset") ?? attr(tag, "srcset"));
  const src =
    attr(tag, "data-lazy-src") ?? attr(tag, "data-src") ?? attr(tag, "data-original") ?? attr(tag, "data-lazyload") ?? attr(tag, "src");
  return absoluteUrl(srcset ?? src, baseUrl) ?? absoluteUrl(src, baseUrl);
}

/// Una foto grande (no un ícono): por sus medidas, su srcset o el sufijo
/// de tamaño de WordPress ("-1024x683.jpg").
function largeImageTag(tag: string, url: string) {
  const width = parseInt(attr(tag, "width") ?? "", 10);
  if (width > 0) return width >= 300;
  const srcset = attr(tag, "data-lazy-srcset") ?? attr(tag, "data-srcset") ?? attr(tag, "srcset");
  if (srcset) return /\b([6-9]\d{2}|\d{4,})w\b/.test(srcset);
  const sized = url.match(/-(\d{2,4})x(\d{2,4})\.[a-z]{3,4}(?:\?|$)/i);
  if (sized) return parseInt(sized[1], 10) >= 500;
  return true;
}

/// Las fotos de un tramo: <img> (con sus variantes perezosas), fondos CSS
/// y el JSON de Elementor ("background_image":{"url":…}).
function genericImages(part: string, baseUrl: string, max = 6, onlyLarge = false, backgrounds: CssBackground[] = []): string[] {
  const urls: string[] = [];
  const push = (raw: string | null) => {
    const url = absoluteUrl(raw ? decodeEntities(raw.replace(/\\\//g, "/")) : null, baseUrl);
    if (!url || !/^https?:/.test(url) || IMAGE_NOISE_RE.test(url) || urls.some((u) => imageKey(u) === imageKey(url))) return;
    urls.push(url);
  };
  for (const tag of part.match(/<img\b[^>]*>/gi) ?? []) {
    if (urls.length >= max) return urls;
    if (tinyImageTag(tag)) continue;
    const url = imageUrlOf(tag, baseUrl);
    if (!url || (onlyLarge && !largeImageTag(tag, url))) continue;
    push(url);
  }
  for (const m of part.matchAll(/background(?:-image)?\s*:\s*url\((['"]?)([^'")]+)\1\)/gi)) push(m[2]);
  for (const m of part.matchAll(/\bdata-(?:bg|background|background-image|bg-image|lazy-bg|back)=["']([^"']+)["']/gi)) push(m[1]);
  for (const m of part.matchAll(/background_image(?:&quot;|"):\{(?:&quot;|")url(?:&quot;|"):(?:&quot;|")([^"&]+)(?:&quot;|")/gi)) push(m[1]);
  if (backgrounds.length > 0) {
    for (const m of part.matchAll(/\bclass=["']([^"']*)["']/gi)) push(cssBackgroundFor(m[1], backgrounds, baseUrl));
  }
  return urls.slice(0, max);
}

const BANNER_TOKEN_RE =
  /\b(?:swiper|swiper-container|slick-slider|owl-carousel|rev_slider_wrapper|rev_slider|rs-module-wrap|rs-fullwidth|n2-ss-slider|n2-section-smartslider|metaslider|soliloquy-container|ls-container|elementor-widget-slides|elementor-widget-image-carousel|elementor-widget-media-carousel|elementor-widget-call-to-action|wp-block-cover|wp-block-media-text|et_pb_slider|et_pb_fullwidth_header|et_pb_fullwidth_image|ux-banner|banner-grid|slideshow|carousel|hero|banner|slider|slides)\b/i;
const SECTION_TOKEN_RE = /\b(?:elementor-top-section|elementor-section|e-con|e-container|et_pb_section|wp-block-group|vc_row|section|row)\b/i;
const PRODUCT_LIST_RE =
  /\b(?:products|wc-block-grid|wc-block-product-template|wp-block-woocommerce-product-collection|wp-block-woocommerce-product-new|wp-block-woocommerce-product-best-sellers|wp-block-woocommerce-product-on-sale|wp-block-woocommerce-product-top-rated|wp-block-woocommerce-handpicked-products|wp-block-woocommerce-products-by-attribute|wp-block-woocommerce-product-category|wp-block-woocommerce-product-categories|wc-block-product-categories|elementor-widget-woocommerce-products|elementor-widget-wc-products|elementor-widget-woocommerce-product-categories|et_pb_shop|products?-(?:grid|carousel|slider|list)|woocommerce-products|js-product-table|product-table|item-product-list)\b/i;
const INSTAGRAM_RE = /\b(?:instagram|insta-feed|instagram-feed|sbi_|sb_instagram|elfsight-app|elementor-widget-instagram|wp-block-instagram)\b/i;
const BRAND_ROW_RE = /\b(?:brands?|logos?|marcas|clients?|clientes|partners?|aliados|logo-carousel|brand-carousel|client-logos)\b/i;
const GALLERY_RE =
  /\b(?:gallery|galeria|wp-block-gallery|elementor-widget-gallery|elementor-widget-image-gallery|elementor-widget-image-carousel|elementor-widget-media-carousel|photo-gallery|lookbook)\b/i;
const NEW_PRODUCTS_RE = /\bnuevo|novedad|new arrival|reci[eé]n llegad|lanzamiento|\bnew\b|lo [úu]ltimo/i;
const ON_SALE_RE = /oferta|descuento|promoci|\bsale\b|rebaja|outlet|liquidaci/i;
const CATALOG_TITLE_RE = /todos|tienda|shop|cat[aá]logo|productos|products/i;

/// Tarjetas de producto o categoría (WooCommerce, sus bloques, Essential
/// Addons): aunque vivan en un swiper no son banners.
const PRODUCT_CARD_RE = /\b(?:product|type-product|product-category|product-item|product-card|wc-block-grid__product|item-product)\b/i;
const INFO_ITEM_RE =
  /\b(?:elementor-widget-icon-box|elementor-widget-image-box|et_pb_blurb|wp-block-column|icon-box|iconbox|info-box|infobox|feature-box|featured-box|feature-item|benefit|ux-box|box-text|service-box|trust-badge|usp-item)\b/i;
const NOISE_HEADING_RE =
  /suscr|newsletter|bolet[ií]n|cont[aá]ct|cookie|carrito|iniciar sesi|reg[ií]strate|buscar|s[ií]guenos|redes sociales|instagram|whatsapp|testimon|opinion|rese[ñn]|clientes dicen|\bblog\b|noticias|entradas recientes|comentarios/i;

function tagHasBackgroundImage(tag: string) {
  return /background(?:-image)?\s*:\s*url\(|\bdata-(?:bg|background|background-image)=|background_image(?:&quot;|")/i.test(tag);
}

function sameSite(href: string, baseUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(decodeEntities(href.trim()).replace(/^\/\//, "https://"), baseUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const host = (h: string) => h.replace(/^www\./, "").toLowerCase();
  return host(url.hostname) === host(new URL(baseUrl).hostname) ? url : null;
}

// Prefijo + un tramo más: "/colecciones/" a secas es una página, no
// una categoría.
const CATEGORY_PREFIX_RE = /\/(?:product-category|categoria-producto|collections|colecciones|coleccion|categorias?|categor(?:y|ies)|c)\/[^/?#]+/i;
const PRODUCT_PREFIX_RE = /\/(?:products?|productos?|producto|p)\/[^/?#]+/i;

function genericCategoryHandle(href: string, baseUrl: string): string | null {
  const url = sameSite(href, baseUrl);
  if (!url) return null;
  if (!isCategoryUrl(url.href) && !CATEGORY_PREFIX_RE.test(url.pathname)) return null;
  const handle = handleFromUrl(url.href);
  return handle && !/^(?:all|todos?|todas|shop|tienda)$/.test(handle) ? handle : null;
}

function genericProductHandle(href: string, baseUrl: string): string | null {
  const url = sameSite(href, baseUrl);
  if (!url) return null;
  if (!isProductUrl(url.href) && !PRODUCT_PREFIX_RE.test(url.pathname)) return null;
  return handleFromUrl(url.href) || null;
}

type LinkMatch = { at: number; end: number; href: string; inner: string };

function links(part: string): LinkMatch[] {
  const out: LinkMatch[] = [];
  for (const m of part.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (m.index == null) continue;
    const href = attr(`<a ${m[1]}>`, "href");
    if (href) out.push({ at: m.index, end: m.index + m[0].length, href, inner: m[2] });
  }
  return out;
}

/// El nombre de la categoría: el texto del link (sin el "(12)" de
/// WooCommerce), el alt de su foto o, de última, el de la URL.
function categoryLabel(link: LinkMatch): { label: string; fromText: boolean } {
  const text = stripTags(link.inner).replace(/\s*\(\d+\)\s*$/, "").slice(0, 40);
  if (text) return { label: text, fromText: true };
  const img = link.inner.match(/<img\b[^>]*>/i)?.[0];
  const alt = img ? attr(img, "alt") : null;
  return alt && looksLikeText(alt) ? { label: alt.slice(0, 40), fromText: true } : { label: categoryNameFromUrl(link.href), fromText: false };
}

/// Un alt escrito por una persona, no el nombre del archivo
/// ("Lanzamientos-profecioales", "IMG_2031.jpg").
function looksLikeText(alt: string) {
  const value = alt.trim();
  if (!value || /\.(?:jpe?g|png|webp|gif|svg)$/i.test(value) || /^(?:img|dsc|image|photo)[-_ ]?\d+/i.test(value)) return false;
  return value.includes(" ") || !/[-_]/.test(value);
}

/// Un link traducido a la forma de Shopify (lo que entiende la
/// importación); anclas y links que no existen acá quedan vacíos.
function mapHref(href: string | null, baseUrl: string) {
  if (!href || href.trim().startsWith("#")) return "";
  const mapped = menuHrefToShopify(href, baseUrl, new Set());
  if (mapped && mapped !== "/") return mapped.slice(0, 300);
  // Una página de la tienda vieja: queda enlazada si también se importa
  // (ver pageSlugByHandle en shopify-sections-import-service.ts).
  const url = sameSite(href, baseUrl);
  return url && isStorePagePath(url) ? `/pages/${handleFromUrl(url.href)}`.slice(0, 300) : "";
}

/// El contenido de una página armada con un constructor, listo para
/// guardarse como página de Marcolini (el saneador quita los <div> y deja
/// títulos, párrafos, listas, links, fotos y videos).
function cleanBuilderContent(scope: string, baseUrl: string) {
  let out = scope.replace(/<!--[\s\S]*?-->/g, "");
  out = removeElements(out, /<(?:script|style|noscript|template|svg|form|nav|aside|header|footer|button|select|input|textarea)\b/);
  out = removeElements(out, HIDDEN_ON_DESKTOP_RE);
  out = removeElements(out, NOISE_BLOCK_RE);
  // Las tarjetas de producto de WooCommerce (foto, "Seleccionar
  // opciones", precio) no son contenido de la página: los productos ya
  // viven en las colecciones de acá. Tampoco los textos solo para lector
  // de pantalla ni los botones de carrito.
  out = removeElements(out, /<(?:li|div|article)\b[^>]*\bclass=["'][^"']*\b(?:type-product|wc-block-grid__product|product-category)\b[^"']*["']/);
  out = removeElements(out, /<(?:ul|div)\b[^>]*\bclass=["'][^"']*\b(?:products|wc-block-grid)\b[^"']*["']/);
  out = removeElements(out, /<(?:span|p|div|a)\b[^>]*\bclass=["'][^"']*\b(?:screen-reader-text|sr-only|visually-hidden|add_to_cart_button|added_to_cart|wc-forward)\b[^"']*["']/);
  out = out.replace(/<(?:picture|source)\b[^>]*>|<\/picture>/gi, "");
  out = out.replace(/<img\b[^>]*>/gi, (tag) => {
    if (tinyImageTag(tag)) return "";
    const url = imageUrlOf(tag, baseUrl);
    if (!url || !/^https?:/.test(url) || IMAGE_NOISE_RE.test(url)) return "";
    const alt = (attr(tag, "alt") ?? "").replace(/"/g, "&quot;");
    return `<img src="${url}" alt="${alt}">`;
  });
  return out;
}

function headingText(part: string, max = 120) {
  const text = firstText(part, "h1|h2|h3", max);
  if (text) return text;
  const styled = part.match(/<(div|span|p|h4|h5)\b[^>]*class=["'][^"']*(?:heading|title|headline)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i);
  return styled ? stripTags(styled[2]).slice(0, max) : "";
}

function subtitleText(part: string, max = 240) {
  const paragraphs = allParagraphs(part, max);
  if (paragraphs) return paragraphs;
  const styled = part.match(/<(div|span)\b[^>]*class=["'][^"']*(?:description|subtitle|sub-title|caption|text-editor)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i);
  return styled ? stripTags(styled[2]).slice(0, max) : "";
}

/// El primer botón con link a algo que exista acá (colección, producto,
/// catálogo). Un botón a una página de la tienda vieja no se trae.
function genericButton(part: string, baseUrl: string) {
  for (const m of part.matchAll(/<a\b([^>]*class=["'][^"']*(?:button|btn|cta)[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(`<a ${m[1]}>`, "href");
    const text = stripTags(m[2]).slice(0, 40);
    if (!href || !text) continue;
    const mapped = mapHref(href, baseUrl);
    if (mapped) return { text, href: mapped };
  }
  return { text: "", href: "" };
}

/// El último título (h1–h3) justo antes de un tramo — el "Compra por
/// categoría" arriba de la cuadrícula — que no sea parte de otra sección.
function lastHeadingBefore(scope: string, index: number, ranges: Range[], maxBack = 2500): { at: number; end: number; text: string } | null {
  const from = Math.max(0, index - maxBack);
  let best: { at: number; end: number; text: string } | null = null;
  for (const m of scope.slice(from, index).matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (m.index == null) continue;
    const at = from + m.index;
    if (inRanges(at, ranges)) continue;
    const text = stripTags(m[2]).slice(0, 120);
    if (text) best = { at, end: at + m[0].length, text };
  }
  return best;
}

function countMatches(part: string, re: RegExp) {
  return (part.match(re) ?? []).length;
}

/// Una foto del contenido con lo que hace falta para clasificarla: medidas
/// declaradas, el link que la envuelve y si ese link es a un producto o
/// categoría.
type Picture = { at: number; end: number; url: string; width: number; height: number; link: LinkMatch | null; catalog: boolean };

function picturesOf(scope: string, baseUrl: string, allLinks: LinkMatch[]): Picture[] {
  const out: Picture[] = [];
  for (const m of scope.matchAll(/<img\b[^>]*>/gi)) {
    if (m.index == null) continue;
    const tag = m[0];
    if (tinyImageTag(tag)) continue;
    const url = imageUrlOf(tag, baseUrl);
    if (!url || !/^https?:/.test(url) || IMAGE_NOISE_RE.test(url)) continue;
    const index = m.index;
    const link = allLinks.find((l) => index >= l.at && index < l.end) ?? null;
    const catalog = Boolean(link && (genericProductHandle(link.href, baseUrl) || genericCategoryHandle(link.href, baseUrl)));
    out.push({
      at: index,
      end: index + tag.length,
      url,
      width: parseInt(attr(tag, "width") ?? "", 10) || 0,
      height: parseInt(attr(tag, "height") ?? "", 10) || 0,
      link,
      catalog,
    });
  }
  return out;
}

/// Qué sección es una lista de productos: por lo que dice su título o por
/// el bloque que la arma. "Novedades" y "Ofertas" acá se arman solas (y la
/// marca puede cambiarlas); una lista larga de "todos los productos" es
/// el catálogo; lo demás, productos elegidos a mano.
function productListSection(classAttr: string, title: string, productHandles: string[]): ShopifyHomeSection {
  if (/product-new|\bnew-products\b|recent-products/i.test(classAttr) || NEW_PRODUCTS_RE.test(title)) return { type: "NEW_PRODUCTS", title };
  if (/product-on-sale|\bon-sale\b|sale-products/i.test(classAttr) || ON_SALE_RE.test(title)) return { type: "ON_SALE_PRODUCTS", title };
  if (productHandles.length >= 12 && (!title || CATALOG_TITLE_RE.test(title))) return { type: "PRODUCT_CATALOG", title };
  return { type: "FEATURED_PRODUCTS", productHandles: productHandles.slice(0, 8), title };
}

export function extractGenericHomeSections(html: string, baseUrl: string, extraCss = ""): ShopifyHomeSection[] {
  const backgrounds = parseCssBackgrounds(`${inlineStyles(html)}\n${extraCss}`);
  const scope = homeScope(html);
  const placed: PlacedSection[] = [];
  const ranges: Range[] = [];
  const take = (start: number, end: number) => ranges.push({ start, end });
  const titleBefore = (index: number) => {
    const heading = lastHeadingBefore(scope, index, ranges);
    if (!heading) return "";
    take(heading.at, heading.end);
    return heading.text;
  };

  // 1) Sliders, heros y banners: un contenedor con pinta de slider/banner
  // o una sección con foto de fondo (en el HTML o en el CSS), que no
  // envuelva medio sitio. Con slides, cada foto lleva el link de su slide.
  for (const m of scope.matchAll(/<(?:div|section|figure|header|article)\b[^>]*>/gi)) {
    if (m.index == null || inRanges(m.index, ranges)) continue;
    const tag = m[0];
    const classAttr = attr(tag, "class") ?? "";
    const key = `${classAttr} ${attr(tag, "id") ?? ""}`;
    const isInstagram = INSTAGRAM_RE.test(key);
    const isBrands = BRAND_ROW_RE.test(key);
    const isGallery = GALLERY_RE.test(key);
    const isBanner =
      BANNER_TOKEN_RE.test(key) ||
      (SECTION_TOKEN_RE.test(key) && (tagHasBackgroundImage(tag) || cssBackgroundFor(classAttr, backgrounds, baseUrl) != null));
    if ((!isBanner && !isInstagram && !isBrands && !isGallery) || PRODUCT_CARD_RE.test(classAttr)) continue;
    const end = elementEndAt(scope, m.index);
    if (end == null) continue;
    const whole = scope.slice(m.index, end);
    const inner = whole.slice(tag.length);
    // Un feed de Instagram (plugin, widget o bloque): acá es la invitación
    // a seguir la cuenta de la marca.
    if (isInstagram) {
      if (!placed.some((p) => p.section.type === "INSTAGRAM_CTA")) {
        placed.push({ at: m.index, section: { type: "INSTAGRAM_CTA", title: headingText(inner, 80), description: subtitleText(inner, 160) } });
        take(m.index, end);
      }
      continue;
    }
    // Una fila de logos (marcas, clientes, aliados).
    if (isBrands) {
      const innerLinks = links(inner);
      const items: { imageUrl: string; link: string }[] = [];
      for (const img of inner.matchAll(/<img\b[^>]*>/gi)) {
        if (img.index == null || items.length >= 12) continue;
        const url = imageUrlOf(img[0], baseUrl);
        if (!url || !/^https?:/.test(url) || items.some((i) => imageKey(i.imageUrl) === imageKey(url))) continue;
        const wrapping = innerLinks.find((l) => img.index! >= l.at && img.index! < l.end);
        items.push({ imageUrl: url, link: mapHref(wrapping?.href ?? null, baseUrl) });
      }
      if (items.length >= 3) {
        placed.push({ at: m.index, section: { type: "BRAND_CAROUSEL", items } });
        take(m.index, end);
        continue;
      }
      if (!isBanner && !isGallery) continue;
    }
    const wrapperLike =
      inner.length > 80_000 ||
      PRODUCT_LIST_RE.test(inner) ||
      countMatches(inner, /<iframe\b/gi) > 0 ||
      countMatches(inner, /<h[1-3]\b/gi) >= 4 ||
      links(inner).filter((l) => genericProductHandle(l.href, baseUrl)).length >= 3 ||
      links(inner).filter((l) => genericCategoryHandle(l.href, baseUrl)).length >= 4;
    if (wrapperLike) continue;
    const images: string[] = [];
    const slideLinks: string[] = [];
    for (const slide of inner.matchAll(/<(?:div|li|figure|a)\b[^>]*class=["'][^"']*\b(?:swiper-slide|slick-slide|owl-item|n2-ss-slide|rs-slide|splide__slide|glide__slide|slide)\b[^"']*["'][^>]*>/gi)) {
      if (slide.index == null || images.length >= 6) continue;
      const slideEnd = elementEndAt(inner, slide.index);
      if (slideEnd == null) continue;
      const slideHtml = inner.slice(slide.index, slideEnd);
      const [image] = genericImages(slideHtml, baseUrl, 1, false, backgrounds);
      if (!image || images.some((u) => imageKey(u) === imageKey(image))) continue;
      images.push(image);
      slideLinks.push(mapHref(links(slideHtml)[0]?.href ?? null, baseUrl));
    }
    if (images.length === 0) {
      images.push(...genericImages(whole, baseUrl, 6, false, backgrounds));
      slideLinks.length = 0;
    }
    const title = headingText(inner);
    if (images.length === 0 && !title) continue;
    // Una galería (fotos cuadradas, sin título ni slides apaisadas) es un
    // carrusel de fotos; con fotos apaisadas o texto encima es un banner.
    if (isGallery && !title && images.length >= 2) {
      const imgTags = inner.match(/<img\b[^>]*>/gi) ?? [];
      const wide = imgTags.filter((t) => {
        const w = parseInt(attr(t, "width") ?? "", 10);
        const h = parseInt(attr(t, "height") ?? "", 10);
        return w > 0 && h > 0 && w / h >= 1.6;
      }).length;
      if (imgTags.length > 0 && wide < imgTags.length / 2) {
        placed.push({ at: m.index, section: { type: "IMAGE_CAROUSEL", images: images.slice(0, 8) } });
        take(m.index, end);
        continue;
      }
    }
    const button = genericButton(inner, baseUrl);
    placed.push({
      at: m.index,
      section: {
        type: "BANNER",
        images,
        title,
        subtitle: subtitleText(inner),
        buttonText: button.text,
        buttonHref: button.href,
        links: images.map((_, i) => slideLinks[i] ?? ""),
      },
    });
    take(m.index, end);
  }

  // 2) Listas de productos y de categorías de WooCommerce (ul.products,
  // bloques de Gutenberg, widgets de Elementor, tienda de Divi…).
  for (const m of scope.matchAll(/<(?:ul|ol|div|section)\b[^>]*class=["'][^"']*["'][^>]*>/gi)) {
    if (m.index == null || inRanges(m.index, ranges)) continue;
    const tag = m[0];
    if (!PRODUCT_LIST_RE.test(attr(tag, "class") ?? "")) continue;
    const end = elementEndAt(scope, m.index);
    if (end == null) continue;
    const inner = scope.slice(m.index + tag.length, end);
    const productHandles: string[] = [];
    const categories: { collectionHandle: string; imageUrl: string | null; label: string; fromText: boolean }[] = [];
    let firstLinkAt = inner.length;
    for (const link of links(inner)) {
      const product = genericProductHandle(link.href, baseUrl);
      if (product) {
        firstLinkAt = Math.min(firstLinkAt, link.at);
        if (!productHandles.includes(product)) productHandles.push(product);
        continue;
      }
      const category = genericCategoryHandle(link.href, baseUrl);
      if (!category) continue;
      firstLinkAt = Math.min(firstLinkAt, link.at);
      const imageUrl = genericImages(link.inner, baseUrl, 1)[0] ?? null;
      const label = categoryLabel(link);
      const existing = categories.find((c) => c.collectionHandle === category);
      if (existing) {
        if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
        if (label.fromText && !existing.fromText) Object.assign(existing, label);
      } else {
        categories.push({ collectionHandle: category, imageUrl, ...label });
      }
    }
    if (productHandles.length === 0 && categories.length === 0) continue;
    // El título del bloque: el h2 de adentro si va antes del primer link
    // (si no, es el nombre de un producto), o el último de antes.
    const own = inner.slice(0, firstLinkAt).match(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/i);
    const title = own ? stripTags(own[2]).slice(0, 120) : titleBefore(m.index);
    if (productHandles.length >= categories.length) {
      placed.push({ at: m.index, section: productListSection(attr(tag, "class") ?? "", title, productHandles) });
    } else {
      const items = categories.slice(0, 6).map(({ collectionHandle, imageUrl, label }) => ({ collectionHandle, imageUrl, label }));
      placed.push({ at: m.index, section: { type: "CATEGORY_GRID", title, items } });
    }
    take(m.index, end);
  }

  const allLinks = links(scope);
  const pictures = picturesOf(scope, baseUrl, allLinks);
  const consume = (picture: Picture) => (picture.link ? take(picture.link.at, picture.link.end) : take(picture.at, picture.end));

  // 3) Fila de íconos: tres o cuatro imágenes cuadradas y parejas seguidas
  // (envíos, pago seguro, WhatsApp…), fuera de los links a productos o
  // categorías. Cada una puede llevar su link (WhatsApp, por ejemplo).
  const iconCandidates = pictures.filter(
    (p) => !inRanges(p.at, ranges) && !p.catalog && p.width > 0 && p.width <= 800 && p.height > 0 && p.width / p.height >= 0.75 && p.width / p.height <= 1.34,
  );
  for (let i = 0; i < iconCandidates.length; i++) {
    const group = [iconCandidates[i]];
    while (
      i + 1 < iconCandidates.length &&
      iconCandidates[i + 1].at - group[group.length - 1].end < 3000 &&
      Math.abs(iconCandidates[i + 1].width - group[0].width) <= group[0].width * 0.25
    ) {
      group.push(iconCandidates[++i]);
    }
    if (group.length < 3 || group.length > 4) continue;
    const items = group.map((p) => {
      const alt = (scope.slice(p.at, p.end).match(/\balt=["']([^"']*)["']/i)?.[1] ?? "").trim();
      return { title: looksLikeText(alt) ? decodeEntities(alt).slice(0, 60) : "", description: "", imageUrl: p.url, link: mapHref(p.link?.href ?? null, baseUrl) };
    });
    placed.push({ at: group[0].at, section: { type: "INFO_COLUMNS", items } });
    for (const p of group) consume(p);
    break;
  }

  // 4) Banners anchos con link (una foto apaisada que lleva a una
  // colección o a una página): cada uno es un banner con su link.
  for (const p of pictures) {
    if (inRanges(p.at, ranges) || !p.link || p.width < 600 || p.height === 0 || p.width / p.height < 1.6) continue;
    placed.push({ at: p.at, section: { type: "BANNER", images: [p.url], title: "", subtitle: "", buttonText: "", buttonHref: "", links: [mapHref(p.link.href, baseUrl)] } });
    consume(p);
  }

  // 5) Links sueltos a categorías (cajas de imagen de Elementor, columnas
  // de Gutenberg): una sola cuadrícula con los primeros seis. Si alguna
  // trae foto, las que no traen (un botón "ver más") se dejan.
  const loose = allLinks.filter((l) => !inRanges(l.at, ranges));
  const looseCategories: { at: number; end: number; collectionHandle: string; imageUrl: string | null; imageWidth: number; label: string; fromText: boolean }[] = [];
  for (const link of loose) {
    const category = genericCategoryHandle(link.href, baseUrl);
    if (!category) continue;
    const imageUrl = genericImages(link.inner, baseUrl, 1)[0] ?? null;
    const imageWidth = parseInt(attr(link.inner.match(/<img\b[^>]*>/i)?.[0] ?? "", "width") ?? "", 10) || 0;
    const label = categoryLabel(link);
    const existing = looseCategories.find((c) => c.collectionHandle === category);
    if (existing) {
      if (!existing.imageUrl && imageUrl) {
        existing.imageUrl = imageUrl;
        existing.imageWidth = imageWidth;
      }
      if (label.fromText && !existing.fromText) Object.assign(existing, label);
      existing.end = link.end;
    } else {
      looseCategories.push({ at: link.at, end: link.end, collectionHandle: category, imageUrl, imageWidth, label: label.label, fromText: label.fromText });
    }
  }
  const gridCategories = looseCategories.some((c) => c.imageUrl) ? looseCategories.filter((c) => c.imageUrl) : looseCategories;
  if (gridCategories.length >= 2) {
    const first = gridCategories[0];
    for (const c of looseCategories) take(c.at, c.end);
    // Dos o tres categorías con foto grande: banners de categoría; más, o
    // con fotos chicas: la cuadrícula.
    if (gridCategories.length <= 3 && gridCategories.every((c) => c.imageWidth >= 500)) {
      const items = gridCategories.map(({ collectionHandle, imageUrl, label }) => ({ collectionHandle, imageUrl, label }));
      titleBefore(first.at);
      placed.push({ at: first.at, section: { type: "CATEGORY_BANNERS", items } });
    } else {
      const items = gridCategories.slice(0, 6).map(({ collectionHandle, imageUrl, label }) => ({ collectionHandle, imageUrl, label }));
      placed.push({ at: first.at, section: { type: "CATEGORY_GRID", title: titleBefore(first.at), items } });
    }
  }

  // 6) Links sueltos a productos: desde tres, una lista de destacados.
  const looseProducts: { at: number; end: number; handle: string }[] = [];
  for (const link of loose) {
    if (inRanges(link.at, ranges)) continue;
    const handle = genericProductHandle(link.href, baseUrl);
    if (handle && !looseProducts.some((p) => p.handle === handle)) looseProducts.push({ at: link.at, end: link.end, handle });
  }
  if (looseProducts.length >= 3) {
    for (const p of looseProducts) take(p.at, p.end);
    placed.push({
      at: looseProducts[0].at,
      section: { type: "FEATURED_PRODUCTS", productHandles: looseProducts.slice(0, 8).map((p) => p.handle), title: titleBefore(looseProducts[0].at) },
    });
  }

  // 7) Fotos grandes sueltas (un banner promocional puesto como imagen):
  // desde 900 px de ancho declarado; si está dentro de un link a un
  // producto o categoría solo cuenta con el ancho declarado (la foto de
  // un producto trae srcset grande pero width chico).
  let standalone = 0;
  for (const p of pictures) {
    if (standalone >= 3 || inRanges(p.at, ranges)) continue;
    const tag = scope.slice(p.at, p.end);
    const srcset = attr(tag, "data-lazy-srcset") ?? attr(tag, "data-srcset") ?? attr(tag, "srcset");
    const big = p.width >= 900 || (!p.catalog && !p.width && Boolean(srcset) && /\b(?:1[4-9]\d{2}|[2-9]\d{3}|\d{5,})w\b/.test(srcset ?? ""));
    if (!big) continue;
    const href = mapHref(p.link?.href ?? null, baseUrl);
    placed.push({ at: p.at, section: { type: "BANNER", images: [p.url], title: "", subtitle: "", buttonText: "", buttonHref: href, links: [href] } });
    consume(p);
    standalone++;
  }

  // 8) Videos de YouTube/Vimeo: iframes, el widget de Elementor y
  // lite-youtube.
  const videos: { at: number; end: number; url: string }[] = [];
  for (const m of scope.matchAll(/<iframe\b[^>]*>/gi)) {
    if (m.index == null) continue;
    const src = attr(m[0], "src") ?? attr(m[0], "data-src") ?? attr(m[0], "data-lazy-src");
    if (src && /youtube|youtu\.be|vimeo/i.test(src)) videos.push({ at: m.index, end: m.index + m[0].length, url: src });
  }
  for (const m of scope.matchAll(/(?:youtube_url|vimeo_url)(?:&quot;|"):(?:&quot;|")([^"&]+)(?:&quot;|")/gi)) {
    if (m.index != null) videos.push({ at: m.index, end: m.index + m[0].length, url: m[1].replace(/\\\//g, "/") });
  }
  for (const m of scope.matchAll(/<lite-youtube\b[^>]*videoid=["']([^"']+)["']/gi)) {
    if (m.index != null) videos.push({ at: m.index, end: m.index + m[0].length, url: `https://www.youtube.com/watch?v=${m[1]}` });
  }
  videos.sort((a, b) => a.at - b.at);
  const seenVideos = new Set<string>();
  for (const video of videos) {
    if (inRanges(video.at, ranges) || seenVideos.has(video.url) || seenVideos.size >= 2) continue;
    seenVideos.add(video.url);
    placed.push({ at: video.at, section: { type: "VIDEO", url: decodeEntities(video.url).slice(0, 300), title: titleBefore(video.at) } });
    take(video.at, video.end);
  }

  // 9) Columnas informativas con texto: tres o cuatro cajitas seguidas con
  // título corto (envío gratis, pago seguro…).
  const infoItems: { at: number; end: number; title: string; description: string }[] = [];
  for (const m of scope.matchAll(/<(?:div|li|article)\b[^>]*class=["'][^"']*["'][^>]*>/gi)) {
    if (m.index == null || inRanges(m.index, ranges)) continue;
    if (!INFO_ITEM_RE.test(attr(m[0], "class") ?? "")) continue;
    if (infoItems.length > 0 && m.index < infoItems[infoItems.length - 1].end) continue;
    const end = elementEndAt(scope, m.index);
    if (end == null) continue;
    const inner = scope.slice(m.index + m[0].length, end);
    const text = stripTags(inner);
    const title = firstText(inner, "h2|h3|h4|h5|h6", 60) || headingText(inner, 60);
    if (!title || title.length < 2 || text.length > 260 || genericImages(inner, baseUrl, 1, true).length > 0) continue;
    if (links(inner).some((l) => genericCategoryHandle(l.href, baseUrl) || genericProductHandle(l.href, baseUrl))) continue;
    const description = allParagraphs(inner, 120) || text.replace(title, "").trim().slice(0, 120);
    infoItems.push({ at: m.index, end, title, description });
  }
  for (let i = 0; i < infoItems.length; i++) {
    const group = [infoItems[i]];
    while (group.length < 4 && i + 1 < infoItems.length && infoItems[i + 1].at - group[group.length - 1].end < 3000) group.push(infoItems[++i]);
    if (group.length < 2) continue;
    placed.push({ at: group[0].at, section: { type: "INFO_COLUMNS", items: group.map(({ title, description }) => ({ title, description })) } });
    take(group[0].at, group[group.length - 1].end);
    break;
  }

  // 10) Texto: un título con párrafos debajo (hasta el siguiente título o
  // la siguiente sección ya tomada). Con una foto grande es un banner con
  // texto; sin foto, un bloque de texto.
  let texts = 0;
  for (const m of scope.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    if (m.index == null || texts >= 3 || inRanges(m.index, ranges)) continue;
    const heading = stripTags(m[2]).slice(0, 120);
    if (!heading) continue;
    if (/instagram/i.test(heading)) {
      if (!placed.some((p) => p.section.type === "INSTAGRAM_CTA")) {
        placed.push({ at: m.index, section: { type: "INSTAGRAM_CTA", title: heading.slice(0, 80), description: "" } });
        take(m.index, m.index + m[0].length);
      }
      continue;
    }
    if (NOISE_HEADING_RE.test(heading)) continue;
    const bodyStart = m.index + m[0].length;
    let bodyEnd = Math.min(scope.length, bodyStart + 8000);
    const next = scope.slice(bodyStart, bodyEnd).search(/<h[1-3]\b/i);
    if (next >= 0) bodyEnd = bodyStart + next;
    for (const r of ranges) if (r.start >= bodyStart && r.start < bodyEnd) bodyEnd = r.start;
    const region = scope.slice(bodyStart, bodyEnd);
    const body = allParagraphs(region, 2000);
    if (body.length < 60) continue;
    const image = genericImages(region, baseUrl, 1, true)[0];
    if (image) {
      const button = genericButton(region, baseUrl);
      placed.push({ at: m.index, section: { type: "BANNER", images: [image], title: heading, subtitle: body.slice(0, 240), buttonText: button.text, buttonHref: button.href, links: [""] } });
    } else {
      placed.push({ at: m.index, section: { type: "TEXT", heading, body } });
    }
    take(m.index, bodyEnd);
    texts++;
  }

  return placed
    .sort((a, b) => a.at - b.at)
    .map((p) => p.section)
    .slice(0, MAX_HOME_SECTIONS);
}

// ----------------------------------------------------------------------------
// Esquema de la portada para la copia fiel con IA (2026-10-19)
// ----------------------------------------------------------------------------
//
// La IA no escribe la portada: recibe la lista de lo que la portada
// original muestra, en orden (títulos, textos, fotos, botones, listas de
// productos, videos), cada cosa con un id, y responde qué sección de
// Marcolini arma cada grupo citando esos ids. Los textos, las fotos y los
// links salen de acá tal cual (ver home-copy.ts). Pedido el 2026-10-19:
// "que la IA se dedique a hacer una copia fiel de la tienda original, con
// sus secciones, imágenes, textos iguales, fuentes, colores".

export type HomeOutlineItem =
  /// Comienzo de un bloque de la página (una sección de Shopify, una
  /// sección de Elementor…), con lo que dice su nombre o sus clases y sus
  /// colores cuando no son los de la página.
  | { id: string; kind: "section"; hint: string; background: string | null; textColor: string | null }
  /// `href`: el título o texto es en sí un link (el nombre de una
  /// categoría en su tarjeta, por ejemplo).
  | { id: string; kind: "heading"; level: number; text: string; href: string }
  | { id: string; kind: "text"; text: string; href: string }
  /// "pequeña": un ícono o logo.
  | { id: string; kind: "image"; url: string; alt: string; href: string; shape: OutlineImageShape }
  /// Un botón o link con texto.
  | { id: string; kind: "link"; text: string; href: string }
  /// Tarjetas de producto seguidas (una lista o carrusel).
  | { id: string; kind: "products"; handles: string[] }
  | { id: string; kind: "video"; url: string };

export type OutlineImageShape = "ancha" | "cuadrada" | "alta" | "pequeña" | null;
export type HomeOutline = { items: HomeOutlineItem[]; truncated: boolean };

export const OUTLINE_MAX_ITEMS = 320;
const OUTLINE_TEXT_MAX = 600;
const OUTLINE_HEADING_MAX = 160;
const OUTLINE_LINK_TEXT_MAX = 80;
/// Secciones de Shopify que no son contenido de la portada, o que acá no
/// se pueden copiar (el formulario del boletín).
const SHOPIFY_SECTION_SKIP_RE = /header|footer|announcement|newsletter|email|cart|popup|search|password/;
/// Tarjetas de producto de los temas más usados (Dawn, Horizon, Impulse,
/// WooCommerce, Tiendanube, Flatsome…): en el esquema quedan solo como el
/// producto al que apuntan, sin su foto, precio ni botones.
const PRODUCT_CARD_OPEN_RE =
  /<(?:li|div|article|product-card)\b[^>]*\bclass=["'][^"']*\b(?:card-wrapper|product-card(?:-wrapper)?|card--product|product-item|grid-product|product-grid-item|productitem|product-block|type-product|wc-block-grid__product|product-small|product-miniature|item-product|js-item-product|product-thumb|product-tile)\b[^"']*["'][^>]*>/i;
/// Copias de slides que arman los carruseles (Slick, Swiper) para girar.
const SLIDE_CLONE_RE = /<(?:div|li)\b[^>]*\bclass=["'][^"']*\b(?:slick-cloned|swiper-slide-duplicate)\b[^"']*["'][^>]*>/i;
/// Lo que el tema esconde en computador (la versión para celular).
const DESKTOP_HIDDEN_RE =
  /<(?:div|section|span|figure|picture|li|a)\b[^>]*\bclass=["'][^"']*(?:\blarge-up-hide\b|\bmedium-up--hide\b|\bhide-desktop\b|\bhidden-desktop\b|\bmobile-only\b|\bmd:hidden\b|\blg:hidden\b)[^"']*["'][^>]*>/i;
/// Textos solo para lectores de pantalla ("Precio habitual", "Siguiente").
const SCREEN_READER_RE =
  /<(?:span|div|p|h[1-6]|label|small|a)\b[^>]*\bclass=["'][^"']*\b(?:visually-hidden|sr-only|screen-reader-text|hidden-text|skip-to-content-link)\b[^"']*["'][^>]*>/i;
/// Textos de tarjetas y controles que no son contenido de la portada.
const OUTLINE_NOISE_TEXT_RE =
  /^(?:precio(?: (?:habitual|de venta|de oferta|unitario|regular|normal))?|por|oferta|agotado|vendido|sold out|sale|añadir al carrito|agregar al carrito|add to cart|ver opciones|seleccionar opciones|elegir opciones|cerrar|anterior|siguiente|previous|next|pausar|reproducir|play|pause|cargando…?|loading…?|cantidad|impuesto incluido\.?|oferta\s*\/\s*agotado|\d+\s*\/\s*\d+|\d+\s+de\s+\d+|(?:desde\s*)?(?:col)?\$\s*[\d.,]+(?:\s*(?:cop|usd))?(?:\s*[-–]\s*\$?\s*[\d.,]+)?|\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?(?:\s*cop)?)$/i;
/// Fotos que nunca son contenido (las de siempre de IMAGE_NOISE_RE, sin
/// los íconos y logos: acá sirven para sellos y tiras de marcas).
const OUTLINE_IMAGE_NOISE_RE = /placeholder|data:image|\/wp-includes\/|spinner|preloader|blank\.|1x1|gravatar|emoji|favicon|captcha|\.gif(?:\?|$)/i;
/// Etiquetas que cortan un texto corrido: cada una empieza o termina un
/// párrafo, un título o una tarjeta.
const OUTLINE_BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "li", "ul", "ol", "blockquote", "figure", "figcaption", "table", "tr", "td", "th",
  "dl", "dt", "dd", "details", "summary", "header", "footer", "main", "aside", "nav", "label", "cite",
]);

function imageShape(tag: string): OutlineImageShape {
  if (tinyImageTag(tag)) return "pequeña";
  const width = parseInt(attr(tag, "width") ?? "", 10);
  const height = parseInt(attr(tag, "height") ?? "", 10);
  if (!(width > 0 && height > 0)) return null;
  const ratio = width / height;
  if (ratio >= 1.6) return "ancha";
  if (ratio <= 0.85) return "alta";
  return "cuadrada";
}

type OutlineBuilder = {
  items: HomeOutlineItem[];
  truncated: boolean;
  seenImages: Set<string>;
  /// Lo ya puesto en el bloque actual: los carruseles de texto y las
  /// versiones para celular repiten lo mismo.
  seenTexts: Set<string>;
  pendingProducts: string[];
  baseUrl: string;
  backgrounds: CssBackground[];
  /// Los links de Shopify ya vienen en su forma (/pages/x, /collections/y);
  /// los de las demás se traducen (ver mapHref).
  shopify: boolean;
};

/// Un elemento del esquema todavía sin id (el Omit repartido en cada caso).
type OutlineInput = HomeOutlineItem extends infer T ? (T extends HomeOutlineItem ? Omit<T, "id"> : never) : never;

function outlinePush(b: OutlineBuilder, item: OutlineInput) {
  if (item.kind !== "products") outlineFlushProducts(b);
  if (b.items.length >= OUTLINE_MAX_ITEMS) {
    b.truncated = true;
    return;
  }
  if (item.kind === "section") b.seenTexts = new Set();
  if ("text" in item) {
    // Con su link: varias tarjetas que dicen "COMPRA AQUÍ" llevan a
    // categorías distintas y van todas.
    const key = `${item.kind}:${item.text.toLowerCase()}|${"href" in item ? item.href : ""}`;
    if (b.seenTexts.has(key)) return;
    b.seenTexts.add(key);
  }
  const prefix = { section: "S", heading: "H", text: "T", image: "I", link: "L", products: "P", video: "V" }[item.kind];
  b.items.push({ ...item, id: `${prefix}${b.items.length + 1}` } as HomeOutlineItem);
}

function outlineFlushProducts(b: OutlineBuilder) {
  if (b.pendingProducts.length === 0) return;
  const handles = b.pendingProducts.slice(0, 24);
  b.pendingProducts = [];
  outlinePush(b, { kind: "products", handles });
}

function outlineImage(b: OutlineBuilder, url: string | null, tag: string, href: string) {
  if (!url || !/^https?:/.test(url) || OUTLINE_IMAGE_NOISE_RE.test(url)) return;
  if (/\b(?:emoji|wp-smiley|payment|icon--payment)\b/i.test(`${attr(tag, "class") ?? ""}`)) return;
  const key = imageKey(url);
  if (b.seenImages.has(key)) return;
  b.seenImages.add(key);
  const alt = (attr(tag, "alt") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  outlinePush(b, { kind: "image", url, alt, href, shape: imageShape(tag) });
}

/// Una foto de fondo en la etiqueta que abre un contenedor (inline, data-bg
/// o por el CSS de Elementor).
function outlineBackground(b: OutlineBuilder, tag: string, href: string) {
  if (!tagHasBackgroundImage(tag) && !(b.backgrounds.length > 0 && /\belementor-(?:repeater-item|element)-/.test(tag))) return;
  const [url] = genericImages(tag, b.baseUrl, 1, false, b.backgrounds);
  if (url) outlineImage(b, url, tag, href);
}

/// Un texto corrido sin espacios de más; los saltos de línea (<br>) quedan.
function cleanRun(text: string) {
  return text
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/// Recorre un bloque etiqueta por etiqueta y deja, en orden, sus títulos,
/// párrafos, botones, fotos (también las de fondo), videos y productos.
/// Un texto que está entero dentro de un link lleva ese link.
function outlineScan(b: OutlineBuilder, html: string) {
  type OpenAnchor = { href: string; product: string | null; button: boolean; run: number };
  let run = "";
  let runPlain = "";
  let runId = 0;
  let runAnchors: { text: string; href: string; button: boolean }[] = [];
  let heading = 0;
  let anchor: OpenAnchor | null = null;
  let anchorText = "";

  const flush = () => {
    const value = cleanRun(run);
    const plain = cleanRun(runPlain);
    const anchors = runAnchors;
    run = "";
    runPlain = "";
    runAnchors = [];
    runId++;
    // Un link que sigue abierto (una tarjeta entera) ya dejó su texto acá.
    anchorText = "";
    if (!value || OUTLINE_NOISE_TEXT_RE.test(value)) return;
    // El texto entero es un link: uno que abrió en este tramo y ya cerró,
    // o uno que sigue abierto (una tarjeta con link que envuelve todo).
    const whole =
      !plain && anchors.length === 1 && cleanRun(anchors[0].text) === value
        ? anchors[0]
        : !plain && anchors.length === 0 && anchor && !anchor.product
          ? { text: value, href: anchor.href, button: anchor.button }
          : null;
    if (heading) {
      outlinePush(b, { kind: "heading", level: heading, text: value.slice(0, OUTLINE_HEADING_MAX), href: whole?.href ?? "" });
    } else if (whole && whole.href && (whole.button || value.length <= OUTLINE_LINK_TEXT_MAX)) {
      outlinePush(b, { kind: "link", text: value.slice(0, OUTLINE_LINK_TEXT_MAX), href: whole.href });
    } else if (value.length >= 2) {
      outlinePush(b, { kind: "text", text: value.slice(0, OUTLINE_TEXT_MAX), href: whole?.href ?? "" });
    }
  };

  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>|([^<]+)/g)) {
    if (b.truncated) return;
    if (m[4] !== undefined) {
      // El nombre y el precio de un producto no van: el producto ya queda.
      if (anchor?.product) continue;
      const text = decodeEntities(m[4]);
      run += text;
      if (anchor) anchorText += text;
      else runPlain += text;
      continue;
    }
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const whole = m[0];
    if (tag === "br") {
      run += "\n";
      continue;
    }
    if (tag === "a") {
      if (closing) {
        if (anchor?.product) {
          if (!b.pendingProducts.includes(anchor.product)) b.pendingProducts.push(anchor.product);
        } else if (anchor && anchor.run === runId && anchorText.trim()) {
          runAnchors.push({ text: anchorText, href: anchor.href, button: anchor.button });
        }
        anchor = null;
        anchorText = "";
        continue;
      }
      // Links seguidos sin texto entre ellos (botones, un nombre y su
      // precio): cada uno por su lado.
      if (runAnchors.length > 0 && !cleanRun(runPlain)) flush();
      const href = attr(whole, "href");
      const product = href ? genericProductHandle(href, b.baseUrl) : null;
      anchor = { href: outlineHref(b, href), product, button: /\b(?:button|btn|cta)\b/i.test(attr(whole, "class") ?? ""), run: runId };
      anchorText = "";
      if (!product) outlineBackground(b, whole, anchor.href);
      continue;
    }
    if (/^h[1-6]$/.test(tag)) {
      flush();
      heading = closing ? 0 : Number(tag[1]);
      if (anchor) anchor.run = runId;
      continue;
    }
    if (OUTLINE_BLOCK_TAGS.has(tag)) {
      flush();
      if (anchor) anchor.run = runId;
      if (!closing && !anchor?.product) outlineBackground(b, whole, anchor?.href ?? "");
      continue;
    }
    if (closing) continue;
    if (tag === "img") {
      // La foto de un producto solo cuenta si es un banner (ancha).
      if (anchor?.product && imageShape(whole) !== "ancha") continue;
      const href = anchor ? (anchor.product ? `/products/${anchor.product}` : anchor.href) : "";
      outlineImage(b, imageUrlOf(whole, b.baseUrl), whole, href);
      continue;
    }
    if (tag === "iframe") {
      const src = attr(whole, "src") ?? attr(whole, "data-src") ?? "";
      if (/youtube|youtu\.be|vimeo/i.test(src)) outlinePush(b, { kind: "video", url: decodeEntities(src).slice(0, 300) });
      continue;
    }
    if (tag === "video") {
      // Un video propio no se puede copiar: queda su foto de portada.
      const poster = attr(whole, "poster");
      if (poster) outlineImage(b, absoluteUrl(poster, b.baseUrl), whole, anchor?.href ?? "");
      continue;
    }
    if (!anchor?.product) outlineBackground(b, whole, anchor?.href ?? "");
  }
  flush();
  outlineFlushProducts(b);
}

/// Un link del esquema en la forma de Shopify (ver cleanHref y mapHref):
/// las anclas, el carrito y lo que no existe acá quedan vacíos; los de
/// afuera (Instagram, WhatsApp) quedan tal cual.
function outlineHref(b: OutlineBuilder, href: string | null) {
  if (!href) return "";
  return b.shopify ? (cleanHref(href, b.baseUrl) ?? "").slice(0, 300) : mapHref(href, b.baseUrl);
}

/// Cada tarjeta de producto queda como un link vacío a su producto (ver
/// PRODUCT_CARD_OPEN_RE). Una "tarjeta" que no apunta a un producto (la de
/// una colección) queda igual.
function collapseProductCards(html: string, baseUrl: string): string {
  const re = new RegExp(PRODUCT_CARD_OPEN_RE.source, "gi");
  let out = "";
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index < cursor) continue;
    const end = elementEndAt(html, m.index);
    if (end == null) continue;
    let handle: string | null = null;
    for (const link of html.slice(m.index, end).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
      handle = genericProductHandle(link[1], baseUrl);
      if (handle) break;
    }
    if (!handle) continue;
    out += `${html.slice(cursor, m.index)}<a href="/products/${handle}"></a>`;
    cursor = end;
    re.lastIndex = end;
  }
  return out + html.slice(cursor);
}

/// Un bloque listo para recorrer: sin scripts, formularios, botones de
/// control, copias de slides, versión para celular ni textos ocultos, y
/// con las tarjetas de producto resumidas.
function outlineReady(block: string, baseUrl: string) {
  let out = removeElements(block.replace(/<!--[\s\S]*?-->/g, ""), /<(?:script|style|noscript|template|svg|form|button|select|input|textarea)\b/);
  out = removeElements(out, SLIDE_CLONE_RE);
  out = removeElements(out, DESKTOP_HIDDEN_RE);
  out = removeElements(out, HIDDEN_ON_DESKTOP_RE);
  out = removeElements(out, SCREEN_READER_RE);
  return collapseProductCards(out, baseUrl);
}

// --- Colores de cada bloque ---

type CssColorRule = { selector: string; color: string };

function parseCssBackgroundColors(css: string): CssColorRule[] {
  const out: CssColorRule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const value = m[2].match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;}]+)/i)?.[1]?.replace(/!important/i, "").trim();
    if (!value) continue;
    const color = cssColorToHex(value) ?? cssColorToHex(value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i)?.[0] ?? "");
    if (color) out.push({ selector: m[1].trim(), color });
  }
  return out;
}

type OutlineColors = { schemes: SchemeBlock[]; props: Map<string, string[]>; rules: CssColorRule[]; page: string };

/// El fondo y el texto de un bloque: por el esquema de color de Shopify
/// que usa ("color-scheme-2"), por su estilo en línea o por el CSS de
/// Elementor de su id. Si es el mismo fondo de la página, nada.
function blockColors(block: string, c: OutlineColors): { background: string | null; textColor: string | null } {
  const head = block.slice(0, 1500);
  let background: string | null = null;
  let textColor: string | null = null;
  const names = new Set(c.schemes.map((s) => s.name));
  for (const m of head.matchAll(/\b(color-[a-z0-9_-]+)\b/gi)) {
    const name = m[1].toLowerCase();
    if (!names.has(name)) continue;
    const scheme = c.schemes.find((s) => s.name === name)!;
    const props = new Map(c.props);
    for (const [key, values] of scheme.props) props.set(key, [...values, ...(c.props.get(key) ?? [])]);
    background = firstColor(props, BACKGROUND_PROPS);
    textColor = firstColor(props, TEXT_PROPS);
    break;
  }
  if (!background) {
    for (const tag of (head.match(/<[a-z][^>]*>/gi) ?? []).slice(0, 3)) {
      const style = attr(tag, "style") ?? "";
      const value = style.match(/background(?:-color)?\s*:\s*([^;]+)/i)?.[1];
      const color = value ? (cssColorToHex(value.trim(), c.props) ?? cssColorToHex(value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i)?.[0] ?? "")) : null;
      if (color) {
        background = color;
        break;
      }
    }
  }
  if (!background && c.rules.length > 0) {
    const classes = attr(head.match(/<[a-z][^>]*>/i)?.[0] ?? "", "class") ?? "";
    for (const token of classes.split(/\s+/)) {
      if (!/^elementor-element-[a-z0-9]+$/i.test(token)) continue;
      const re = new RegExp(`\\.${token}(?::not\\([^)]*\\))?\\s*$`, "i");
      const rule = c.rules.find((r) => r.selector.split(",").some((part) => re.test(part.trim())));
      if (rule) {
        background = rule.color;
        break;
      }
    }
  }
  if (!background || background.toLowerCase() === c.page.toLowerCase()) return { background: null, textColor: null };
  if (!textColor || textColor.toLowerCase() === background.toLowerCase()) textColor = luminance(background) < 0.45 ? "#ffffff" : null;
  return { background, textColor };
}

/// Las pistas de un bloque que no es de Shopify: los widgets o bloques que
/// usa ("slides, heading, button").
function builderHint(block: string) {
  const names: string[] = [];
  for (const m of block.matchAll(/\b(?:elementor-widget-|wp-block-)([a-z0-9-]+)/gi)) {
    const name = m[1].toLowerCase().replace(/^woocommerce-/, "");
    if (!names.includes(name)) names.push(name);
    if (names.length >= 6) break;
  }
  if (PRODUCT_LIST_RE.test(block) && !names.includes("productos")) names.push("productos");
  if (INSTAGRAM_RE.test(block)) names.push("instagram");
  return names.join(", ") || "contenido";
}

/// El esquema de la portada para la IA (ver arriba). Shopify por sus
/// secciones; las demás por las secciones de su constructor (Elementor)
/// o, si no hay, como un solo bloque.
export function buildHomeOutline(html: string, baseUrl: string, extraCss = ""): HomeOutline {
  const css = `${inlineStyles(html)}\n${extraCss}`;
  const styled = extraCss ? `${html}<style>${extraCss}</style>` : html;
  const b: OutlineBuilder = {
    items: [],
    truncated: false,
    seenImages: new Set(),
    seenTexts: new Set(),
    pendingProducts: [],
    baseUrl,
    backgrounds: parseCssBackgrounds(css),
    shopify: false,
  };
  const colors: OutlineColors = {
    schemes: schemeBlocks(styled),
    props: collectCustomProps(styled),
    rules: parseCssBackgroundColors(css),
    page: extractColors(styled)?.fondo ?? "#ffffff",
  };
  const shopify = Array.from(html.matchAll(/<(?:div|section)\b[^>]*id=["']shopify-section-[^"']*["'][^>]*>/gi));
  if (shopify.length > 0) {
    b.shopify = true;
    for (const match of shopify) {
      if (match.index == null || b.truncated) continue;
      const rawId = attr(match[0], "id") ?? "";
      const id = rawId.toLowerCase();
      const cls = (attr(match[0], "class") ?? "").toLowerCase();
      if (SHOPIFY_SECTION_SKIP_RE.test(`${id} ${cls}`)) continue;
      const inner = innerHtmlAt(html, match.index);
      if (!inner?.trim()) continue;
      // "template--123__image_banner_jVaWmY" → "image banner" (el final al
      // azar que pone Shopify lleva números o mayúsculas).
      const hint = rawId
        .replace(/^shopify-section-(?:template--\d+__|sections--\d+__)?/i, "")
        .replace(/[_-](?=[a-zA-Z0-9]*[0-9A-Z])[a-zA-Z0-9]{6,}$/, "")
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .trim();
      if (/\b(?:featured|main) product\b/.test(hint)) {
        // Un producto destacado: su galería, variantes y botones son del
        // producto (que ya se importa); en el esquema queda solo él.
        const scratch: OutlineBuilder = { ...b, items: [], truncated: false, seenImages: new Set(b.seenImages), seenTexts: new Set(), pendingProducts: [] };
        outlineScan(scratch, outlineReady(inner, baseUrl));
        const handles = Array.from(new Set(scratch.items.flatMap((i) => (i.kind === "products" ? i.handles : []))));
        if (handles.length === 0) continue;
        outlinePush(b, { kind: "section", hint, ...blockColors(`${match[0]}${inner}`, colors) });
        b.pendingProducts.push(...handles);
        outlineFlushProducts(b);
        continue;
      }
      outlinePush(b, { kind: "section", hint: hint || "sección", ...blockColors(`${match[0]}${inner}`, colors) });
      outlineScan(b, outlineReady(inner, baseUrl));
    }
    return { items: b.items, truncated: b.truncated };
  }

  const scope = homeScope(html);
  const tops: { at: number; end: number }[] = [];
  for (const m of scope.matchAll(/<(?:section|div)\b[^>]*class=["'][^"']*\b(?:elementor-top-section|e-parent)\b[^"']*["'][^>]*>/gi)) {
    if (m.index == null || tops.some((t) => m.index! < t.end)) continue;
    const end = elementEndAt(scope, m.index);
    if (end != null) tops.push({ at: m.index, end });
  }
  const blocks = tops.length > 0 ? tops.map((t) => scope.slice(t.at, t.end)) : [scope];
  for (const block of blocks) {
    if (b.truncated) break;
    outlinePush(b, { kind: "section", hint: builderHint(block), ...(tops.length > 0 ? blockColors(block, colors) : { background: null, textColor: null }) });
    outlineScan(b, outlineReady(block, baseUrl));
  }
  return { items: b.items, truncated: b.truncated };
}
