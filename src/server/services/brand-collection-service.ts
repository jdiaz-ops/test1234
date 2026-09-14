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

const collectionInclude = {
  _count: { select: { products: true } },
};

/// Colecciones propias de la marca (ej. "Verano 2026") — para organizar su
/// catálogo en "Mi tienda", distinto de la vitrina curada de un creador
/// (ver Collection en el schema). Ver conversación del 2026-09-14 pidiendo
/// poder gestionarlas (antes solo se creaban al vuelo desde Crear
/// producto, con solo un nombre).
export async function listBrandCollections(brandId: string) {
  return prisma.brandCollection.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
    include: collectionInclude,
  });
}

/// Para la página pública de la colección en la vitrina
/// (/t/{slug}/coleccion/{collectionSlug}) — solo trae productos
/// realmente visibles (ACTIVE y disponibles), a diferencia de
/// getBrandCollection (portal) que trae todo para que la marca los edite.
export async function getPublicBrandCollection(brandId: string, slug: string) {
  const collection = await prisma.brandCollection.findUnique({
    where: { brandId_slug: { brandId, slug } },
    include: {
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              price: true,
              slug: true,
              stock: true,
              type: true,
              status: true,
              available: true,
            },
          },
        },
      },
    },
  });
  if (!collection) return null;
  return {
    ...collection,
    products: collection.products.filter(
      (p) => p.product.status === "ACTIVE" && p.product.available,
    ),
  };
}

export async function getBrandCollection(brandId: string, collectionId: string) {
  return prisma.brandCollection.findFirst({
    where: { id: collectionId, brandId },
    include: {
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              price: true,
              slug: true,
              stock: true,
              type: true,
              status: true,
              available: true,
            },
          },
        },
      },
    },
  });
}

/// Slug único por marca — si "verano-2026" ya existe, prueba
/// "verano-2026-2", "-3", etc., en vez de fallar (la marca solo escribe un
/// nombre, nunca ve ni piensa en el slug).
async function uniqueSlug(brandId: string, base: string, excludeId?: string) {
  let candidate = base || "coleccion";
  let n = 2;
  while (true) {
    const existing = await prisma.brandCollection.findUnique({
      where: { brandId_slug: { brandId, slug: candidate } },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base || "coleccion"}-${n}`;
    n++;
  }
}

type CollectionInput = {
  name: string;
  description?: string;
  imageUrl?: string;
  productIds?: string[];
};

async function setCollectionProducts(collectionId: string, brandId: string, productIds: string[]) {
  // Filtra a solo productos que de verdad son de esta marca — evita que
  // alguien mande el id de un producto de otra marca.
  const owned = await prisma.product.findMany({
    where: { id: { in: productIds }, brandId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((p) => p.id));

  await prisma.$transaction([
    prisma.productBrandCollection.deleteMany({ where: { collectionId } }),
    ...(ownedIds.size > 0
      ? [
          prisma.productBrandCollection.createMany({
            data: Array.from(ownedIds).map((productId) => ({
              productId,
              collectionId,
            })),
          }),
        ]
      : []),
  ]);
}

export async function createBrandCollection(brandId: string, data: CollectionInput) {
  const trimmed = data.name.trim();
  if (trimmed.length < 2) {
    throw new BrandCollectionError("Ingresa un nombre para la colección.");
  }
  const slug = await uniqueSlug(brandId, slugify(trimmed));
  const count = await prisma.brandCollection.count({ where: { brandId } });
  const collection = await prisma.brandCollection.create({
    data: {
      brandId,
      name: trimmed,
      slug,
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      position: count,
    },
  });
  if (data.productIds && data.productIds.length > 0) {
    await setCollectionProducts(collection.id, brandId, data.productIds);
  }
  return collection;
}

export async function updateBrandCollection(
  brandId: string,
  collectionId: string,
  data: CollectionInput,
) {
  const existing = await prisma.brandCollection.findFirst({
    where: { id: collectionId, brandId },
  });
  if (!existing) throw new BrandCollectionError("Colección no encontrada.");

  const trimmed = data.name.trim();
  if (trimmed.length < 2) {
    throw new BrandCollectionError("Ingresa un nombre para la colección.");
  }
  const slug =
    trimmed === existing.name
      ? existing.slug
      : await uniqueSlug(brandId, slugify(trimmed), collectionId);

  const collection = await prisma.brandCollection.update({
    where: { id: collectionId },
    data: {
      name: trimmed,
      slug,
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
    },
  });
  await setCollectionProducts(collectionId, brandId, data.productIds ?? []);
  return collection;
}

export async function deleteBrandCollection(brandId: string, collectionId: string) {
  const existing = await prisma.brandCollection.findFirst({
    where: { id: collectionId, brandId },
  });
  if (!existing) throw new BrandCollectionError("Colección no encontrada.");
  await prisma.brandCollection.delete({ where: { id: collectionId } });
}

export async function reorderBrandCollections(brandId: string, orderedIds: string[]) {
  const existing = await prisma.brandCollection.findMany({
    where: { brandId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((c) => c.id));
  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    throw new BrandCollectionError("La lista de orden no calza con las colecciones actuales.");
  }
  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.brandCollection.update({ where: { id }, data: { position } }),
    ),
  );
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
