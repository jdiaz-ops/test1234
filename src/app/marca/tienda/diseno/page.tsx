import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { DesignEditorPanel } from "@/components/portal/design-editor/design-editor-panel";
import { getDraftTheme } from "@/server/services/brand-theme-service";
import { listStorePages } from "@/server/services/store-page-service";
import { listStorefrontSections } from "@/server/services/storefront-section-service";
import { SECTION_TYPES, type SectionType } from "@/lib/storefront-sections";

/// Editor de Diseño — mismo panel único que Tiendanube: colores,
/// tipografía, encabezado, barra de anuncio, "Página de inicio" (las
/// secciones tipo banner/colección/productos destacados — antes vivían
/// solo en Plantilla, separadas; ahora están acá también, que es donde
/// las esperabas — ver conversación del 2026-09-14), footer, listado/
/// detalle de producto, carrito, pop-up y CSS avanzado.
export default async function TiendaDisenoPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [theme, pages, sections] = await Promise.all([
    getDraftTheme(profile.id),
    listStorePages(profile.id),
    listStorefrontSections(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Diseño
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Colores, tipografía y todo lo que hace que tu tienda se sienta
        tuya. Nada de esto se ve en tu tienda hasta que le des &ldquo;Publicar
        cambios&rdquo;.
      </p>
      <StoreSubNav />
      <DesignEditorPanel
        initialTheme={theme}
        storePages={pages.map((p) => ({ slug: p.slug, title: p.title }))}
        initialSections={sections
          .filter((s): s is typeof s & { type: SectionType } =>
            (SECTION_TYPES as readonly string[]).includes(s.type),
          )
          .map((s) => ({ id: s.id, type: s.type, enabled: s.enabled, config: s.config }))}
      />
    </div>
  );
}
