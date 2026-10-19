import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/portal/settings-shell";
import { StorePaymentForm } from "@/components/portal/store-payment-form";
import { storePaymentInitial } from "@/server/payments/store-payment-initial";

export default async function TiendaPagosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsShell active="pagos">
      <StorePaymentForm initial={storePaymentInitial(profile)} />
      {/* "¿Cobras con otra pasarela?" (OtherGatewayForm) escondido por
          ahora — pedido del 2026-10-19. Las solicitudes ya guardadas se
          siguen viendo en Admin → Marcas. */}
    </SettingsShell>
  );
}
