import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/shopify-csv";
import { POLICY_TITLES, SHOPIFY_POLICY_KINDS, type ShopifyPolicyKind } from "@/lib/shopify-theme";

/// Links viejos de la tienda anterior de la marca → su página en
/// Marcolini. Las importaciones guardan el mapa (StorefrontRedirect) y
/// las rutas de src/app/t/[slug]/{collections,pages,policies,…} lo
/// consultan; si no hay fila, se adivina por el slug y, de últimas, se
/// manda a la lista de colecciones o a la portada: un link viejo nunca
/// debe terminar en una página rota. Ver conversación del 2026-10-18.

/// "/Collections/Gel-Polish/?sort=x" → "/collections/gel-polish".
export function normalizeOldPath(path: string): string {
  let clean = path.trim().split(/[?#]/)[0].toLowerCase();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Se deja como venía.
  }
  clean = clean.replace(/\/+/g, "/").replace(/\/$/, "");
  if (!clean.startsWith("/")) clean = `/${clean}`;
  return clean.slice(0, 500);
}

export async function saveRedirects(brandId: string, entries: { fromPath: string; toPath: string }[]) {
  const seen = new Set<string>();
  for (const entry of entries) {
    const fromPath = normalizeOldPath(entry.fromPath);
    const toPath = entry.toPath.trim();
    if (fromPath === "/" || !toPath || fromPath === toPath || seen.has(fromPath)) continue;
    seen.add(fromPath);
    await prisma.storefrontRedirect.upsert({
      where: { brandId_fromPath: { brandId, fromPath } },
      update: { toPath },
      create: { brandId, fromPath, toPath },
    });
  }
  return seen.size;
}

export async function resolveRedirect(brandId: string, path: string): Promise<string | null> {
  const row = await prisma.storefrontRedirect.findUnique({
    where: { brandId_fromPath: { brandId, fromPath: normalizeOldPath(path) } },
    select: { toPath: true },
  });
  return row?.toPath ?? null;
}

/// /collections/{handle} → la colección; si no se conoce, la lista de colecciones.
export async function oldCollectionTarget(brandId: string, handle: string): Promise<string> {
  const saved = await resolveRedirect(brandId, `/collections/${handle}`);
  if (saved) return saved;
  const lower = handle.toLowerCase();
  if (lower === "all" || lower === "todos" || lower === "frontpage") return "/coleccion";
  const slugs = Array.from(new Set([lower, slugify(lower)].filter(Boolean)));
  const found = await prisma.brandCollection.findFirst({ where: { brandId, slug: { in: slugs } }, select: { slug: true } });
  return found ? `/coleccion/${found.slug}` : "/coleccion";
}

/// /coleccion/{slug} que no existe (un link del menú o repartido que
/// apunta a una colección que se agrupó, se renombró o se borró): busca el
/// redirect guardado de la tienda anterior, una colección con ese nombre,
/// una parecida, y si no hay nada, "todas las categorías". Null solo si
/// la marca no tiene colecciones. Antes era un 404 pelado (2026-10-18,
/// "Esto pasa al querer entrar a Extensiones").
export async function fallbackCollectionTarget(brandId: string, slug: string): Promise<string | null> {
  const self = `/coleccion/${slug}`;
  const saved = await resolveRedirect(brandId, `/collections/${slug}`);
  if (saved && saved !== self) return saved;
  const key = slugify(slug.toLowerCase());
  const all = await prisma.brandCollection.findMany({
    where: { brandId },
    select: { slug: true, name: true },
    orderBy: { position: "asc" },
  });
  if (all.length === 0) return null;
  const exact = all.find((c) => c.slug === key || slugify(c.name) === key);
  if (exact && exact.slug !== slug) return `/coleccion/${exact.slug}`;
  if (key.length >= 4) {
    const partial = all.find((c) => c.slug.includes(key) || key.includes(c.slug) || slugify(c.name).includes(key));
    if (partial && partial.slug !== slug) return `/coleccion/${partial.slug}`;
  }
  return "/coleccion";
}

/// /pages/{handle} → la página propia; si no existe, la portada.
export async function oldPageTarget(brandId: string, handle: string): Promise<string> {
  const saved = await resolveRedirect(brandId, `/pages/${handle}`);
  if (saved) return saved;
  const lower = handle.toLowerCase();
  const slugs = Array.from(new Set([lower, slugify(lower)].filter(Boolean)));
  const found = await prisma.storePage.findFirst({ where: { brandId, slug: { in: slugs } }, select: { slug: true } });
  return found ? `/pagina/${found.slug}` : "/";
}

/// /policies/{kind} → la política importada como página; la de privacidad
/// tiene además su página fija en la vitrina.
export async function oldPolicyTarget(brandId: string, kind: string): Promise<string> {
  const saved = await resolveRedirect(brandId, `/policies/${kind}`);
  if (saved) return saved;
  const lower = kind.toLowerCase();
  const known = (SHOPIFY_POLICY_KINDS as readonly string[]).includes(lower) ? (lower as ShopifyPolicyKind) : null;
  const slugs = Array.from(new Set([slugify(lower), known ? slugify(POLICY_TITLES[known]) : ""].filter(Boolean)));
  const found = await prisma.storePage.findFirst({ where: { brandId, slug: { in: slugs } }, select: { slug: true } });
  if (found) return `/pagina/${found.slug}`;
  return known === "privacy-policy" ? "/politica-de-privacidad" : "/";
}
