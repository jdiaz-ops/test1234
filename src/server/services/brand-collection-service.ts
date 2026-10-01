import { prisma } from "@/lib/prisma";
import type { CollectionSortOrder, Prisma } from "@prisma/client";

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
  const collections = await prisma.brandCollection.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
    include: collectionInclude,
  });
  return collections.map(toCollectionRow);
}

/// La fila que muestra la lista de Mi tienda → Colecciones. La usan la
/// carga inicial de la página y la API: antes la API mandaba `_count` en
/// vez de `productCount` y, al volver de editar una colección, la lista
/// decía "productos" sin el número. Ver conversación del 2026-10-01.
function toCollectionRow(c: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  _count: { products: number };
}) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    productCount: c._count.products,
  };
}

const collectionProductSelect = {
  id: true,
  name: true,
  imageUrl: true,
  price: true,
  compareAtPrice: true,
  slug: true,
  stock: true,
  type: true,
  status: true,
  available: true,
  createdAt: true,
} satisfies Prisma.ProductSelect;

/// Orden manual guardado (position); en empate, el de entrada.
const manualOrder = [
  { position: "asc" as const },
  { createdAt: "asc" as const },
  { id: "asc" as const },
];

/// Aplica el "Ordenar" de la colección a sus filas, que vienen en orden
/// manual. Para la vitrina (página de la colección, Colección destacada,
/// Ofertas desde una colección); el editor siempre trabaja con el orden
/// manual.
export function sortCollectionProducts<
  T extends { product: { name: string; price: unknown; createdAt: Date } },
>(rows: T[], sortOrder: CollectionSortOrder): T[] {
  const price = (r: T) => Number(r.product.price);
  const byName = (a: T, b: T) =>
    a.product.name.localeCompare(b.product.name, "es", { sensitivity: "base", numeric: true });
  const sorted = [...rows];
  switch (sortOrder) {
    case "ALPHA_ASC":
      return sorted.sort(byName);
    case "ALPHA_DESC":
      return sorted.sort((a, b) => byName(b, a));
    case "PRICE_ASC":
      return sorted.sort((a, b) => price(a) - price(b) || byName(a, b));
    case "PRICE_DESC":
      return sorted.sort((a, b) => price(b) - price(a) || byName(a, b));
    case "NEWEST":
      return sorted.sort((a, b) => b.product.createdAt.getTime() - a.product.createdAt.getTime());
    default:
      return sorted;
  }
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
        orderBy: manualOrder,
        include: { product: { select: collectionProductSelect } },
      },
    },
  });
  if (!collection) return null;
  return {
    ...collection,
    products: sortCollectionProducts(
      collection.products.filter((p) => p.product.status === "ACTIVE" && p.product.available),
      collection.sortOrder,
    ),
  };
}

/// Para la landing "todas las categorías" (/t/{slug}/coleccion) — el
/// destino por defecto del ítem "Categorías" del navegador móvil (ver
/// theme.mobileNav) y de la sección CATEGORY_GRID. Solo trae colecciones
/// con al menos un producto visible — una colección vacía no tiene nada
/// que mostrar si le dan clic.
export async function getPublicBrandCollections(brandId: string) {
  const collections = await prisma.brandCollection.findMany({
    where: {
      brandId,
      products: {
        some: { product: { status: "ACTIVE", available: true } },
      },
    },
    orderBy: { position: "asc" },
    select: { id: true, name: true, slug: true, imageUrl: true },
  });
  return collections;
}

/// Trae los productos en el orden manual (el del editor). La vitrina
/// aplica encima el "Ordenar" de la colección con sortCollectionProducts.
export async function getBrandCollection(brandId: string, collectionId: string) {
  return prisma.brandCollection.findFirst({
    where: { id: collectionId, brandId },
    include: {
      products: {
        orderBy: manualOrder,
        include: { product: { select: collectionProductSelect } },
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
  sortOrder?: CollectionSortOrder;
};

/// Deja la colección con exactamente estos productos, en este orden
/// (position = lugar en la lista).
async function setCollectionProducts(collectionId: string, brandId: string, productIds: string[]) {
  // Filtra a solo productos que de verdad son de esta marca — evita que
  // alguien mande el id de un producto de otra marca.
  const owned = await prisma.product.findMany({
    where: { id: { in: productIds }, brandId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((p) => p.id));
  const ordered = Array.from(new Set(productIds)).filter((id) => ownedIds.has(id));

  await prisma.$transaction([
    prisma.productBrandCollection.deleteMany({ where: { collectionId } }),
    ...(ordered.length > 0
      ? [
          prisma.productBrandCollection.createMany({
            data: ordered.map((productId, position) => ({
              productId,
              collectionId,
              position,
            })),
          }),
        ]
      : []),
  ]);
}

/// Siguiente lugar libre (al final) en cada colección — para productos que
/// se agregan desde la ficha del producto o la edición en grupo.
export async function nextCollectionPositions(
  collectionIds: string[],
  db: Prisma.TransactionClient = prisma,
) {
  const maxes = await db.productBrandCollection.groupBy({
    by: ["collectionId"],
    where: { collectionId: { in: collectionIds } },
    _max: { position: true },
  });
  const next = new Map(collectionIds.map((id) => [id, 0]));
  for (const m of maxes) next.set(m.collectionId, (m._max.position ?? -1) + 1);
  return next;
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
      sortOrder: data.sortOrder ?? "MANUAL",
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
      ...(data.sortOrder ? { sortOrder: data.sortOrder } : {}),
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

  // Solo se toca lo que cambió. Antes se borraban TODAS las filas y se
  // volvían a crear en cada guardado, y como el orden de los productos en
  // una colección es el de esas filas (createdAt), cada producto editado
  // pasaba al final: en la portada, que muestra los primeros 12 de la
  // colección destacada, "desaparecía". Ver conversación del 2026-09-30.
  const current = await prisma.productBrandCollection.findMany({
    where: { productId },
    select: { collectionId: true },
  });
  const currentIds = new Set(current.map((c) => c.collectionId));
  const toRemove = Array.from(currentIds).filter((id) => !ownedIds.has(id));
  const toAdd = Array.from(ownedIds).filter((id) => !currentIds.has(id));
  if (toRemove.length === 0 && toAdd.length === 0) return;

  // Las colecciones nuevas lo reciben al final de su orden manual.
  const next = await nextCollectionPositions(toAdd);
  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [prisma.productBrandCollection.deleteMany({ where: { productId, collectionId: { in: toRemove } } })]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.productBrandCollection.createMany({
            data: toAdd.map((collectionId) => ({
              productId,
              collectionId,
              position: next.get(collectionId) ?? 0,
            })),
          }),
        ]
      : []),
  ]);
}
