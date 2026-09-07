/// Subdominio gratis por defecto para cada marca — {slug}.marcolini.lat en
/// vez de solo marcolini.lat/t/{slug}. Mismo storefrontSlug de siempre, solo
/// que ahora también resuelve como host completo (ver src/proxy.ts, que
/// reescribe la petición a /t/{slug} por dentro sin que el navegador lo
/// note). En desarrollo no hay DNS real para *.marcolini.lat, así que
/// también se reconoce el mismo patrón bajo *.localhost (los navegadores
/// modernos resuelven cualquier *.localhost a 127.0.0.1 solos, sin tocar
/// /etc/hosts) para poder probarlo.
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "marcolini.lat";

/// Nunca se pueden usar como storefrontSlug — colisionarían con una parte
/// real de la infraestructura (marcolini.lat, api.marcolini.lat, etc.) o
/// serían confusos/spoofeables (admin.marcolini.lat pareciendo oficial).
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "email",
  "smtp",
  "ftp",
  "blog",
  "docs",
  "status",
  "cdn",
  "assets",
  "static",
  "img",
  "images",
  "help",
  "soporte",
  "support",
  "dev",
  "staging",
  "test",
  "demo",
  "shop",
  "store",
  "tienda",
  "marcolini",
]);

/// Dado el header Host de una petición (puede traer puerto, ej.
/// "marca1.localhost:3000"), devuelve el slug del subdominio si aplica —
/// null si es el dominio raíz, un subdominio reservado, o no matchea el
/// patrón esperado.
export function extractSubdomainSlug(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase();

  for (const root of [ROOT_DOMAIN, "localhost"]) {
    if (hostname === root) return null; // dominio raíz, sin subdominio
    if (hostname.endsWith(`.${root}`)) {
      const label = hostname.slice(0, -(`.${root}`.length));
      // Un solo nivel de subdominio (nada de a.b.marcolini.lat) y sin
      // puntos sueltos raros.
      if (!label || label.includes(".")) return null;
      if (RESERVED_SUBDOMAINS.has(label)) return null;
      return label;
    }
  }
  return null;
}
