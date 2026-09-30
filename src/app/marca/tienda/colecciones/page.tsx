import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreCollectionsPanel } from "@/components/portal/store-collections-panel";
import { listBrandCollections } from "@/server/services/brand-collection-service";
import { ROOT_DOMAIN } from "@/lib/subdomain";

export default async function TiendaColeccionesPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const collections = await listBrandCollections(profile.id);

  // La dirección pública de la tienda, para armar el link de cada colección
  // (la marca lo copia para pegarlo en Instagram, el menú, etc.) — el
  // dominio propio si ya está verificado, si no el subdominio gratis. Sin
  // storefrontSlug todavía no hay link. Ver conversación del 2026-09-30.
  const storeUrl =
    profile.customDomain && profile.customDomainVerifiedAt
      ? `https://${profile.customDomain}`
      : profile.storefrontSlug
        ? `https://${profile.storefrontSlug}.${ROOT_DOMAIN}`
        : null;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Colecciones
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Agrupa tus productos — por temporada, tipo, lo que te sirva. Cada
        colección puede tener su propia imagen y descripción.
      </p>
      <StoreCollectionsPanel
        storeUrl={storeUrl}
        initialCollections={collections.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl,
          productCount: c._count.products,
        }))}
      />
    </div>
  );
}
