import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/shopify-csv";
import { getDraftTheme, publishTheme, updateDraftTheme } from "@/server/services/brand-theme-store";
import { createStorePage, StorePageError } from "@/server/services/store-page-service";
import { saveRedirects } from "@/server/services/storefront-redirect-service";

/// Crea como Páginas propias lo que se leyó de Shopify: las páginas
/// enlazadas en la portada (Quiénes somos, Contacto…) y las políticas
/// (envíos, cambios, privacidad, términos). Una página que ya exista
/// (mismo slug o título) se deja como está. Al final prende la segunda
/// columna del pie de página ("Información"), que lista las páginas (ver
/// store-footer.tsx). Ver conversación del 2026-10-18.

export type ImportPageInput = {
  handle: string;
  title: string;
  body: string;
  kind: "page" | "policy";
};

export type ImportPageResult = {
  handle: string;
  title: string;
  slug: string;
  action: "created" | "existing" | "error";
  error?: string;
};

export async function importShopifyPages(brandId: string, pages: ImportPageInput[]) {
  const existing = await prisma.storePage.findMany({ where: { brandId }, select: { slug: true, title: true } });
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  const byTitle = new Map(existing.map((p) => [p.title.trim().toLowerCase(), p]));
  const results: ImportPageResult[] = [];

  for (const input of pages) {
    const handle = input.handle.trim().toLowerCase();
    const title = input.title.trim();
    try {
      const found = bySlug.get(slugify(handle)) ?? bySlug.get(slugify(title)) ?? byTitle.get(title.toLowerCase());
      const oldPath = input.kind === "policy" ? `/policies/${handle}` : `/pages/${handle}`;
      if (found) {
        results.push({ handle, title: found.title, slug: found.slug, action: "existing" });
        await saveRedirects(brandId, [{ fromPath: oldPath, toPath: `/pagina/${found.slug}` }]);
        continue;
      }
      const created = await createStorePage(brandId, { title, body: input.body });
      bySlug.set(created.slug, created);
      byTitle.set(created.title.trim().toLowerCase(), created);
      results.push({ handle, title: created.title, slug: created.slug, action: "created" });
      // El link viejo (/pages/x o /policies/x) sigue llegando a la página.
      await saveRedirects(brandId, [{ fromPath: oldPath, toPath: `/pagina/${created.slug}` }]);
    } catch (err) {
      console.error(`[paginas-shopify] "${handle}":`, err);
      results.push({
        handle,
        title,
        slug: "",
        action: "error",
        error: err instanceof StorePageError ? err.message : "No se pudo crear esta página.",
      });
    }
  }

  // Que se vean: la columna "Información" del pie de página.
  let footerEnabled = false;
  if (results.some((r) => r.action !== "error")) {
    const draft = await getDraftTheme(brandId);
    if (!draft.footer.menuSecondary.show) {
      await updateDraftTheme(brandId, {
        footer: { menuSecondary: { show: true, title: draft.footer.menuSecondary.title || "Información" } },
      });
      await publishTheme(brandId);
      footerEnabled = true;
    }
  }
  return { pages: results, footerEnabled };
}
