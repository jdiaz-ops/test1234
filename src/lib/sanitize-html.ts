import DOMPurify from "isomorphic-dompurify";

/// Sanea el HTML que sale del editor de texto enriquecido de la
/// Descripción de producto (ver rich-text-editor.tsx) antes de guardarlo
/// — es contenido que la marca escribe y que luego se muestra tal cual en
/// la vitrina pública, así que hay que evitar XSS (scripts, on-handlers,
/// iframes a dominios arbitrarios, etc.) sin perder el formato que sí
/// queremos permitir. Se usa tanto al guardar (brand-store-product-
/// service.ts) como al renderizar en la vitrina, por si algún día otro
/// camino de escritura se salta el primero.
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "span",
  "a",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "img",
  "iframe",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "code",
  "pre",
];

const ALLOWED_ATTR = [
  "href",
  "target",
  "rel",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "style",
  "class",
  "frameborder",
  "allow",
  "allowfullscreen",
  "colspan",
  "rowspan",
];

/// Solo se permiten embeds de YouTube/Vimeo — cualquier otro iframe se
/// quita entero, no solo el atributo src.
const ALLOWED_IFRAME_SRC =
  /^https:\/\/(www\.)?(youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)/;

DOMPurify.addHook("uponSanitizeElement", (node) => {
  const el = node as unknown as Element;
  if (el.tagName?.toLowerCase() === "iframe") {
    const src = el.getAttribute("src") ?? "";
    if (!ALLOWED_IFRAME_SRC.test(src)) {
      el.remove();
    }
  }
});

export function sanitizeProductDescription(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  }).trim();
}

/// Vista de texto plano de una descripción HTML — para metadatos
/// (<meta name="description">) y cualquier lugar que necesite un
/// resumen corto sin markup.
export function stripHtml(html: string, maxLength = 160): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
