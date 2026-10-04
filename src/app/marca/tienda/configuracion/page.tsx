import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { SettingsShell } from "@/components/portal/settings-shell";
import { BrandProfileForm } from "@/components/portal/brand-profile-form";
import { publicStoreUrl } from "@/lib/store-url";
import { StoreConfigForm } from "@/components/portal/store-config-form";
import { CustomDomainForm } from "@/components/portal/custom-domain-form";
import { TaxConfigForm } from "@/components/portal/tax-config-form";
import { CUSTOM_DOMAIN_ENABLED } from "@/lib/features";

export default async function TiendaConfiguracionPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <SettingsShell active="general">
      {/* Perfil del negocio (antes en Cuenta) y, debajo, la tienda. */}
      <h3 className="font-display font-semibold text-brand-ink mb-3">Perfil del negocio</h3>
      <BrandProfileForm
        storeUrl={publicStoreUrl(profile)}
        initial={{
          companyName: profile.companyName,
          legalName: profile.legalName ?? "",
          taxId: profile.taxId ?? "",
          description: profile.description ?? "",
          city: profile.city ?? "",
          websiteUrl: profile.websiteUrl ?? "",
          phone: profile.phone ?? "",
          fiscalAddress: profile.fiscalAddress ?? "",
          instagramHandle: profile.instagramHandle ?? "",
          tiktokHandle: profile.tiktokHandle ?? "",
        }}
        files={{
          logoUrl: profile.logoUrl,
          faviconUrl: profile.faviconUrl,
          rutDocumentUrl: profile.rutDocumentUrl,
          camaraComercioUrl: profile.camaraComercioUrl,
        }}
      />

      <h3 className="font-display font-semibold text-brand-ink mt-12 mb-1">Tu tienda</h3>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        El link de tu tienda y el IVA de tus precios.
      </p>
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

      {CUSTOM_DOMAIN_ENABLED && (
        <CustomDomainForm
          initialDomain={profile.customDomain}
          initialToken={profile.customDomainVerificationToken}
          initialVerified={profile.customDomainVerifiedAt != null}
        />
      )}

      <TaxConfigForm
        initialMarket={profile.market}
        initialTaxRatePercent={Number(profile.taxRatePercent)}
      />
    </SettingsShell>
  );
}
