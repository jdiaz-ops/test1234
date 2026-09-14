import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StorePagesPanel } from "@/components/portal/store-pages-panel";
import { StorefrontMenuPanel } from "@/components/portal/storefront-menu-panel";
import {
  listStorePages,
  listStorefrontMenuItems,
} from "@/server/services/store-page-service";

export default async function TiendaPaginasPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const [pages, menuItems] = await Promise.all([
    listStorePages(profile.id),
    listStorefrontMenuItems(profile.id),
  ]);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI TIENDA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Páginas
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Contenido propio de tu tienda — &ldquo;Sobre nosotros&rdquo;,
        preguntas frecuentes, y el menú de navegación que las conecta.
      </p>
      <StoreSubNav />
      <StorePagesPanel
        initialPages={pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          body: p.body,
        }))}
      />
      <StorefrontMenuPanel
        initialItems={menuItems.map((i) => ({
          id: i.id,
          label: i.label,
          url: i.url,
        }))}
      />
    </div>
  );
}
