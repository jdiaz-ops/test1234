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
