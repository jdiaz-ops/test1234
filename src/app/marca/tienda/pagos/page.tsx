import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSettingsTabs } from "@/components/portal/store-settings-tabs";
import { StorePaymentForm } from "@/components/portal/store-payment-form";
import { maskSecret, wompiStatus } from "@/server/services/brand-payment-service";
import { portalUrl } from "@/lib/store-url";

export default async function TiendaPagosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-4">
        Configuración
      </h1>
      <StoreSettingsTabs active="pagos" />
      <StorePaymentForm
        initial={{
          status: wompiStatus(profile),
          paymentMode: profile.paymentMode,
          // Las llaves secretas nunca viajan completas al navegador: solo
          // si están guardadas y sus últimos 4 caracteres.
          prod: {
            publicKey: profile.wompiPublicKeyProd ?? "",
            privateKey: maskSecret(profile.wompiPrivateKeyProd),
            eventsKey: maskSecret(profile.wompiEventsKeyProd),
            integrityKey: maskSecret(profile.wompiIntegrityKeyProd),
          },
          test: {
            publicKey: profile.wompiPublicKeyTest ?? "",
            privateKey: maskSecret(profile.wompiPrivateKeyTest),
            eventsKey: maskSecret(profile.wompiEventsKeyTest),
            integrityKey: maskSecret(profile.wompiIntegrityKeyTest),
          },
          eventsUrl: `${portalUrl()}/api/webhooks/wompi`,
        }}
      />
    </div>
  );
}
