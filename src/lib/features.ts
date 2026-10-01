/// Interruptores de funciones que existen en el código pero no se ofrecen
/// todavía. Se encienden con una variable de entorno en Vercel (y un nuevo
/// deploy, porque NEXT_PUBLIC_* se fija al compilar) sin tocar código ni
/// datos.

/// Muestras gratis (sample-service.ts): la marca regala producto a
/// creadores. Apagado al lanzar: Marcolini arranca solo con códigos,
/// comisiones y pagos, y las muestras se coordinan a mano por fuera
/// mientras se aprende cómo diseñarlas. Para encenderlo:
/// NEXT_PUBLIC_FEATURE_SAMPLES=true. Ver conversación del 2026-10-01.
export const SAMPLES_ENABLED = process.env.NEXT_PUBLIC_FEATURE_SAMPLES === "true";

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
