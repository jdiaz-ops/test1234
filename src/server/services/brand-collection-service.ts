import { prisma } from "@/lib/prisma";

export class BrandCollectionError extends Error {}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/// Colecciones propias de la marca (ej. "Verano 2026") — para organizar su
/// catálogo en "Mi tienda", distinto de la vitrina curada de un creador
/// (ver Collection en el schema). Ver conversación del 2026-09-14.
export async function listBrandCollections(brandId: string) {
  return prisma.brandCollection.findMany({
    where: { brandId },
    orderBy: { name: "asc" },
  });
}

/// Slug único por marca — si "verano-2026" ya existe, prueba
/// "verano-2026-2", "-3", etc., en vez de fallar (la marca solo escribe un
/// nombre, nunca ve ni piensa en el slug).
async function uniqueSlug(brandId: string, base: string) {
  let candidate = base || "coleccion";
  let n = 2;
  while (true) {
    const existing = await prisma.brandCollection.findUnique({
      where: { brandId_slug: { brandId, slug: candidate } },
    });
    if (!existing) return candidate;
    candidate = `${base || "coleccion"}-${n}`;
    n++;
  }
}

export async function createBrandCollection(brandId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    throw new BrandCollectionError("Ingresa un nombre para la colección.");
  }
  const slug = await uniqueSlug(brandId, slugify(trimmed));
  return prisma.brandCollection.create({
    data: { brandId, name: trimmed, slug },
  });
}

/// Reemplaza todas las colecciones de un producto por la lista dada —
/// se usa al crear/editar el producto, no hace falta un endpoint aparte
/// para "agregar"/"quitar" una por una.
export async function setProductCollections(
  brandId: string,
  productId: string,
  collectionIds: string[],
) {
  // Filtra a solo colecciones que de verdad son de esta marca — evita que
  // alguien mande el id de una colección de otra marca.
  const owned = await prisma.brandCollection.findMany({
    where: { id: { in: collectionIds }, brandId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));

  await prisma.$transaction([
    prisma.productBrandCollection.deleteMany({ where: { productId } }),
    ...(ownedIds.size > 0
      ? [
          prisma.productBrandCollection.createMany({
            data: Array.from(ownedIds).map((collectionId) => ({
              productId,
              collectionId,
            })),
          }),
        ]
      : []),
  ]);
}
