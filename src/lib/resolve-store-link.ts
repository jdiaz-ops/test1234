/// Arma un link dentro de la vitrina a partir de lo que haya guardado la
/// marca — absoluto (http...) se deja tal cual, relativo se le antepone
/// basePath. Versión sin "use server"/next-headers (a diferencia de
/// getStoreBasePath) para poder usarse también desde componentes
/// cliente (ej. mobile-bottom-nav.tsx).
export function resolveStoreLink(link: string, basePath: string): string {
  if (!link) return basePath || "/";
  if (link.startsWith("http")) return link;
  if (link.startsWith("/")) return `${basePath}${link}`;
  return `${basePath}/${link}`;
}
