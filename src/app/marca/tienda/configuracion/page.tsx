import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreConfigForm } from "@/components/portal/store-config-form";
import { CustomDomainForm } from "@/components/portal/custom-domain-form";
import { StorefrontTemplateForm } from "@/components/portal/storefront-template-form";

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
      {profile.storefrontSlug && (
        <div className="mb-4">
          <p className="text-sm text-brand-ink">
            Tu tienda vive en{" "}
            <span className="font-mono text-brand-accent">
              {profile.storefrontSlug}.marcolini.lat
            </span>
          </p>
          <a
            href={`/t/${profile.storefrontSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-accent hover:underline"
          >
            Ver tu tienda en vivo →
          </a>
        </div>
      )}
      <StoreConfigForm initialSlug={profile.storefrontSlug ?? ""} />

      <CustomDomainForm
        initialDomain={profile.customDomain}
        initialToken={profile.customDomainVerificationToken}
        initialVerified={profile.customDomainVerifiedAt != null}
      />

      <StorefrontTemplateForm initialTemplate={profile.storefrontTemplate} />
    </div>
  );
}
