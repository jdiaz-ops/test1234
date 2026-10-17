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

export type ShopifyThemeInfo = {
  storeName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  colors: ShopifyThemeColors | null;
  fonts: ShopifyThemeFonts | null;
  menu: ShopifyMenuLink[];
};

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
  maps: { collectionSlugByHandle: Map<string, string>; productSlugByHandle: Map<string, string> },
): string | null {
  if (/^https?:\/\//i.test(href)) return href;
  if (href === "/") return "/";
  if (/^\/collections(\/all)?$/i.test(href)) return "/coleccion";
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

export function parseShopifyStorefront(html: string, baseUrl: string): ShopifyThemeInfo {
  return {
    storeName: extractStoreName(html),
    logoUrl: extractLogoUrl(html, baseUrl),
    faviconUrl: extractFaviconUrl(html, baseUrl),
    colors: extractColors(html),
    fonts: extractFonts(html),
    menu: extractMenu(html, baseUrl),
  };
}
