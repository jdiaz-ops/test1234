import type { BrandProfile } from "@prisma/client";
import type { ProviderInitial, StorePaymentInitial } from "@/components/portal/store-payment-form";
import { gatewayStatus, maskCredentials, storedCredentials, type BrandGatewayFields } from "@/server/payments/credentials";
import { PAYMENT_PROVIDERS, PAYMENT_PROVIDER_IDS, isPaymentProviderId, offeredPaymentProviders, type PaymentProviderId } from "@/lib/payment-providers";
import { portalUrl } from "@/lib/store-url";

/// Lo que necesita StorePaymentForm para arrancar: en Configuración →
/// Pagos y en el paso "Conecta tus pagos" del Dashboard (ver go-live-card).
/// Las llaves secretas nunca viajan completas al navegador: solo si están
/// guardadas y sus últimos 4 caracteres (ver maskCredentials).
export function storePaymentInitial(profile: BrandGatewayFields & Pick<BrandProfile, "id" | "storefrontSlug">): StorePaymentInitial {
  const providers = Object.fromEntries(
    PAYMENT_PROVIDER_IDS.map((id) => {
      const spec = PAYMENT_PROVIDERS[id];
      const credentials =
        spec.scopes === "SHARED"
          ? { SHARED: maskCredentials(id, storedCredentials(profile, id, "TEST")) }
          : {
              TEST: maskCredentials(id, storedCredentials(profile, id, "TEST")),
              PRODUCTION: maskCredentials(id, storedCredentials(profile, id, "PRODUCTION")),
            };
      const initial: ProviderInitial = {
        status: gatewayStatus(profile, id),
        credentials,
        webhookUrl: spec.webhook ? `${portalUrl()}${spec.webhook.path(profile.id)}` : null,
      };
      return [id, initial];
    }),
  ) as Record<PaymentProviderId, ProviderInitial>;
  const activeProvider = isPaymentProviderId(profile.paymentProvider) ? profile.paymentProvider : null;
  return {
    activeProvider,
    paymentMode: profile.paymentMode === "PRODUCTION" ? "PRODUCTION" : "TEST",
    providers,
    offered: offeredPaymentProviders(profile.storefrontSlug, activeProvider),
  };
}
