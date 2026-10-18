import type { BrandProfile } from "@prisma/client";
import {
  PAYMENT_PROVIDERS,
  credentialScopeFor,
  isCredentialSetComplete,
  isPaymentProviderId,
  type CredentialScope,
  type PaymentModeId,
  type PaymentProviderId,
} from "@/lib/payment-providers";
import { getActiveWompiKeys } from "@/server/integrations/wompi-client";

/// Llaves de las pasarelas de una marca. Wompi sigue en sus columnas de
/// siempre (wompi*); las demás viven en BrandProfile.gatewayCredentials:
/// { PASARELA: { TEST | PRODUCTION | SHARED: { campo: valor } } }. Acá se
/// leen, se completan y se enmascaran — nunca se mandan completas al
/// navegador. Ver src/lib/payment-providers.ts (2026-10-18).

export type CredentialValues = Record<string, string>;
export type CredentialStore = Partial<Record<PaymentProviderId, Partial<Record<CredentialScope, CredentialValues>>>>;

export type BrandGatewayFields = Pick<
  BrandProfile,
  | "paymentProvider"
  | "paymentMode"
  | "gatewayCredentials"
  | "wompiPublicKeyTest"
  | "wompiPrivateKeyTest"
  | "wompiEventsKeyTest"
  | "wompiIntegrityKeyTest"
  | "wompiPublicKeyProd"
  | "wompiPrivateKeyProd"
  | "wompiEventsKeyProd"
  | "wompiIntegrityKeyProd"
>;

export type ActiveGateway = { provider: PaymentProviderId; mode: PaymentModeId; values: CredentialValues };

const SCOPES: CredentialScope[] = ["TEST", "PRODUCTION", "SHARED"];

/// Lee el JSON guardado quedándose solo con strings — cualquier cosa rara
/// (una fila vieja, un valor numérico) se ignora en vez de romper.
export function readCredentialStore(json: unknown): CredentialStore {
  const store: CredentialStore = {};
  if (!json || typeof json !== "object" || Array.isArray(json)) return store;
  for (const [provider, scopes] of Object.entries(json as Record<string, unknown>)) {
    if (!isPaymentProviderId(provider) || !scopes || typeof scopes !== "object") continue;
    const byScope: Partial<Record<CredentialScope, CredentialValues>> = {};
    for (const [scope, values] of Object.entries(scopes as Record<string, unknown>)) {
      if (!SCOPES.includes(scope as CredentialScope) || !values || typeof values !== "object") continue;
      const clean: CredentialValues = {};
      for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) clean[key] = value.trim();
      }
      if (Object.keys(clean).length > 0) byScope[scope as CredentialScope] = clean;
    }
    if (Object.keys(byScope).length > 0) store[provider] = byScope;
  }
  return store;
}

/// Las llaves guardadas de una pasarela para un entorno, completas o no
/// (null si no hay ninguna). Wompi sale de sus columnas.
export function storedCredentials(
  brand: BrandGatewayFields,
  provider: PaymentProviderId,
  mode: PaymentModeId,
): CredentialValues | null {
  if (provider === "WOMPI") {
    const values =
      mode === "PRODUCTION"
        ? {
            publicKey: brand.wompiPublicKeyProd,
            privateKey: brand.wompiPrivateKeyProd,
            eventsKey: brand.wompiEventsKeyProd,
            integrityKey: brand.wompiIntegrityKeyProd,
          }
        : {
            publicKey: brand.wompiPublicKeyTest,
            privateKey: brand.wompiPrivateKeyTest,
            eventsKey: brand.wompiEventsKeyTest,
            integrityKey: brand.wompiIntegrityKeyTest,
          };
    const clean: CredentialValues = {};
    for (const [k, v] of Object.entries(values)) if (v?.trim()) clean[k] = v.trim();
    return Object.keys(clean).length > 0 ? clean : null;
  }
  const store = readCredentialStore(brand.gatewayCredentials);
  return store[provider]?.[credentialScopeFor(provider, mode)] ?? null;
}

/// Las llaves completas de una pasarela para un entorno — null si falta
/// alguna obligatoria. Es lo que usan el checkout, los webhooks y la
/// conciliación.
export function credentialsFor(
  brand: BrandGatewayFields,
  provider: PaymentProviderId,
  mode: PaymentModeId,
): CredentialValues | null {
  if (provider === "WOMPI") {
    const keys = getActiveWompiKeys({ ...brand, paymentProvider: "WOMPI", paymentMode: mode });
    return keys
      ? { publicKey: keys.publicKey, privateKey: keys.privateKey, eventsKey: keys.eventsKey, integrityKey: keys.integrityKey }
      : null;
  }
  const values = storedCredentials(brand, provider, mode);
  return isCredentialSetComplete(provider, values) ? values : null;
}

/// La pasarela con la que la marca cobra HOY (su pasarela y su modo), con
/// llaves completas — null si todavía no puede cobrar.
export function getActivePaymentGateway(brand: BrandGatewayFields): ActiveGateway | null {
  const provider = brand.paymentProvider;
  if (!isPaymentProviderId(provider)) return null;
  const mode = brand.paymentMode === "PRODUCTION" ? "PRODUCTION" : "TEST";
  const values = credentialsFor(brand, provider, mode);
  return values ? { provider, mode, values } : null;
}

/// Las llaves con las que se cobró UN pedido: su pasarela y su modo al
/// crearlo, no los de hoy — la marca pudo cambiar después.
export function gatewayForOrder(
  brand: BrandGatewayFields,
  order: { paymentProvider: string; paymentMode: string },
): ActiveGateway | null {
  const provider = order.paymentProvider;
  if (!isPaymentProviderId(provider)) return null;
  const mode: PaymentModeId = order.paymentMode === "PRODUCTION" ? "PRODUCTION" : "TEST";
  const values = credentialsFor(brand, provider, mode);
  return values ? { provider, mode, values } : null;
}

/// Aplica lo que mandó la página de Pagos sobre lo guardado: un campo que
/// no viene (undefined) se conserva, "" lo borra, otro valor lo reemplaza.
export function mergeCredentials(
  store: CredentialStore,
  provider: PaymentProviderId,
  scope: CredentialScope,
  patch: Record<string, string | undefined>,
): CredentialStore {
  const current = { ...(store[provider]?.[scope] ?? {}) };
  const allowed = new Set(PAYMENT_PROVIDERS[provider].fields.map((f) => f.key));
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key) || value === undefined) continue;
    const clean = value.trim();
    if (clean) current[key] = clean;
    else delete current[key];
  }
  const next: CredentialStore = { ...store, [provider]: { ...(store[provider] ?? {}), [scope]: current } };
  if (Object.keys(current).length === 0) delete next[provider]![scope];
  return next;
}

export type MaskedSecret = { saved: boolean; last4: string };
export type MaskedCredentials = Record<string, string | MaskedSecret>;

/// Cómo ve la marca sus llaves en Pagos: las públicas completas, las
/// secretas solo "guardada" y sus últimos 4 caracteres.
export function maskCredentials(provider: PaymentProviderId, values: CredentialValues | null): MaskedCredentials {
  const out: MaskedCredentials = {};
  for (const field of PAYMENT_PROVIDERS[provider].fields) {
    const value = values?.[field.key] ?? "";
    out[field.key] = field.secret ? { saved: Boolean(value), last4: value.slice(-4) } : value;
  }
  return out;
}

export type GatewayStatus = "NOT_CONNECTED" | "INCOMPLETE" | "TEST" | "ACTIVE";

/// Estado de una pasarela para la marca: solo la pasarela elegida puede
/// estar Activa / en Modo de prueba; las demás están conectadas (si tienen
/// llaves) pero no cobran.
export function gatewayStatus(brand: BrandGatewayFields, provider: PaymentProviderId): GatewayStatus {
  const mode = brand.paymentMode === "PRODUCTION" ? "PRODUCTION" : "TEST";
  const anyKey = storedCredentials(brand, provider, "TEST") || storedCredentials(brand, provider, "PRODUCTION");
  if (!anyKey) return "NOT_CONNECTED";
  if (!credentialsFor(brand, provider, mode)) return "INCOMPLETE";
  return mode === "PRODUCTION" ? "ACTIVE" : "TEST";
}

/// true cuando la pasarela tiene todo lo necesario para cobrar de verdad
/// (llaves de producción completas; en ePayco son las mismas).
export function hasProductionCredentials(brand: BrandGatewayFields, provider: PaymentProviderId): boolean {
  return credentialsFor(brand, provider, "PRODUCTION") !== null;
}

/// Pasarela "en vivo": la elegida, con llaves de producción y en modo real.
export function isLiveGateway(brand: BrandGatewayFields): boolean {
  const provider = brand.paymentProvider;
  return isPaymentProviderId(provider) && brand.paymentMode === "PRODUCTION" && hasProductionCredentials(brand, provider);
}
