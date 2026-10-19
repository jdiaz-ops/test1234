/// Interruptores de funciones que existen en el código pero no se ofrecen
/// todavía. Se encienden con una variable de entorno en Vercel (y un nuevo
/// deploy, porque NEXT_PUBLIC_* se fija al compilar) sin tocar código ni
/// datos.

/// Muestras (sample-service.ts): la marca regala producto a las creadoras
/// para que lo prueben y lo muestren en su contenido. Encendido para
/// todas las marcas desde el 2026-10-17 (pedido de Juan, por lo que dijo
/// una marca en la presentación): sale en el menú de marca ("Muestras") y
/// de creadora ("Solicitar muestras"), en el marketplace y en las
/// landings. Para apagarlo: NEXT_PUBLIC_FEATURE_SAMPLES=false.
export const SAMPLES_ENABLED = process.env.NEXT_PUBLIC_FEATURE_SAMPLES !== "false";

/// Servicios y productos digitales (Product.type SERVICE/DIGITAL): escondidos
/// por ahora al crear un producto — solo productos físicos (pedido del
/// 2026-10-19). Los que ya existen se siguen viendo y vendiendo igual. Para
/// encenderlo: NEXT_PUBLIC_FEATURE_PRODUCT_TYPES=true.
export const PRODUCT_TYPES_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PRODUCT_TYPES === "true";

/// Reseñas de productos (product-review-service.ts): los compradores
/// opinan desde la ficha y la marca aprueba. Apagado: la marca pidió
/// quitarlo — no se ve en la ficha, ni en el menú, y la API de envío
/// responde 404. Las reseñas guardadas no se borran. Para encenderlo:
/// NEXT_PUBLIC_FEATURE_REVIEWS=true. Ver conversación del 2026-10-01.
export const REVIEWS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_REVIEWS === "true";

/// Conexión con Shopify/WooCommerce (Cuenta → Conexión de tienda y Cuenta
/// → Productos sincronizados). Apagado: la app de Shopify todavía no está
/// aprobada, así que no funciona en producción y confundía al lado de Mi
/// tienda. Las pestañas no aparecen en Cuenta; las conexiones y productos
/// ya guardados no se tocan. Para encenderlo:
/// NEXT_PUBLIC_FEATURE_STORE_CONNECTION=true. Ver conversación del
/// 2026-10-01.
export const STORE_CONNECTION_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_STORE_CONNECTION === "true";

/// Dominio propio (Configuración → General → CustomDomainForm). Escondido
/// por ahora: todas las tiendas van en {slug}.marcolini.lat. Un dominio ya
/// verificado sigue funcionando; solo no se ofrece en el panel. Para
/// encenderlo: NEXT_PUBLIC_FEATURE_CUSTOM_DOMAIN=true. Ver conversación
/// del 2026-10-01.
export const CUSTOM_DOMAIN_ENABLED = process.env.NEXT_PUBLIC_FEATURE_CUSTOM_DOMAIN === "true";

/// Campañas y misiones (retos: Misión, Flash Sale, Mix — challenge-service.ts).
/// Escondidas: Marcolini se enfoca 100% en lo esencial (códigos, comisiones,
/// pagos y tienda) y las funciones se irán sumando poco a poco. No aparecen
/// en el menú ni en el dashboard de marca o creador, sus páginas dan 404 y
/// la API no deja crearlas; tampoco se muestran en /para-creadores ni
/// /para-marcas. Las campañas ya guardadas no se borran. Para encenderlo:
/// NEXT_PUBLIC_FEATURE_CAMPAIGNS=true. Ver conversación del 2026-10-01.
export const CAMPAIGNS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_CAMPAIGNS === "true";

/// Invita y gana (referidos entre creadores — referral-service.ts).
/// Escondido mientras Marcolini se enfoca en lo esencial: sale del menú del
/// creador y del Admin, y su página da 404. Los links de invitación que ya
/// circulan (/registro/creador?ref=...) siguen sirviendo para registrarse,
/// pero apagado no se crea ni se califica ningún bono de $20.000 (pedido
/// del 2026-10-19: "el bono de 20.000 no va por ahora").
/// Para encenderlo: NEXT_PUBLIC_FEATURE_REFERRALS=true. Ver conversación
/// del 2026-10-01.
export const REFERRALS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_REFERRALS === "true";

/// Buzón de sugerencias del portal de marcas y del de creadoras (mensaje o
/// nota de voz, se lee en Admin → Sugerencias). Se pausó el 2026-10-19
/// ("pausa el buzón") y se encendió para todos ese mismo día ("adelante con
/// el buzón de sugerencias"): sale en los menús, con la nube de la esquina
/// en cada página del portal. Para apagarlo:
/// NEXT_PUBLIC_FEATURE_SUGGESTIONS=false (apagado no sale en los menús ni
/// la nube, y sus páginas y rutas dan 404).
export const SUGGESTIONS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_SUGGESTIONS !== "false";

/// Facturación electrónica con Dataico (Configuración → Conexiones y la
/// factura en el detalle del pedido): módulo hecho a la medida para la
/// tienda de H la Cosedora, la marca de Juan. Escondido para todas las
/// demás tiendas: no ven la tarjeta, la API responde 404 y nunca se
/// factura nada a su nombre. Para dársela a otra tienda, agregar su link
/// (el {slug} de {slug}.marcolini.lat). Pedido del 2026-10-04.
export const DATAICO_STORE_SLUGS = ["hlacosedora"];

export function dataicoAllowed(brand: { storefrontSlug: string | null } | null | undefined) {
  return Boolean(brand?.storefrontSlug && DATAICO_STORE_SLUGS.includes(brand.storefrontSlug));
}
