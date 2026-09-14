import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreConfigForm } from "@/components/portal/store-config-form";
import { CustomDomainForm } from "@/components/portal/custom-domain-form";
import { TaxConfigForm } from "@/components/portal/tax-config-form";

export default async function TiendaConfiguracionPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Configuración
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        El link público de tu tienda dentro de Marcolini.
      </p>
      <StoreSubNav />
      {/* El link real es siempre este subdominio (o un dominio propio, ver
          CustomDomainForm) — StoreConfigForm ya lo muestra/edita en ese
          mismo formato, así que acá solo queda el atajo para verla en
          vivo. Antes había otro bloque arriba repitiendo el mismo link en
          formato distinto (marcolini.lat/t/{slug}, que solo existe como
          redirect legado hacia acá — ver proxy.ts) y confundía. Ver
          conversación del 2026-09-14. */}
      {profile.storefrontSlug && (
        <a
          href={`/t/${profile.storefrontSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-brand-accent hover:underline mb-4"
        >
          Ver tu tienda en vivo →
        </a>
      )}
      <StoreConfigForm initialSlug={profile.storefrontSlug ?? ""} />

      <CustomDomainForm
        initialDomain={profile.customDomain}
        initialToken={profile.customDomainVerificationToken}
        initialVerified={profile.customDomainVerifiedAt != null}
      />

      <TaxConfigForm
        initialMarket={profile.market}
        initialTaxRatePercent={Number(profile.taxRatePercent)}
      />
    </div>
  );
}
