import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StoreCollectionsPanel } from "@/components/portal/store-collections-panel";
import { listBrandCollections } from "@/server/services/brand-collection-service";

export default async function TiendaColeccionesPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const collections = await listBrandCollections(profile.id);

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
      <StoreSubNav />
      <StoreCollectionsPanel
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
