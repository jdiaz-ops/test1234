import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StorefrontTemplateForm } from "@/components/portal/storefront-template-form";

export default async function TiendaPlantillaPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Plantilla
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Cómo se ve tu catálogo en la página principal de tu tienda.
      </p>
      <StoreSubNav />
      <StorefrontTemplateForm initialTemplate={profile.storefrontTemplate} />
    </div>
  );
}
