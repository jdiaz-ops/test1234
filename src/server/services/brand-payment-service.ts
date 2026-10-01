import { prisma } from "@/lib/prisma";

export class BrandPaymentError extends Error {}

const WOMPI_KEY_FIELDS = [
  "wompiPublicKeyTest",
  "wompiPrivateKeyTest",
  "wompiEventsKeyTest",
  "wompiIntegrityKeyTest",
  "wompiPublicKeyProd",
  "wompiPrivateKeyProd",
  "wompiEventsKeyProd",
  "wompiIntegrityKeyProd",
] as const;

type WompiKeyField = (typeof WOMPI_KEY_FIELDS)[number];

/// Guarda las llaves de Wompi que la marca pegó desde su propio panel — se
/// activa como pasarela (paymentProvider = WOMPI) apenas guarda algo.
///
/// Solo toca las llaves que vienen: la página de Pagos ya no le manda al
/// navegador las llaves secretas guardadas (las muestra enmascaradas), así
/// que una llave que no se cambió llega como undefined y se conserva; ""
/// la borra. Y no deja pasar a "cobro real" sin las 4 llaves de
/// producción — antes se podía y la tienda quedaba sin poder cobrar. Ver
/// conversación del 2026-10-01.
export async function saveWompiCredentials(
  userId: string,
  data: { paymentMode: "TEST" | "PRODUCTION" } & Partial<Record<WompiKeyField, string>>,
) {
  const current = await prisma.brandProfile.findUniqueOrThrow({ where: { userId } });
  const updates: Partial<Record<WompiKeyField, string | null>> = {};
  for (const field of WOMPI_KEY_FIELDS) {
    const value = data[field];
    if (value !== undefined) updates[field] = value.trim() || null;
  }

  const merged = { ...current, ...updates, paymentMode: data.paymentMode };
  if (data.paymentMode === "PRODUCTION" && !isWompiModeComplete(merged)) {
    throw new BrandPaymentError(
      "Para cobrar de verdad faltan llaves de producción. Complétalas o deja activo el modo de prueba.",
    );
  }

  return prisma.brandProfile.update({
    where: { userId },
    data: { paymentProvider: "WOMPI", paymentMode: data.paymentMode, ...updates },
  });
}

/// Cómo se ve una llave secreta guardada en la página de Pagos: solo si
/// existe y sus últimos 4 caracteres — nunca la llave completa.
export function maskSecret(value: string | null) {
  return value ? { saved: true, last4: value.slice(-4) } : { saved: false, last4: "" };
}

/// Estado de la pasarela para la página de Pagos.
export function wompiStatus(profile: Parameters<typeof isWompiModeComplete>[0] & {
  paymentProvider: "NONE" | "WOMPI";
}): "NOT_CONNECTED" | "ACTIVE" | "TEST" | "INCOMPLETE" {
  const anyKey = WOMPI_KEY_FIELDS.some((f) => Boolean(profile[f]));
  if (profile.paymentProvider !== "WOMPI" || !anyKey) return "NOT_CONNECTED";
  if (!isWompiModeComplete(profile)) return "INCOMPLETE";
  return profile.paymentMode === "PRODUCTION" ? "ACTIVE" : "TEST";
}

/// Las 4 llaves que hacen falta para el modo activo (test o producción) —
/// el checkout de "Mi tienda" (cuando exista) usa esto para decidir si ya
/// puede cobrar de verdad o si a la marca todavía le falta completar algo.
export function isWompiModeComplete(profile: {
  paymentMode: "TEST" | "PRODUCTION";
  wompiPublicKeyTest: string | null;
  wompiPrivateKeyTest: string | null;
  wompiEventsKeyTest: string | null;
  wompiIntegrityKeyTest: string | null;
  wompiPublicKeyProd: string | null;
  wompiPrivateKeyProd: string | null;
  wompiEventsKeyProd: string | null;
  wompiIntegrityKeyProd: string | null;
}) {
  const keys =
    profile.paymentMode === "TEST"
      ? [
          profile.wompiPublicKeyTest,
          profile.wompiPrivateKeyTest,
          profile.wompiEventsKeyTest,
          profile.wompiIntegrityKeyTest,
        ]
      : [
          profile.wompiPublicKeyProd,
          profile.wompiPrivateKeyProd,
          profile.wompiEventsKeyProd,
          profile.wompiIntegrityKeyProd,
        ];
  return keys.every((k) => Boolean(k));
}
