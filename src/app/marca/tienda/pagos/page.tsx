import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/portal/settings-shell";
import { StorePaymentForm, type ProviderInitial } from "@/components/portal/store-payment-form";
import { OtherGatewayForm } from "@/components/portal/other-gateway-form";
import { listGatewayRequests } from "@/server/services/payment-gateway-request-service";
import { gatewayStatus, maskCredentials, storedCredentials } from "@/server/payments/credentials";
import { needsIntegration } from "@/lib/payment-gateways";
import { PAYMENT_PROVIDERS, PAYMENT_PROVIDER_IDS, isPaymentProviderId, type PaymentProviderId } from "@/lib/payment-providers";
import { portalUrl } from "@/lib/store-url";

export default async function TiendaPagosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");
  // Solo las pasarelas que de verdad faltan: una que pidió antes y ya
  // está integrada se conecta arriba.
  const gatewayRequests = (await listGatewayRequests(profile.id)).map((r) => r.gateway).filter(needsIntegration);

  // Las llaves secretas nunca viajan completas al navegador: solo si
  // están guardadas y sus últimos 4 caracteres (ver maskCredentials).
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

  return (
    <SettingsShell active="pagos">
      <StorePaymentForm
        initial={{
          activeProvider: isPaymentProviderId(profile.paymentProvider) ? profile.paymentProvider : null,
          paymentMode: profile.paymentMode === "PRODUCTION" ? "PRODUCTION" : "TEST",
          providers,
        }}
      />
      <OtherGatewayForm initialRequests={gatewayRequests} />
    </SettingsShell>
  );
}
