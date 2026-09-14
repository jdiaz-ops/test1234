import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StorefrontTemplateForm } from "@/components/portal/storefront-template-form";
import { StorefrontSectionsPanel } from "@/components/portal/storefront-sections-panel";
import { listStorefrontSections } from "@/server/services/storefront-section-service";
import { SECTION_TYPES, type SectionType } from "@/lib/storefront-sections";

export default async function TiendaPlantillaPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const sections = await listStorefrontSections(profile.id);

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
      <div className="space-y-6">
        <StorefrontSectionsPanel
          initialSections={sections
            // WELCOME_MESSAGE/INSTITUTIONAL_MESSAGE/IMAGE_TEXT_MODULE
            // quedaron reservados sin usar (ver el enum en el schema) —
            // nunca debería existir una fila con ese tipo, pero se
            // filtra por las dudas en vez de reventar el editor.
            .filter((s): s is typeof s & { type: SectionType } =>
              (SECTION_TYPES as readonly string[]).includes(s.type),
            )
            .map((s) => ({
              id: s.id,
              type: s.type,
              enabled: s.enabled,
              config: s.config,
            }))}
        />
        <StorefrontTemplateForm initialTemplate={profile.storefrontTemplate} />
      </div>
    </div>
  );
}
