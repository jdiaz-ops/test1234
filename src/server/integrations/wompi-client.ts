import { createHash } from "node:crypto";
import type { BrandProfile } from "@prisma/client";

/// Integración con Wompi (wompi.co) para el checkout nativo de "Mi tienda".
/// Cada marca usa SU PROPIA cuenta de Wompi — estas funciones solo arman/
/// verifican firmas y hablan con la API pública de Wompi usando las llaves
/// que la marca guardó en el portal (ver brand-payment-service.ts). La
/// plata nunca pasa por una cuenta de Marcolini.
///
/// Referencia: https://docs.wompi.co/en/docs/colombia/widget-checkout-web/
/// (el dominio está bloqueado para fetch directo en este entorno de
/// desarrollo — lo de abajo está armado a partir de la documentación
/// pública conocida; conviene confirmarlo contra una cuenta sandbox real
/// antes de procesar dinero de verdad).

export type WompiKeySet = {
  mode: "TEST" | "PRODUCTION";
  publicKey: string;
  privateKey: string;
  eventsKey: string;
  integrityKey: string;
};

/// Llaves activas de una marca según su BrandProfile.paymentMode — null si
/// la marca no ha terminado de configurar las 4 llaves de ese modo.
export function getActiveWompiKeys(
  brand: Pick<
    BrandProfile,
    | "paymentProvider"
    | "paymentMode"
    | "wompiPublicKeyTest"
    | "wompiPrivateKeyTest"
    | "wompiEventsKeyTest"
    | "wompiIntegrityKeyTest"
    | "wompiPublicKeyProd"
    | "wompiPrivateKeyProd"
    | "wompiEventsKeyProd"
    | "wompiIntegrityKeyProd"
  >,
): WompiKeySet | null {
  if (brand.paymentProvider !== "WOMPI") return null;

  if (brand.paymentMode === "PRODUCTION") {
    const {
      wompiPublicKeyProd,
      wompiPrivateKeyProd,
      wompiEventsKeyProd,
      wompiIntegrityKeyProd,
    } = brand;
    if (
      !wompiPublicKeyProd ||
      !wompiPrivateKeyProd ||
      !wompiEventsKeyProd ||
      !wompiIntegrityKeyProd
    )
      return null;
    return {
      mode: "PRODUCTION",
      publicKey: wompiPublicKeyProd,
      privateKey: wompiPrivateKeyProd,
      eventsKey: wompiEventsKeyProd,
      integrityKey: wompiIntegrityKeyProd,
    };
  }

  const {
    wompiPublicKeyTest,
    wompiPrivateKeyTest,
    wompiEventsKeyTest,
    wompiIntegrityKeyTest,
  } = brand;
  if (
    !wompiPublicKeyTest ||
    !wompiPrivateKeyTest ||
    !wompiEventsKeyTest ||
    !wompiIntegrityKeyTest
  )
    return null;
  return {
    mode: "TEST",
    publicKey: wompiPublicKeyTest,
    privateKey: wompiPrivateKeyTest,
    eventsKey: wompiEventsKeyTest,
    integrityKey: wompiIntegrityKeyTest,
  };
}

/// signature:integrity del Widget/Checkout Web = SHA256(reference +
/// amountInCents + currency + integrityKey), en ese orden y sin separadores.
export function buildIntegritySignature(params: {
  reference: string;
  amountInCents: number;
  currency: string;
  integrityKey: string;
}) {
  const raw =
    params.reference +
    String(params.amountInCents) +
    params.currency +
    params.integrityKey;
  return createHash("sha256").update(raw).digest("hex");
}

function resolvePath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

/// Checksum de los eventos (webhook) = SHA256(valores de signature.properties
/// concatenados en orden, resueltos por ruta contra el `data` del evento +
/// el timestamp del evento + el events key), todo sin separadores.
export function verifyWompiEventChecksum(params: {
  data: unknown;
  properties: string[];
  timestamp: number;
  checksum: string;
  eventsKey: string;
}) {
  const concatenated = params.properties
    .map((path) => {
      const value = resolvePath(params.data, path);
      return value === undefined || value === null ? "" : String(value);
    })
    .join("");
  const raw = concatenated + String(params.timestamp) + params.eventsKey;
  const expected = createHash("sha256").update(raw).digest("hex");
  return expected === params.checksum;
}

function apiBase(mode: "TEST" | "PRODUCTION") {
  return mode === "PRODUCTION"
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

export class WompiApiError extends Error {}

/// Respaldo de la página "gracias por tu compra": si el webhook todavía no
/// llegó, consultamos el estado directo contra la API de Wompi con la
/// llave pública (de solo lectura) de la marca.
export async function fetchWompiTransaction(
  mode: "TEST" | "PRODUCTION",
  publicKey: string,
  transactionId: string,
) {
  const res = await fetch(`${apiBase(mode)}/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${publicKey}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new WompiApiError(
      `Wompi respondió ${res.status} al consultar la transacción`,
    );
  }
  const body = await res.json();
  return body?.data as
    | { id: string; status: string; reference: string; amount_in_cents: number }
    | undefined;
}
