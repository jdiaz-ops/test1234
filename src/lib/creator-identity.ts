import { prisma } from "@/lib/prisma";
import { RESERVED_SUBDOMAINS, ROOT_DOMAIN } from "@/lib/subdomain";

/// Normaliza el nombre elegido por el creador a un código válido
/// (mayúsculas, sin espacios ni acentos) — ej. "Laura Gómez" -> "LAURAGOMEZ".
function normalizeCode(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 20);
}

/// Normaliza el código de descuento que el creador elige para una marca en
/// particular — a diferencia del baseCode (identidad, solo letras/números),
/// aquí sí se permite el guión, porque es común querer algo tipo
/// "LAURA-SEPHORA" para distinguir marcas. Sigue siendo el mismo criterio de
/// mayúsculas/sin acentos.
export function normalizeDiscountCode(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30);
}

function normalizeSlug(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Todo pegado, sin guiones: "Nail Fest" → nailfest.marcolini.lat
    // (pedido de Juan, 2026-10-01). Los links ya creados con guion siguen
    // igual.
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 30);
}

/// Genera un baseCode único a partir de lo que el creador propuso (ej.
/// "LAURA20"). Si ya existe, agrega un sufijo numérico — nunca falla
/// silenciosamente ni se lo asigna a otra persona por error.
export async function generateUniqueBaseCode(desired: string): Promise<string> {
  const base = normalizeCode(desired) || "CREADOR";
  let candidate = base;
  let attempt = 1;

  while (await prisma.creatorProfile.findUnique({ where: { baseCode: candidate } })) {
    attempt += 1;
    candidate = `${base}${attempt}`;
  }

  return candidate;
}

export async function generateUniqueStorefrontSlug(displayName: string): Promise<string> {
  const base = normalizeSlug(displayName) || "creador";
  let candidate = base;
  let attempt = 1;

  // La vitrina vive en {slug}.marcolini.lat, igual que las tiendas de las
  // marcas: el nombre no puede estar tomado por otro creador, por una
  // marca (ni su link anterior) ni ser uno reservado.
  while (
    RESERVED_SUBDOMAINS.has(candidate) ||
    (await prisma.creatorProfile.findUnique({ where: { storefrontSlug: candidate } })) ||
    (await slugTakenByBrand(candidate))
  ) {
    attempt += 1;
    candidate = `${base}${attempt}`;
  }

  return candidate;
}

/// true si {slug}.marcolini.lat ya es (o fue) la tienda de una marca. Las
/// marcas y los creadores comparten los mismos nombres de subdominio; en
/// un choque de antes de este cambio gana la marca (ver src/proxy.ts).
export async function slugTakenByBrand(slug: string): Promise<boolean> {
  const [brand, redirect] = await Promise.all([
    prisma.brandProfile.findUnique({ where: { storefrontSlug: slug }, select: { id: true } }),
    prisma.brandSlugRedirect.findUnique({ where: { slug }, select: { slug: true } }),
  ]);
  return Boolean(brand || redirect);
}

/// Link público de la vitrina de un creador: {slug}.marcolini.lat. Si una
/// marca ya tenía ese mismo nombre, se queda en marcolini.lat/c/{slug}.
/// Ver conversación del 2026-10-01.
export async function creatorVitrinaUrl(slug: string): Promise<string> {
  return (await slugTakenByBrand(slug)) ? `https://${ROOT_DOMAIN}/c/${slug}` : `https://${slug}.${ROOT_DOMAIN}`;
}
