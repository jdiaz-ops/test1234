import { prisma } from "@/lib/prisma";

export class CollectionError extends Error {}

export async function listCollectionsForCreator(creatorId: string) {
  return prisma.collection.findMany({
    where: { creatorId },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { product: { include: { brand: { select: { companyName: true, storeType: true } } } } },
      },
    },
    orderBy: { order: "asc" },
  });
}

export async function createCollection(creatorId: string, data: { name: string; description?: string }) {
  const count = await prisma.collection.count({ where: { creatorId } });
  return prisma.collection.create({
    data: { creatorId, name: data.name, description: data.description || null, order: count },
  });
}

async function assertOwnsCollection(creatorId: string, collectionId: string) {
  const collection = await prisma.collection.findFirst({ where: { id: collectionId, creatorId } });
  if (!collection) throw new CollectionError("Colección no encontrada.");
  return collection;
}

export async function updateCollection(
  creatorId: string,
  collectionId: string,
  data: { name?: string; description?: string | null; visible?: boolean }
) {
  await assertOwnsCollection(creatorId, collectionId);
  return prisma.collection.update({ where: { id: collectionId }, data });
}

export async function deleteCollection(creatorId: string, collectionId: string) {
  await assertOwnsCollection(creatorId, collectionId);
  return prisma.collection.delete({ where: { id: collectionId } });
}

/// Sube/baja una colección en el orden en que aparecen en la vitrina — igual
/// patrón que el reordenamiento de marcas en la vitrina (▲▼).
export async function moveCollection(creatorId: string, collectionId: string, direction: -1 | 1) {
  const collections = await prisma.collection.findMany({ where: { creatorId }, orderBy: { order: "asc" } });
  const index = collections.findIndex((c) => c.id === collectionId);
  if (index === -1) throw new CollectionError("Colección no encontrada.");
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= collections.length) return collections;

  const a = collections[index];
  const b = collections[targetIndex];
  await prisma.$transaction([
    prisma.collection.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.collection.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  return collections;
}

/// Reemplaza la lista completa de productos de la colección, en el orden
/// dado — más simple de razonar desde el picker del portal que ir
/// agregando/quitando uno por uno.
export async function setCollectionProducts(creatorId: string, collectionId: string, productIds: string[]) {
  await assertOwnsCollection(creatorId, collectionId);

  await prisma.$transaction([
    prisma.collectionProduct.deleteMany({ where: { collectionId } }),
    prisma.collectionProduct.createMany({
      data: productIds.map((productId, order) => ({ collectionId, productId, order })),
    }),
  ]);

  return prisma.collection.findUniqueOrThrow({
    where: { id: collectionId },
    include: { items: { orderBy: { order: "asc" }, include: { product: true } } },
  });
}
