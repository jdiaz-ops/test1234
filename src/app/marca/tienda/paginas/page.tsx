import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StoreSubNav } from "@/components/portal/store-sub-nav";
import { StorePagesPanel } from "@/components/portal/store-pages-panel";
import { listStorePages } from "@/server/services/store-page-service";

/// El menú de navegación se mudó a Diseño → "Menú de navegación" — es más
/// una decisión de diseño (qué ve el comprador en el header) que de
/// contenido. Ver conversación del 2026-09-14.
export default async function TiendaPaginasPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const pages = await listStorePages(profile.id);

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
        preguntas frecuentes, y lo que quieras agregar. Para el menú que
        conecta estas páginas, ve a Diseño → &ldquo;Menú de
        navegación&rdquo;.
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
    </div>
  );
}
