import { GOOGLE_FONT_OPTIONS } from "@/lib/brand-theme";
import { decodeHtmlEntities } from "@/lib/html-entities";

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
  /// si no la más parecida.
  headingFont: string;
  bodyFont: string;
  headingExact: boolean;
  bodyExact: boolean;
};

export type ShopifyMenuLink = { label: string; href: string };

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
  | { type: "BANNER"; images: string[]; title: string; subtitle: string; buttonText: string; buttonHref: string }
  | { type: "FEATURED_COLLECTION"; collectionHandle: string; title: string }
  | { type: "TEXT"; heading: string; body: string }
  | { type: "CATEGORY_GRID"; title: string; items: { collectionHandle: string; imageUrl: string | null; label: string }[] }
  | { type: "VIDEO"; url: string; title: string }
  | { type: "FEATURED_PRODUCTS"; productHandles: string[]; title: string }
  | { type: "INFO_COLUMNS"; items: { title: string; description: string }[] };

const MAX_MENU_LINKS = 12;

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
];
const BUTTON_PROPS = [
  "--color-button",
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
];
const ACCENT_PROPS = [
  "--color-base-accent-1",
  "--color-accent",
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

export function extractColors(html: string): ShopifyThemeColors | null {
  const props = collectCustomProps(html);
  let fondo = firstColor(props, BACKGROUND_PROPS);
  let texto = firstColor(props, TEXT_PROPS);
  let botones = firstColor(props, BUTTON_PROPS);
  let principal = firstColor(props, ACCENT_PROPS);
  const fondo2 = firstColor(props, BACKGROUND_2_PROPS);

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
  nunito: "Poppins",
  "nunito sans": "Poppins",
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

export function extractFonts(html: string): ShopifyThemeFonts | null {
  const props = collectCustomProps(html);
  let headingFamily = firstFont(props, HEADING_FONT_PROPS, "heading");
  let bodyFamily = firstFont(props, BODY_FONT_PROPS, "body");
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

export function extractMenu(html: string, baseUrl: string): ShopifyMenuLink[] {
  const header = headerHtml(html);
  if (!header) return [];
  // El menú de computadora suele ser el primer <nav> con links a
  // colecciones; si no hay, todo el encabezado (el del celular repite los
  // mismos links y se quitan por duplicados).
  const navs = header.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi) ?? [];
  const scope =
    navs.find((nav) => (nav.match(/href=["'][^"']*\/(collections|products|pages)\//gi) ?? []).length >= 1) ?? header;
  const links: ShopifyMenuLink[] = [];
  const seen = new Set<string>();
  for (const match of scope.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(`<a ${match[1]}>`, "href");
    if (!href) continue;
    const clean = cleanHref(href, baseUrl);
    const label = stripTags(match[2]).slice(0, 60);
    if (!clean || !label || seen.has(clean)) continue;
    seen.add(clean);
    links.push({ label, href: clean });
    if (links.length >= MAX_MENU_LINKS) break;
  }
  return links;
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
  for (const match of html.matchAll(/<(span|p|a)\b[^>]*class=["'][^"']*announcement[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)) push(match[2]);
  if (texts.length === 0) {
    for (const match of html.matchAll(/<div\b[^>]*class=["'][^"']*announcement[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)) push(match[1]);
  }
  return texts.slice(0, 4);
}

export function parseShopifyStorefront(html: string, baseUrl: string): ShopifyThemeInfo {
  return {
    storeName: extractStoreName(html),
    logoUrl: extractLogoUrl(html, baseUrl),
    faviconUrl: extractFaviconUrl(html, baseUrl),
    colors: extractColors(html),
    fonts: extractFonts(html),
    menu: extractMenu(html, baseUrl),
    payments: extractPayments(html),
    pixels: extractPixels(html),
    social: extractSocial(html),
    announcements: extractAnnouncements(html),
    pageLinks: extractPageLinks(html, baseUrl),
    policyLinks: extractPolicyLinks(html),
    homeSections: extractHomeSections(html, baseUrl),
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
  if (body == null) body = scope.replace(/<h1\b[\s\S]*?<\/h1>/i, "");
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
export function extractHomeSections(html: string, baseUrl: string): ShopifyHomeSection[] {
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
    const key = `${id} ${cls} ${innerClasses}`;

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
    if (/featured[-_]collection/.test(key)) {
      const [collectionHandle] = collectionHandles(inner, 1);
      if (collectionHandle) sections.push({ type: "FEATURED_COLLECTION", collectionHandle, title: firstText(inner, "h2|h3", 120) });
      continue;
    }
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
    if (/image[-_]with[-_]text|multirow/.test(key)) {
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
  return sections.slice(0, 12);
}
