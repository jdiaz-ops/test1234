import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StorePaymentForm } from "@/components/portal/store-payment-form";

export default async function TiendaPagosPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Pagos
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Conecta tu propia pasarela de pago — el dinero de cada venta llega
        directo a tu cuenta, Marcolini nunca lo recibe.
      </p>
      <StoreSubNav />
      <StorePaymentForm
        initial={{
          paymentProvider: profile.paymentProvider,
          paymentMode: profile.paymentMode,
          wompiPublicKeyTest: profile.wompiPublicKeyTest ?? "",
          wompiPrivateKeyTest: profile.wompiPrivateKeyTest ?? "",
          wompiEventsKeyTest: profile.wompiEventsKeyTest ?? "",
          wompiIntegrityKeyTest: profile.wompiIntegrityKeyTest ?? "",
          wompiPublicKeyProd: profile.wompiPublicKeyProd ?? "",
          wompiPrivateKeyProd: profile.wompiPrivateKeyProd ?? "",
          wompiEventsKeyProd: profile.wompiEventsKeyProd ?? "",
          wompiIntegrityKeyProd: profile.wompiIntegrityKeyProd ?? "",
        }}
      />
    </div>
  );
}
