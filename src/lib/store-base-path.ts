import { headers } from "next/headers";

/// Base para armar links DENTRO de la vitrina de una marca — "" cuando la
/// petición llegó por el subdominio de la marca ({slug}.marcolini.lat, ya
/// reescrita por dentro a /t/{slug} — ver src/proxy.ts) para que los links
/// generados se queden relativos al subdominio, o "/t/{slug}" cuando
/// todavía se está sirviendo bajo el path viejo (alguien entró directo,
/// sin pasar por el proxy — no debería pasar en producción una vez el
/// subdominio esté armado, pero sirve de respaldo).
export async function getStoreBasePath(slug: string): Promise<string> {
  const h = await headers();
  const isSubdomain = h.get("x-marcolini-subdomain") === "1";
  return isSubdomain ? "" : `/t/${slug}`;
}
