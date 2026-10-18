import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PAYMENT_PROVIDERS,
  credentialScopeFor,
  isCredentialSetComplete,
  type CredentialScope,
  type PaymentProviderId,
} from "@/lib/payment-providers";
import { mergeCredentials, readCredentialStore, storedCredentials } from "@/server/payments/credentials";

export class BrandPaymentError extends Error {}

/// Guarda las llaves de una pasarela (Wompi va por saveWompiCredentials,
/// con sus columnas; las demás, en BrandProfile.gatewayCredentials) y la
/// deja como la pasarela con la que cobra la marca. Solo toca los campos
/// que vienen: undefined conserva, "" borra. No deja pasar a "cobro real"
/// sin las llaves de producción completas de esa pasarela.
export async function saveGatewayCredentials(
  userId: string,
  data: {
    provider: PaymentProviderId;
    paymentMode: "TEST" | "PRODUCTION";
    credentials: Partial<Record<CredentialScope, Record<string, string | undefined>>>;
  },
) {
  if (data.provider === "WOMPI") {
    const wompi: Partial<Record<WompiKeyField, string>> = {};
    const map = (scope: "TEST" | "PRODUCTION", suffix: "Test" | "Prod") => {
      const values = data.credentials[scope] ?? {};
      for (const [key, field] of [
        ["publicKey", `wompiPublicKey${suffix}`],
        ["privateKey", `wompiPrivateKey${suffix}`],
        ["eventsKey", `wompiEventsKey${suffix}`],
        ["integrityKey", `wompiIntegrityKey${suffix}`],
      ] as const) {
        if (values[key] !== undefined) wompi[field] = values[key];
      }
    };
    map("TEST", "Test");
    map("PRODUCTION", "Prod");
    return saveWompiCredentials(userId, { paymentMode: data.paymentMode, ...wompi });
  }

  const current = await prisma.brandProfile.findUniqueOrThrow({ where: { userId } });
  let store = readCredentialStore(current.gatewayCredentials);
  const spec = PAYMENT_PROVIDERS[data.provider];
  const scopes: CredentialScope[] = spec.scopes === "SHARED" ? ["SHARED"] : ["TEST", "PRODUCTION"];
  for (const scope of scopes) {
    const patch = data.credentials[scope];
    if (patch) store = mergeCredentials(store, data.provider, scope, patch);
  }
  const prodScope = credentialScopeFor(data.provider, "PRODUCTION");
  if (data.paymentMode === "PRODUCTION" && !isCredentialSetComplete(data.provider, store[data.provider]?.[prodScope])) {
    throw new BrandPaymentError(
      `Para cobrar de verdad faltan datos de producción de ${spec.name}. Complétalos o deja activo el modo de prueba.`,
    );
  }
  return prisma.brandProfile.update({
    where: { userId },
    data: {
      paymentProvider: data.provider,
      paymentMode: data.paymentMode,
      gatewayCredentials: store as unknown as Prisma.InputJsonValue,
    },
  });
}

/// Las llaves guardadas de cualquier pasarela, para la página de Pagos.
export function savedCredentials(
  profile: Parameters<typeof storedCredentials>[0],
  provider: PaymentProviderId,
  mode: "TEST" | "PRODUCTION",
) {
  return storedCredentials(profile, provider, mode);
}

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
  paymentProvider: string;
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
