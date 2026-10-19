/// Lo puro del dominio propio de una marca (ver custom-domain-service.ts y
/// src/proxy.ts), para usarlo igual en el servidor, el proxy y las
/// pantallas.

/// Terminaciones de dos partes comunes en la región: en tumarca.com.co el
/// dominio principal tiene tres partes, no dos.
const TWO_PART_SUFFIXES = new Set([
  "com.co",
  "net.co",
  "org.co",
  "edu.co",
  "gov.co",
  "nom.co",
  "mil.co",
  "com.mx",
  "org.mx",
  "net.mx",
  "com.ar",
  "com.pe",
  "com.ec",
  "com.bo",
  "com.py",
  "com.uy",
  "com.ve",
  "com.br",
  "com.pa",
  "com.gt",
  "com.do",
  "co.cr",
  "com.es",
  "co.uk",
]);

/// El dominio principal, sin subdominio: tienda.tumarca.com → tumarca.com;
/// tumarca.com.co se queda igual.
export function apexOf(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  const size = TWO_PART_SUFFIXES.has(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.slice(-size).join(".");
}

export function isApexDomain(domain: string) {
  return apexOf(domain) === domain.toLowerCase();
}

/// La otra forma del mismo dominio que también tiene que abrir la tienda:
/// con tumarca.com, www.tumarca.com (y al revés). Esa lleva a la principal.
/// Un subdominio como tienda.tumarca.com no tiene otra forma.
export function companionDomain(domain: string): string | null {
  const name = domain.toLowerCase();
  const apex = apexOf(name);
  if (name === apex) return `www.${apex}`;
  if (name === `www.${apex}`) return apex;
  return null;
}

/// A dónde lleva el subdominio ({slug}.marcolini.lat) cuando la marca ya
/// tiene su dominio propio activo: la misma página allá. Si el comprador
/// traía la atribución de una creadora en este subdominio (cookie mkl_ref,
/// ver src/proxy.ts) y el link no trae otra, viaja en la dirección para que
/// el dominio propio la guarde con el tiempo que le quedaba (ref_at).
export function customDomainRedirectUrl(input: {
  customDomain: string;
  slug: string;
  pathname: string;
  search: string;
  ref?: string | null;
  refAt?: string | null;
}): string {
  const prefix = `/t/${input.slug}`;
  const path =
    input.pathname === prefix || input.pathname.startsWith(`${prefix}/`)
      ? input.pathname.slice(prefix.length) || "/"
      : input.pathname || "/";
  const url = new URL(`https://${input.customDomain}${path}${input.search}`);
  if (input.ref && !url.searchParams.has("ref")) {
    url.searchParams.set("ref", input.ref);
    if (input.refAt) url.searchParams.set("ref_at", input.refAt);
  }
  return url.toString();
}

/// Atribución por cookie de primera parte (ver src/proxy.ts): el código de
/// la creadora con el que llegó el comprador, por 30 días.
export const REF_COOKIE = "mkl_ref";
/// Cuándo se guardó (segundos desde 1970), para que al pasar al dominio
/// propio dure lo que le quedaba y no 30 días de nuevo.
export const REF_AT_COOKIE = "mkl_ref_at";
export const REF_MAX_AGE = 60 * 60 * 24 * 30;

/// Segundos que le quedan a una atribución guardada en `at`. Sin `at` (un
/// link nuevo de una creadora) o con uno raro, los 30 días completos; 0 si
/// ya venció.
export function refRemainingSeconds(at: number | null, nowSeconds: number): number {
  if (at == null || !Number.isFinite(at) || at <= 0 || at > nowSeconds) return REF_MAX_AGE;
  return Math.max(0, REF_MAX_AGE - (nowSeconds - at));
}
