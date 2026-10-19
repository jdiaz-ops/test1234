import { prisma } from "@/lib/prisma";
import { publicStoreUrl } from "@/lib/store-url";

/// Sitemap de la tienda de una marca ({slug}.marcolini.lat/sitemap.xml o
/// su dominio propio): portada, colecciones, productos activos, páginas
/// y privacidad. Google lo necesita para indexar la tienda nueva cuando
/// la marca apaga la anterior. Ver conversación del 2026-10-18.
export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
    select: { id: true, storefrontSlug: true, customDomain: true, customDomainActiveAt: true, updatedAt: true },
  });
  const base = brand ? publicStoreUrl(brand) : null;
  if (!brand || !base) return new Response("No encontrada", { status: 404 });

  const [products, collections, pages] = await Promise.all([
    prisma.product.findMany({
      where: { brandId: brand.id, manual: true, status: "ACTIVE", slug: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.brandCollection.findMany({ where: { brandId: brand.id }, select: { slug: true }, take: 500 }),
    prisma.storePage.findMany({ where: { brandId: brand.id }, select: { slug: true, updatedAt: true }, take: 200 }),
  ]);
  const entries: { path: string; lastmod?: Date; priority: string }[] = [
    { path: "/", lastmod: brand.updatedAt, priority: "1.0" },
    { path: "/coleccion", priority: "0.8" },
    ...collections.map((c) => ({ path: `/coleccion/${c.slug}`, priority: "0.8" })),
    ...products.map((p) => ({ path: `/${p.slug}`, lastmod: p.updatedAt, priority: "0.7" })),
    ...pages.map((p) => ({ path: `/pagina/${p.slug}`, lastmod: p.updatedAt, priority: "0.4" })),
    { path: "/politica-de-privacidad", priority: "0.2" },
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (e) =>
        `<url><loc>${escapeXml(`${base}${e.path}`)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}<priority>${e.priority}</priority></url>`,
    ),
    "</urlset>",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
