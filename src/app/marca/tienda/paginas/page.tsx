import { requireBrandProfile } from "@/lib/current-brand";
import { redirect } from "next/navigation";
import { StorePagesPanel } from "@/components/portal/store-pages-panel";
import { listStorePages } from "@/server/services/store-page-service";
import { StoreShell } from "@/components/portal/store-shell";

/// El menú de navegación se mudó a Diseño → "Menú de navegación" — es más
/// una decisión de diseño (qué ve el comprador en el header) que de
/// contenido. Ver conversación del 2026-09-14.
export default async function TiendaPaginasPage() {
  const profile = await requireBrandProfile();
  if (!profile) redirect("/login");

  const pages = await listStorePages(profile.id);

  return (
    <StoreShell active="paginas">
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Contenido propio de tu tienda — &ldquo;Sobre nosotros&rdquo;,
        preguntas frecuentes, y lo que quieras agregar.
      </p>
      <StorePagesPanel
        initialPages={pages.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          body: p.body,
        }))}
      />
    </StoreShell>
  );
}
