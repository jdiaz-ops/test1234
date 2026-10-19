import { prisma } from "@/lib/prisma";
import { publicStoreUrl } from "@/lib/store-url";

/// robots.txt de la tienda de una marca: todo indexable menos el carrito,
/// el checkout y los pedidos, y el link al sitemap (ver sitemap.xml).
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
    select: { storefrontSlug: true, customDomain: true, customDomainActiveAt: true },
  });
  const base = brand ? publicStoreUrl(brand) : null;
  if (!base) return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const body = ["User-agent: *", "Allow: /", "Disallow: /carrito", "Disallow: /checkout", "Disallow: /pedido/", "Disallow: /buscar", "", `Sitemap: ${base}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
