import { auth } from "@/auth";
import { NextResponse, type NextRequest } from "next/server";
import { extractSubdomainSlug, isPlatformHost, ROOT_DOMAIN } from "@/lib/subdomain";
import { prisma } from "@/lib/prisma";
import { slugTakenByBrand } from "@/lib/creator-identity";
import { rememberFor } from "@/lib/remember-for";
import { apexOf, customDomainRedirectUrl, REF_AT_COOKIE, REF_COOKIE, REF_MAX_AGE, refRemainingSeconds } from "@/lib/custom-domain";

/// Lo que el proxy consulta en cada visita a una tienda (cada página y cada
/// carga de datos), recordado un minuto por instancia del servidor: Prisma
/// Postgres cobra cada consulta, y el 2026-10-23 se acabó el plan gratis y
/// la base se bloqueó. Lo peor del minuto: un dominio propio recién
/// verificado o activo puede tardar hasta 60 s en abrir o en recibir el
/// subdominio. En las pruebas no recuerda nada.
const MEMORY_MS = process.env.NODE_ENV === "test" ? 0 : 60_000;
const creatorBySlug = rememberFor(MEMORY_MS, (slug) =>
  prisma.creatorProfile.findUnique({ where: { storefrontSlug: slug }, select: { id: true } }),
);
const brandSlugTaken = rememberFor(MEMORY_MS, slugTakenByBrand);
const brandBySlug = rememberFor(MEMORY_MS, (slug) =>
  prisma.brandProfile.findUnique({ where: { storefrontSlug: slug }, select: { customDomain: true, customDomainActiveAt: true } }),
);
const brandByDomain = rememberFor(MEMORY_MS, (domain) =>
  prisma.brandProfile.findUnique({
    where: { customDomain: domain },
    select: { storefrontSlug: true, customDomainVerifiedAt: true, customDomainActiveAt: true },
  }),
);

const roleHome: Record<string, string> = {
  CREATOR: "/creador",
  BRAND: "/marca",
  ADMIN: "/admin",
  ALLY: "/aliado",
};

/// Atribución por cookie de primera parte (complementa el código de
/// descuento escrito a mano — ver checkout-form.tsx): si el link con el
/// que llegó el comprador trae ?ref={código} (ver buildProductLink en
/// lib/brand-store-link.ts), se lo guardamos en una cookie propia de este
/// origen — subdominio o dominio propio, cada marca ya vive en el suyo,
/// así que Path=/ no se cruza entre marcas — por 30 días. Si compra sin
/// escribir el código a mano, igual se le atribuye a este creador. Al
/// lado va cuándo se guardó (mkl_ref_at): si viene del subdominio rumbo al
/// dominio propio (?ref_at, ver customDomainRedirectUrl), la cookie dura lo
/// que le quedaba, no 30 días de nuevo.
function withRefCookie(response: NextResponse, req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref");
  if (ref) {
    const now = Math.floor(Date.now() / 1000);
    const at = Number(req.nextUrl.searchParams.get("ref_at")) || null;
    const maxAge = refRemainingSeconds(at, now);
    if (maxAge > 0) {
      const options = { path: "/", maxAge, sameSite: "lax" as const };
      response.cookies.set(REF_COOKIE, ref, options);
      // Desde cuándo cuenta: el ref_at que traía o, con un link nuevo, ahora.
      response.cookies.set(REF_AT_COOKIE, String(now - (REF_MAX_AGE - maxAge)), options);
    }
  }
  return response;
}

export default auth(async (req) => {
  const { pathname, search } = req.nextUrl;
  const session = req.auth;
  const host = req.headers.get("host");

  // Las rutas de API arman sus URLs (fetch) relativas al host actual —
  // nunca las toca la reescritura de abajo, o un fetch hecho desde el
  // subdominio (ej. /api/tienda/{slug}/ordenes) terminaría buscando
  // /t/{slug}/api/tienda/{slug}/ordenes, que no existe.
  const isApiRoute = pathname.startsWith("/api/");
  // Dentro de un iframe no se redirige: la vista previa del editor de
  // Diseño carga /t/{slug} en el mismo dominio del portal para que viaje
  // la sesión de la marca y la vitrina muestre el borrador (ver
  // getStorefrontTheme) — al subdominio la cookie de sesión no llega. Ver
  // conversación del 2026-09-30.
  const inIframe = req.headers.get("sec-fetch-dest") === "iframe";

  // ---- Subdominio de marca ({slug}.marcolini.lat) ----
  // Se resuelve ANTES que el resto — un subdominio de marca nunca es el
  // portal de marca/creador/admin (esos solo viven en el dominio raíz), así
  // que no debe pasar por el chequeo de sesión de abajo.
  const subdomainSlug = !isApiRoute ? extractSubdomainSlug(host) : null;

  // ---- Vitrina de creador ({slug}.marcolini.lat) ----
  // Marcas y creadores comparten los nombres de subdominio (nadie puede
  // tomar uno ya usado, ver generateUniqueStorefrontSlug y
  // saveStorefrontSlug); si quedó un choque de antes, gana la marca.
  if (subdomainSlug) {
    const creator = await creatorBySlug(subdomainSlug);
    // Link viejo con guiones (nail-fest.marcolini.lat): las vitrinas
    // quedaron sin guiones (migración 20261002230000) → al nuevo.
    if (!creator && subdomainSlug.includes("-")) {
      const compact = subdomainSlug.replace(/-/g, "");
      const moved = await creatorBySlug(compact);
      const brandHere = await brandSlugTaken(subdomainSlug);
      if (moved && !brandHere) {
        const url = req.nextUrl.clone();
        url.hostname = `${compact}.${ROOT_DOMAIN}`;
        return NextResponse.redirect(url, 308);
      }
    }
    if (creator && !(await brandSlugTaken(subdomainSlug))) {
      const prefix = `/c/${subdomainSlug}`;
      const alreadyPrefixed = pathname === prefix || pathname.startsWith(`${prefix}/`);
      const rewritten = req.nextUrl.clone();
      rewritten.pathname = alreadyPrefixed ? pathname : `${prefix}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(rewritten);
    }
  }

  if (subdomainSlug) {
    // ---- Con dominio propio activo, el subdominio lleva allá ----
    // A la misma página, con la atribución de la creadora que traía el
    // comprador en este subdominio (ver customDomainRedirectUrl). Solo
    // cuando el dominio ya abre la tienda (customDomainActiveAt): antes,
    // el subdominio sigue siendo la tienda. Así los links ya compartidos,
    // los QR y lo que tiene Google siguen sirviendo.
    if (!inIframe) {
      const brand = await brandBySlug(subdomainSlug);
      if (brand?.customDomain && brand.customDomainActiveAt) {
        const target = customDomainRedirectUrl({
          customDomain: brand.customDomain,
          slug: subdomainSlug,
          pathname,
          search,
          ref: req.cookies.get(REF_COOKIE)?.value,
          refAt: req.cookies.get(REF_AT_COOKIE)?.value,
        });
        return NextResponse.redirect(target, 308);
      }
    }

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
    // La dirección tal cual la pidió el comprador — si es un link viejo de
    // una tienda a la que Marcolini le cambió el link, el layout de la
    // vitrina lo manda a la misma página en el link nuevo (ver
    // BrandSlugRedirect).
    requestHeaders.set("x-marcolini-path", `${alreadyPrefixed ? pathname.slice(`/t/${subdomainSlug}`.length) || "/" : pathname}${search}`);
    return withRefCookie(NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } }), req);
  }

  // ---- Dominio propio de una marca (ya verificado) ----
  // Cualquier host que no sea de Marcolini es candidato — si corresponde a
  // una marca con customDomainVerifiedAt puesto, se resuelve igual que un
  // subdominio (mismo rewrite a /t/{slug}). Desde que es suyo abre la
  // tienda, aunque los links todavía no lo usen (eso espera a que esté
  // activo, ver publicStoreUrl): así se puede comprobar que ya funciona.
  // Si no existe o no está verificado, se deja pasar tal cual —
  // normalmente termina en 404, que es lo correcto: nunca hay que reclamar
  // tráfico de un dominio ajeno o sin verificar.
  if (!isApiRoute && !isPlatformHost(host)) {
    const hostname = host?.split(":")[0].toLowerCase() ?? "";
    const brand = await brandByDomain(hostname);
    // La otra forma del dominio (www.tumarca.com si la marca puso
    // tumarca.com, o al revés) lleva al que eligió la marca, por si Vercel
    // todavía no tiene esa redirección — solo cuando ese ya abre la tienda.
    if (!brand) {
      const apex = apexOf(hostname);
      const main = hostname === apex ? `www.${apex}` : hostname === `www.${apex}` ? apex : null;
      const owner = main ? await brandByDomain(main) : null;
      if (main && owner?.customDomainActiveAt) {
        const url = new URL(`https://${main}${pathname}${search}`);
        return NextResponse.redirect(url, 308);
      }
    }
    if (brand?.customDomainVerifiedAt && brand.storefrontSlug) {
      const slug = brand.storefrontSlug;
      const alreadyPrefixed = pathname === `/t/${slug}` || pathname.startsWith(`/t/${slug}/`);
      const rewritten = req.nextUrl.clone();
      rewritten.pathname = alreadyPrefixed ? pathname : `/t/${slug}${pathname === "/" ? "" : pathname}`;
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-marcolini-subdomain", "1");
      return withRefCookie(NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } }), req);
    }
  }

  // ---- Link viejo /t/{slug} en el dominio raíz → redirect al subdominio ----
  // Los links que ya circulaban (compartidos antes de este cambio) siguen
  // funcionando — solo que ahora mandan al comprador al subdominio nuevo,
  // que es el que se sigue promocionando de acá en adelante.
  const legacyMatch = !isApiRoute ? pathname.match(/^\/t\/([a-z0-9-]+)(\/.*)?$/) : null;
  // (Si la marca tiene dominio propio activo, el subdominio lleva allá.)
  if (legacyMatch && !inIframe) {
    const [, slug, rest] = legacyMatch;
    const url = req.nextUrl.clone();
    url.hostname = `${slug}.${ROOT_DOMAIN}`;
    url.pathname = rest || "/";
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  // ---- Link viejo /c/{slug} en el dominio raíz → vitrina en subdominio ----
  // Mismo trato que /t/{slug}: lo ya compartido sigue funcionando. Si una
  // marca tiene ese mismo nombre, la vitrina se queda en /c/{slug}.
  const vitrinaMatch = !isApiRoute ? pathname.match(/^\/c\/([a-z0-9-]+)(\/.*)?$/) : null;
  if (vitrinaMatch && !inIframe && !(await brandSlugTaken(vitrinaMatch[1]))) {
    const [, slug, rest] = vitrinaMatch;
    const url = req.nextUrl.clone();
    url.hostname = `${slug}.${ROOT_DOMAIN}`;
    url.pathname = rest || "/";
    url.search = search;
    return NextResponse.redirect(url, 308);
  }

  const protectedPrefixes = ["/creador", "/marca", "/admin", "/aliado"];
  // "/aliado/entrar" es donde el aliado usa el link de su correo: no tiene
  // sesión todavía. Y "/aliados…" (otra palabra) no es el portal.
  const matchedPrefix = protectedPrefixes.find((p) => pathname === p || pathname.startsWith(`${p}/`) || (p !== "/aliado" && pathname.startsWith(p)));
  if (pathname === "/aliado/entrar") return NextResponse.next();

  if (!matchedPrefix) return NextResponse.next();

  // Sin sesión: al login, recordando a dónde quería ir. El aliado entra
  // con el link de su correo, no con contraseña.
  if (!session?.user) {
    const url = new URL(matchedPrefix === "/aliado" ? "/aliado/entrar" : "/login", req.nextUrl.origin);
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
