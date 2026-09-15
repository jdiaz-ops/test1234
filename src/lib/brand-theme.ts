import { z } from "zod";

/// Configuración visual completa de "Mi tienda" — el shape que vive en
/// BrandTheme.draftConfig/publishedConfig (ver el schema). Validado acá,
/// no en Prisma, para poder ajustar campos sin migrar — mismo criterio
/// que src/lib/storefront-sections.ts. Ver conversación del 2026-09-14,
/// recorrido completo del editor de diseño de Tiendanube.

/// z.object({...}).default({}) NO vuelve a correr los defaults de cada
/// campo cuando la llave falta en el input — usa el objeto vacío tal
/// cual. Este helper arma el default de verdad parseando `{}` a través
/// del propio schema, así que cada nivel queda completo aunque el padre
/// nunca haya mandado esa llave.
// zod v4 no infiere bien el tipo de retorno de .default() cuando el shape
// viene de un genérico abierto (Shape extends z.ZodRawShape) — el objeto
// de salida es idéntico con o sin el wrapper ZodDefault (el default solo
// cambia qué acepta el INPUT como undefined, no el shape del output), así
// que se castea de vuelta a ZodObject<Shape> para no arrastrar el error
// de tipos a cada uso de withDefaults.
function withDefaults<Shape extends z.ZodRawShape>(shape: Shape) {
  const schema = z.object(shape);
  const withDefault = (schema as z.ZodTypeAny).default(() => schema.parse({}));
  return withDefault as unknown as typeof schema;
}

// ----------------------------------------------------------------------------
// Colores — los valores por defecto son el rosado/nude actual de Marcolini
// (ver globals.css), así que una marca que nunca publicó un tema ve
// exactamente lo mismo que hoy.
// ----------------------------------------------------------------------------

const hexColor = () =>
  z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Color inválido (ej. #d1477b)");

export const DEFAULT_COLORS = {
  principal: "#d1477b",
  secundario: "#f6dde7",
  acento: "#2f9e6b",
  usarAcento: false,
  fondo: "#fcf1ee",
  texto: "#2e1f22",
};

const colorsSchema = withDefaults({
  /// Botones, precios, links, firma de marca.
  principal: hexColor().default(DEFAULT_COLORS.principal),
  /// Fondo de la barra de anuncio.
  secundario: hexColor().default(DEFAULT_COLORS.secundario),
  /// Promociones, mensajes de descuento, envío gratis — solo si
  /// usarAcento = true; si no, se usa `principal` en su lugar.
  acento: hexColor().default(DEFAULT_COLORS.acento),
  usarAcento: z.boolean().default(DEFAULT_COLORS.usarAcento),
  fondo: hexColor().default(DEFAULT_COLORS.fondo),
  texto: hexColor().default(DEFAULT_COLORS.texto),
});

/// Combinaciones predefinidas para resetear los colores de un click — ver
/// el bloque "Combinaciones predeterminadas" de Tiendanube.
export const COLOR_PRESETS: { name: string; colors: typeof DEFAULT_COLORS }[] = [
  {
    name: "Marcolini (original)",
    colors: DEFAULT_COLORS,
  },
  {
    name: "Lavanda",
    colors: { principal: "#6b5ca5", secundario: "#e4defa", acento: "#2f9e6b", usarAcento: false, fondo: "#faf8ff", texto: "#221d33" },
  },
  {
    name: "Verde salvia",
    colors: { principal: "#3f6b4f", secundario: "#dfe9de", acento: "#c98a3a", usarAcento: false, fondo: "#f6f8f3", texto: "#1f2b21" },
  },
  {
    name: "Negro y dorado",
    colors: { principal: "#111111", secundario: "#f1e4bf", acento: "#c9a44a", usarAcento: true, fondo: "#ffffff", texto: "#111111" },
  },
];

// ----------------------------------------------------------------------------
// Tipografía — catálogo curado de Google Fonts (no texto libre, para no
// depender de una familia que no exista o sea ilegible). "Instrument Sans"
// y "Karla" son las de Marcolini, ya cargadas en el layout raíz — elegirlas
// no dispara una segunda descarga.
// ----------------------------------------------------------------------------

export const GOOGLE_FONT_OPTIONS = [
  { value: "Instrument Sans", stack: "'Instrument Sans', -apple-system, sans-serif", weights: "500;600;700", builtin: true },
  { value: "Karla", stack: "'Karla', -apple-system, sans-serif", weights: "400;500;600", builtin: true },
  { value: "Montserrat", stack: "'Montserrat', -apple-system, sans-serif", weights: "400;500;600;700", builtin: false },
  { value: "Poppins", stack: "'Poppins', -apple-system, sans-serif", weights: "400;500;600;700", builtin: false },
  { value: "Inter", stack: "'Inter', -apple-system, sans-serif", weights: "400;500;600;700", builtin: false },
  { value: "Raleway", stack: "'Raleway', -apple-system, sans-serif", weights: "400;500;600;700", builtin: false },
  { value: "Work Sans", stack: "'Work Sans', -apple-system, sans-serif", weights: "400;500;600;700", builtin: false },
  { value: "Playfair Display", stack: "'Playfair Display', Georgia, serif", weights: "500;600;700", builtin: false },
  { value: "Lora", stack: "'Lora', Georgia, serif", weights: "400;500;600;700", builtin: false },
  { value: "DM Serif Display", stack: "'DM Serif Display', Georgia, serif", weights: "400", builtin: false },
] as const;

const FONT_VALUES = GOOGLE_FONT_OPTIONS.map((f) => f.value) as [string, ...string[]];

export function fontStack(value: string): string {
  return GOOGLE_FONT_OPTIONS.find((f) => f.value === value)?.stack ?? "'Instrument Sans', -apple-system, sans-serif";
}

/// Construye la URL de Google Fonts para las familias que no vienen ya
/// cargadas por next/font en el layout raíz — evita una descarga inútil
/// cuando la marca dejó la tipografía por defecto.
export function buildGoogleFontsUrl(families: string[]): string | null {
  const toLoad = Array.from(new Set(families))
    .map((v) => GOOGLE_FONT_OPTIONS.find((f) => f.value === v))
    .filter((f): f is (typeof GOOGLE_FONT_OPTIONS)[number] => !!f && !f.builtin);
  if (toLoad.length === 0) return null;
  const params = toLoad
    .map((f) => `family=${encodeURIComponent(f.value)}:wght@${f.weights}`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

const typographySchema = withDefaults({
  headingFont: z.enum(FONT_VALUES).default("Instrument Sans"),
  bodyFont: z.enum(FONT_VALUES).default("Karla"),
});

// ----------------------------------------------------------------------------
// Tipo de diseño
// ----------------------------------------------------------------------------

const designTypeSchema = withDefaults({
  /// true = el look actual (bordes redondeados en tarjetas/banners/
  /// botones). false aplica un radio más chico — no cuadra 100% cada
  /// componente, es un ajuste global razonable, no un rediseño por
  /// componente.
  roundedBorders: z.boolean().default(true),
  /// Guardado para más adelante — la vitrina no usa hoy un sistema de
  /// íconos con variante "grueso/fino" (son mayormente emoji), así que
  /// este toggle todavía no cambia nada visible.
  boldIcons: z.boolean().default(false),
});

// ----------------------------------------------------------------------------
// Encabezado
// ----------------------------------------------------------------------------

const headerSchema = withDefaults({
  bgColorRef: z.enum(["principal", "fondo", "texto"]).default("fondo"),
  sticky: z.boolean().default(true),
  logoSize: z.enum(["small", "medium", "large"]).default("medium"),
  /// Si el menú de navegación (ver StorefrontMenuPanel) se muestra en el
  /// encabezado — en computadora como links normales, en celular como
  /// un ícono de hamburguesa a la izquierda que abre un panel lateral
  /// con los mismos ítems (ver store-header.tsx). El control del pie de
  /// página es aparte, ver footer.menuPrimary.show — habilitado por
  /// defecto. Ver conversación del 2026-09-14.
  showMenu: z.boolean().default(true),
  mobile: withDefaults({
    logoPosition: z.enum(["center", "left"]).default("center"),
    show: z.enum(["search", "categories", "icons"]).default("search"),
  }),
  desktop: withDefaults({
    logoPosition: z.enum(["left", "center"]).default("left"),
    iconSize: z.enum(["large", "small"]).default("large"),
  }),
});

const announcementMessageSchema = z.object({
  text: z.string().max(200),
  link: z.string().max(300).optional().or(z.literal("")),
});

const announcementBarSchema = withDefaults({
  enabled: z.boolean().default(false),
  /// Hasta 4 — pedido explícito de la marca ("3 o 4 textos que se
  /// deslizan"), ver conversación del 2026-09-15.
  messages: z.array(announcementMessageSchema).max(4).default([]),
});

// ----------------------------------------------------------------------------
// Footer — no existía en la vitrina, se construye de cero (ver
// storefront-footer.tsx).
// ----------------------------------------------------------------------------

const footerSchema = withDefaults({
  useCustomColors: z.boolean().default(false),
  bgColorRef: z.enum(["principal", "secundario", "acento", "fondo", "texto"]).default("texto"),
  textColorRef: z.enum(["principal", "secundario", "acento", "fondo", "texto"]).default("fondo"),
  aboutUs: withDefaults({
    show: z.boolean().default(false),
    title: z.string().max(100).default(""),
    description: z.string().max(500).default(""),
  }),
  menuPrimary: withDefaults({
    show: z.boolean().default(true),
    title: z.string().max(60).default("Categorías"),
  }),
  menuSecondary: withDefaults({
    show: z.boolean().default(false),
    title: z.string().max(60).default(""),
  }),
  contact: withDefaults({
    show: z.boolean().default(true),
    title: z.string().max(60).default("Contáctanos"),
  }),
  social: withDefaults({ title: z.string().max(60).default("Síguenos") }),
  showShippingOptions: z.boolean().default(false),
  showPaymentMethods: z.boolean().default(false),
  /// Solo imagen — la versión de Tiendanube también deja pegar código
  /// JS/HTML libre, pero eso es una puerta abierta a XSS en la vitrina
  /// pública; queda fuera a propósito. Ver conversación del 2026-09-14.
  seals: z.array(z.object({ imageUrl: z.string().min(1) })).max(6).default([]),
});

// ----------------------------------------------------------------------------
// Listado de productos
// ----------------------------------------------------------------------------

const productListingSchema = withDefaults({
  productsPerRow: z.enum(["1-3", "2-4"]).default("2-4"),
  quickAdd: z.boolean().default(true),
  showColorVariants: z.boolean().default(false),
  hoverSecondPhoto: z.boolean().default(false),
  photoCarousel: z.boolean().default(false),
});

// ----------------------------------------------------------------------------
// Colecciones — las landing de categoría (/coleccion/{slug}), separadas del
// listado principal a pedido explícito de la marca: acá no existían en
// Tiendanube tal cual (ahí "colecciones" son las categorías del catálogo,
// no una sección de tema aparte) pero Marcolini sí las tiene como su
// propia entidad, así que el editor de Diseño también les da su propio
// espacio. Ver conversación del 2026-09-14.
// ----------------------------------------------------------------------------

/// Tarjeta de producto DEDICADA a las landing de colección — grilla fija
/// de a 2 (no reusa el "productos por fila" del listado principal, que
/// puede ir hasta 4 en computadora; acá siempre son 2, en cualquier
/// pantalla, a pedido explícito de la marca) y con los dos botones a la
/// vez (no uno u otro) — cada elemento se puede prender/apagar acá. Ver
/// collection-product-grid.tsx y conversación del 2026-09-14.
const collectionsSchema = withDefaults({
  showImage: z.boolean().default(true),
  showTitle: z.boolean().default(true),
  showViewProductButton: z.boolean().default(true),
  showAddToCartButton: z.boolean().default(true),
});

// ----------------------------------------------------------------------------
// Detalle de producto
// ----------------------------------------------------------------------------

export const TRUST_ICON_OPTIONS = [
  { value: "NONE", label: "Sin ícono", emoji: null },
  { value: "SHIPPING", label: "Envíos", emoji: "🚚" },
  { value: "PAYMENT", label: "Tarjetas de crédito", emoji: "💳" },
  { value: "SECURITY", label: "Seguridad", emoji: "🔒" },
  { value: "RETURNS", label: "Cambios y devoluciones", emoji: "🔄" },
] as const;
const TRUST_ICON_VALUES = TRUST_ICON_OPTIONS.map((i) => i.value) as [string, ...string[]];

const purchaseInfoItemSchema = z.object({
  show: z.boolean().default(false),
  icon: z.enum(TRUST_ICON_VALUES).default("NONE"),
  title: z.string().max(80).default(""),
  description: z.string().max(200).default(""),
});

const productDetailSchema = withDefaults({
  /// Reusa quoteShipping (ver store-order-service.ts) — el comprador
  /// elige su departamento en la ficha y ve el costo antes de agregar
  /// al carrito.
  shippingCalculator: z.boolean().default(false),
  /// Barra flotante con el producto + "Agregar al carrito" que aparece
  /// cuando el comprador scrollea y pierde de vista el botón principal —
  /// habilitado por defecto (conviene), la marca lo puede apagar. Ver
  /// conversación del 2026-09-14.
  floatingAddToCart: z.boolean().default(true),
  showSavedAmount: z.boolean().default(true),
  variantsAsButtons: z.boolean().default(true),
  colorVariantAsPhoto: z.boolean().default(false),
  /// Slug de una StorePage propia (ver store-page-service.ts) — null si
  /// la marca no armó ninguna guía de tallas.
  sizeGuidePageSlug: z.string().nullable().default(null),
  showStock: z.boolean().default(true),
  lowStock: withDefaults({
    enabled: z.boolean().default(false),
    threshold: z.coerce.number().int().min(1).max(1000).default(5),
    lastUnitMessage: z.string().max(120).default("¡No te lo pierdas, es el último!"),
  }),
  relatedTitles: withDefaults({
    alternative: z.string().max(80).default("Productos similares"),
    complementary: z.string().max(80).default("Para comprar con este producto"),
  }),
  purchaseInfo: z
    .array(purchaseInfoItemSchema)
    .length(3)
    .default(() => [
      purchaseInfoItemSchema.parse({}),
      purchaseInfoItemSchema.parse({}),
      purchaseInfoItemSchema.parse({}),
    ]),
});

// ----------------------------------------------------------------------------
// Carrito
// ----------------------------------------------------------------------------

const cartSchema = withDefaults({
  showViewMoreButton: z.boolean().default(true),
  minPurchaseAmount: z.coerce.number().min(0).nullable().default(null),
  quickCart: withDefaults({
    enabled: z.boolean().default(false),
    actionOnAdd: z.enum(["notification", "openCart"]).default("notification"),
  }),
  suggestComplementary: z.boolean().default(false),
  allowCoupon: z.boolean().default(true),
  shippingCalculator: z.boolean().default(false),
});

// ----------------------------------------------------------------------------
// Navegador móvil — barra flotante fija abajo, solo en celular, al estilo
// app nativa (Home/Categorías/Carrito). Siempre son exactamente 3 ítems
// fijos (no se agregan/quitan/reordenan) — la marca edita texto, link y
// (opcional) el ícono de cada uno subiendo su propia imagen; si no sube
// nada, se usa el ícono predefinido de esa posición (ver
// MOBILE_NAV_DEFAULT_LABELS/mobile-nav-icons.tsx). Habilitado por
// defecto. Ver conversación del 2026-09-14.
// ----------------------------------------------------------------------------

const mobileNavItemSchema = z.object({
  enabled: z.boolean().default(true),
  label: z.string().max(20).default(""),
  url: z.string().max(300).default(""),
  /// null = usa el ícono predefinido de esta posición.
  iconUrl: z.string().nullable().default(null),
});

export const MOBILE_NAV_DEFAULTS: { label: string; url: string }[] = [
  { label: "Inicio", url: "/" },
  { label: "Categorías", url: "/coleccion" },
  { label: "Carrito", url: "/carrito" },
];

const mobileNavSchema = withDefaults({
  enabled: z.boolean().default(true),
  items: z
    .array(mobileNavItemSchema)
    .length(3)
    .default(() => MOBILE_NAV_DEFAULTS.map((d) => mobileNavItemSchema.parse(d))),
});

// ----------------------------------------------------------------------------
// Pop-up promocional — vive a nivel de tema, no es una sección de la home
// (se muestra encima de toda la tienda). Sin newsletter — ver
// conversación del 2026-09-14: esta plataforma no habla de marketing por
// correo.
// ----------------------------------------------------------------------------

const popupSchema = withDefaults({
  enabled: z.boolean().default(false),
  imageUrl: z.string().nullable().default(null),
  phrase: z.string().max(160).default(""),
  link: z.string().max(300).nullable().default(null),
});

// ----------------------------------------------------------------------------
// Config completa
// ----------------------------------------------------------------------------

export const themeConfigSchema = z.object({
  colors: colorsSchema,
  typography: typographySchema,
  designType: designTypeSchema,
  header: headerSchema,
  announcementBar: announcementBarSchema,
  footer: footerSchema,
  productListing: productListingSchema,
  collections: collectionsSchema,
  productDetail: productDetailSchema,
  cart: cartSchema,
  mobileNav: mobileNavSchema,
  popup: popupSchema,
  /// CSS libre "para diseñadores web" — se sanea (sin @import, sin
  /// expression(), tope de tamaño) antes de inyectarse en la vitrina. Ver
  /// sanitizeCustomCss.
  customCss: z.string().max(20000).default(""),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

export const DEFAULT_THEME_CONFIG: ThemeConfig = themeConfigSchema.parse({});

export function parseThemeConfig(data: unknown): ThemeConfig {
  return themeConfigSchema.parse(data ?? {});
}

/// Merge profundo para PATCH parcial del borrador — objetos planos se
/// combinan recursivamente, arrays y todo lo demás se reemplaza entero
/// (ej. mandar `announcementBar.messages` reemplaza la lista completa, no
/// la concatena).
export function deepMergeThemeConfig(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = result[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMergeThemeConfig(
        baseValue as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/// Quita lo peligroso de un CSS libre antes de guardarlo/inyectarlo: nada
/// de @import (podría cargar recursos externos sin que la marca lo note),
/// nada de expression() (viejo vector de XSS en IE, inofensivo hoy pero
/// gratis de bloquear), y nada de </style> (para no poder cerrar la
/// etiqueta e inyectar HTML/script). No es un parser CSS real, es una
/// blocklist simple — suficiente porque esto nunca se ejecuta como JS, es
/// texto que el navegador interpreta como reglas de estilo nada más.
export function sanitizeCustomCss(raw: string): string {
  return raw
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/<\/style/gi, "")
    .slice(0, 20000);
}

/// Resuelve un color "por rol" (principal/secundario/acento/fondo/texto)
/// al valor hex real — usado por header/footer para saber a qué color
/// concreto apunta su referencia.
export function resolveColorRef(
  colors: ThemeConfig["colors"],
  ref: "principal" | "secundario" | "acento" | "fondo" | "texto",
): string {
  if (ref === "acento" && !colors.usarAcento) return colors.principal;
  return colors[ref];
}

/// Traduce el tema a variables CSS para el wrapper de la vitrina — de ahí
/// para abajo, TODOS los componentes que ya usan bg-brand-accent,
/// text-brand-ink, etc. (ver globals.css) quedan con los colores de la
/// marca sin tocar un solo componente. Los tonos "soft"/"line" que no se
/// configuran directo se derivan con color-mix() en el navegador — no
/// hace falta una librería de color en el servidor para aclarar/oscurecer
/// un hex.
export function themeToCssVars(theme: ThemeConfig): Record<string, string> {
  const { colors, typography } = theme;
  const highlight = resolveColorRef(colors, "acento");
  return {
    "--brand-bg": colors.fondo,
    "--brand-surface": "#ffffff",
    "--brand-ink": colors.texto,
    "--brand-ink-soft": `color-mix(in srgb, ${colors.texto} 55%, white)`,
    "--brand-accent": colors.principal,
    "--brand-accent-soft": `color-mix(in srgb, ${colors.principal} 16%, white)`,
    "--brand-line": `color-mix(in srgb, ${colors.texto} 12%, white)`,
    "--brand-secondary": colors.secundario,
    "--brand-highlight": highlight,
    "--font-display": fontStack(typography.headingFont),
    "--font-body": fontStack(typography.bodyFont),
  };
}

/// El radio de borde global — se aplica vía [data-rounded] en globals.css
/// (ver la regla ahí), esto solo decide qué atributo poner.
export function roundedDataAttr(theme: ThemeConfig): "true" | "false" {
  return theme.designType.roundedBorders ? "true" : "false";
}
