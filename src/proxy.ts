import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { extractSubdomainSlug, isPlatformHost, ROOT_DOMAIN } from "@/lib/subdomain";
import { prisma } from "@/lib/prisma";

const roleHome: Record<string, string> = {
  CREATOR: "/creador",
  BRAND: "/marca",
  ADMIN: "/admin",
};

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const session = req.auth;
  const host = req.headers.get("host");

  // Las rutas de API arman sus URLs (fetch) relativas al host actual —
  // nunca las toca la reescritura de abajo, o un fetch hecho desde el
  // subdominio (ej. /api/tienda/{slug}/ordenes) terminaría buscando
  // /t/{slug}/api/tienda/{slug}/ordenes, que no existe.
  const isApiRoute = pathname.startsWith("/api/");

  // ---- Subdominio de marca ({slug}.marcolini.lat) ----
  // Se resuelve ANTES que el resto — un subdominio de marca nunca es el
  // portal de marca/creador/admin (esos solo viven en el dominio raíz), así
  // que no debe pasar por el chequeo de sesión de abajo.
  const subdomainSlug = !isApiRoute ? extractSubdomainSlug(host) : null;
  if (subdomainSlug) {
    // Ya viene con el prefijo /t/{slug} (un link viejo absoluto que quedó
    // en el HTML, o alguien navegando a mano) — se reescribe tal cual, sin
    // volver a anteponer el prefijo.
    const alreadyPrefixed = pathname === `/t/${subdomainSlug}` || pathname.startsWith(`/t/${subdomainSlug}/`);
    const rewritten = req.nextUrl.clone();
    rewritten.pathname = alreadyPrefixed ? pathname : `/t/${subdomainSlug}${pathname === "/" ? "" : pathname}`;

    // Las páginas de la vitrina lo leen (ver src/lib/store-base-path.ts)
    // para armar sus propios links relativos al subdominio en vez de con
    // el prefijo /t/{slug} — así un clic dentro del sitio se queda en el
    // subdominio en vez de saltar de vuelta al dominio raíz.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-marcolini-subdomain", "1");
    return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
  }

  // ---- Dominio propio de una marca (ya verificado) ----
  // Cualquier host que no sea de Marcolini es candidato — si corresponde a
  // una marca con customDomainVerifiedAt puesto, se resuelve igual que un
  // subdominio (mismo rewrite a /t/{slug}). Si no existe o no está
  // verificado, se deja pasar tal cual — normalmente termina en 404, que
  // es lo correcto: nunca hay que reclamar tráfico de un dominio ajeno o
  // sin verificar.
  if (!isApiRoute && !isPlatformHost(host)) {
    const hostname = host?.split(":")[0].toLowerCase() ?? "";
    const brand = await prisma.brandProfile.findUnique({
      where: { customDomain: hostname },
      select: { storefrontSlug: true, customDomainVerifiedAt: true },
    });
    if (brand?.customDomainVerifiedAt && brand.storefrontSlug) {
      const slug = brand.storefrontSlug;
      const alreadyPrefixed = pathname === `/t/${slug}` || pathname.startsWith(`/t/${slug}/`);
      const rewritten = req.nextUrl.clone();
      rewritten.pathname = alreadyPrefixed ? pathname : `/t/${slug}${pathname === "/" ? "" : pathname}`;
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-marcolini-subdomain", "1");
      return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
    }
  }

  // ---- Link viejo /t/{slug} en el dominio raíz → redirect al subdominio ----
  // Los links que ya circulaban (compartidos antes de este cambio) siguen
  // funcionando — solo que ahora mandan al comprador al subdominio nuevo,
  // que es el que se sigue promocionando de acá en adelante.
  const legacyMatch = !isApiRoute ? pathname.match(/^\/t\/([a-z0-9-]+)(\/.*)?$/) : null;
  if (legacyMatch) {
    const [, slug, rest] = legacyMatch;
    const url = req.nextUrl.clone();
    url.hostname = `${slug}.${ROOT_DOMAIN}`;
    url.pathname = rest || "/";
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  const protectedPrefixes = ["/creador", "/marca", "/admin"];
  const matchedPrefix = protectedPrefixes.find((p) => pathname.startsWith(p));

  if (!matchedPrefix) return NextResponse.next();

  // Sin sesión: al login, recordando a dónde quería ir.
  if (!session?.user) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión, pero intentando entrar al portal de otro rol: lo mandamos a
  // su propio portal en vez de mostrarle un error confuso.
  const expectedPrefix = roleHome[session.user.role];
  if (expectedPrefix && !pathname.startsWith(expectedPrefix)) {
    return NextResponse.redirect(new URL(expectedPrefix, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Antes solo corría en /creador, /marca, /admin (el gate de sesión) —
  // ahora también tiene que correr en TODO lo demás para poder detectar el
  // subdominio de una marca y reescribir/redirigir. /api queda afuera a
  // propósito (ver isApiRoute arriba — nunca debía tocarlo, así que ni
  // vale la pena invocar el proxy ahí).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
