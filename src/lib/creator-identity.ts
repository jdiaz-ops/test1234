import { prisma } from "@/lib/prisma";

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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
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

  while (await prisma.creatorProfile.findUnique({ where: { storefrontSlug: candidate } })) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return candidate;
}
