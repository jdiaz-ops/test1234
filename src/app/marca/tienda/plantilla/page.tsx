import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StorefrontTemplateForm } from "@/components/portal/storefront-template-form";

/// Los módulos de la página de inicio (banners, colecciones, productos
/// destacados, etc.) se mudaron a Diseño → "Página de inicio" — vivían
/// acá antes, duplicados con nada, pero separados del resto del editor
/// de diseño, que es donde la marca los espera (ver conversación del
/// 2026-09-14). Esta página quedó solo para elegir la plantilla visual
/// del catálogo (Clásica/Minimal/Editorial), que es un tema aparte.
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
        Elige cómo se ordenan y se ven las tarjetas de producto en el
        catálogo de tu tienda. Para los módulos de la página de inicio
        (banners, colecciones destacadas, etc.), ve a Diseño → &ldquo;Página
        de inicio&rdquo;.
      </p>
      <StoreSubNav />
      <StorefrontTemplateForm initialTemplate={profile.storefrontTemplate} />
    </div>
  );
}
