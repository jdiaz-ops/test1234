import sanitizeHtml from "sanitize-html";

/// Sanea el HTML que sale del editor de texto enriquecido de la
/// Descripción de producto (ver rich-text-editor.tsx) antes de guardarlo
/// — es contenido que la marca escribe y que luego se muestra tal cual en
/// la vitrina pública, así que hay que evitar XSS (scripts, on-handlers,
/// iframes a dominios arbitrarios, etc.) sin perder el formato que sí
/// queremos permitir. Se usa tanto al guardar (brand-store-product-
/// service.ts) como al renderizar en la vitrina, por si algún día otro
/// camino de escritura se salta el primero.
///
/// Iba con isomorphic-dompurify (DOMPurify + jsdom) pero jsdom trae una
/// dependencia (html-encoding-sniffer → @exodus/bytes) que es un módulo
/// ESM puro — Next no la puede empaquetar ni cargar como "external
/// package" en el runtime de servidor de Vercel (ERR_REQUIRE_ESM), así
/// que la página se caía en producción aunque el build local pasara. Ver
/// conversación del 2026-09-14. sanitize-html no depende de una DOM real
/// (usa htmlparser2), así que evita ese problema por completo.
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

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "title", "width", "height"],
  iframe: ["src", "width", "height", "frameborder", "allow", "allowfullscreen"],
  table: ["border"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
  "*": ["style"],
};

/// Solo se permiten colores de texto (hex, del color picker del editor)
/// y alineación — nada más en el atributo style.
const ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: [/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i],
    "text-align": [/^(left|right|center|justify)$/],
  },
};

export function sanitizeProductDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedStyles: ALLOWED_STYLES,
    allowedSchemes: ["http", "https", "mailto"],
    // Solo embeds de YouTube/Vimeo — cualquier otro iframe se quita
    // entero, no solo el atributo src.
    allowedIframeHostnames: [
      "www.youtube.com",
      "youtube.com",
      "www.youtube-nocookie.com",
      "youtube-nocookie.com",
      "player.vimeo.com",
    ],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
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
