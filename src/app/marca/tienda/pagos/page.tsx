import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/portal/settings-shell";
import { StorePaymentForm } from "@/components/portal/store-payment-form";
import { maskSecret, wompiStatus } from "@/server/services/brand-payment-service";
import { portalUrl } from "@/lib/store-url";

export default async function TiendaPagosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsShell active="pagos">
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
    </SettingsShell>
  );
}
