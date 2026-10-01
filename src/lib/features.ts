/// Interruptores de funciones que existen en el código pero no se ofrecen
/// todavía. Se encienden con una variable de entorno en Vercel (y un nuevo
/// deploy, porque NEXT_PUBLIC_* se fija al compilar) sin tocar código ni
/// datos.

/// Muestras gratis (sample-service.ts): la marca regala producto a
/// creadores. Estuvo apagado al lanzar; Juan pidió volver a mostrarlo
/// (2026-10-01), así que ahora viene encendido. Para apagarlo de nuevo:
/// NEXT_PUBLIC_FEATURE_SAMPLES=false.
export const SAMPLES_ENABLED = process.env.NEXT_PUBLIC_FEATURE_SAMPLES !== "false";

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
/// circulan (/registro/creador?ref=...) siguen sirviendo para registrarse.
/// Para encenderlo: NEXT_PUBLIC_FEATURE_REFERRALS=true. Ver conversación
/// del 2026-10-01.
export const REFERRALS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_REFERRALS === "true";
