import { prisma } from "@/lib/prisma";
import { sanitizeProductDescription } from "@/lib/sanitize-html";

export class StorePageError extends Error {}

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/// Páginas propias de la marca (ej. "Sobre nosotros", "Preguntas
/// frecuentes", "Política de cambios") — igual que las "Páginas" de
/// Tiendanube. Se sirven en /t/{slug}/pagina/{pageSlug} y aparecen en el
/// menú de navegación de la vitrina si la marca les crea un
/// StorefrontMenuItem apuntando ahí (no son lo mismo: una página puede
/// existir sin estar en el menú, con el link directo). Ver conversación
/// del 2026-09-14.

export async function listStorePages(brandId: string) {
  return prisma.storePage.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
  });
}

export async function getStorePageById(brandId: string, pageId: string) {
  return prisma.storePage.findFirst({ where: { id: pageId, brandId } });
}

/// Para el render público — solo trae la página si existe, la marca
/// decide qué tan visible la hace enlazándola (o no) desde el menú.
export async function getPublicStorePage(brandId: string, slug: string) {
  return prisma.storePage.findFirst({ where: { brandId, slug } });
}

async function uniqueSlug(brandId: string, base: string, excludeId?: string) {
  let candidate = base || "pagina";
  let n = 2;
  while (true) {
    const existing = await prisma.storePage.findUnique({
      where: { brandId_slug: { brandId, slug: candidate } },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base || "pagina"}-${n}`;
    n++;
  }
}

type StorePageInput = { title: string; body?: string };

export async function createStorePage(brandId: string, data: StorePageInput) {
  const title = data.title.trim();
  if (title.length < 2) {
    throw new StorePageError("Ingresa un título para la página.");
  }
  const slug = await uniqueSlug(brandId, slugify(title));
  const count = await prisma.storePage.count({ where: { brandId } });
  return prisma.storePage.create({
    data: {
      brandId,
      title,
      slug,
      body: data.body ? sanitizeProductDescription(data.body) : "",
      position: count,
    },
  });
}

export async function updateStorePage(
  brandId: string,
  pageId: string,
  data: StorePageInput,
) {
  const existing = await prisma.storePage.findFirst({
    where: { id: pageId, brandId },
  });
  if (!existing) throw new StorePageError("Página no encontrada.");

  const title = data.title.trim();
  if (title.length < 2) {
    throw new StorePageError("Ingresa un título para la página.");
  }
  // El slug se mantiene igual mientras el título no cambie — igual que los
  // productos, para no romper un link que la marca ya haya compartido o
  // puesto en el menú por un simple cambio de mayúsculas/tildes.
  const slug =
    title === existing.title
      ? existing.slug
      : await uniqueSlug(brandId, slugify(title), pageId);

  return prisma.storePage.update({
    where: { id: pageId },
    data: {
      title,
      slug,
      body: data.body ? sanitizeProductDescription(data.body) : "",
    },
  });
}

export async function deleteStorePage(brandId: string, pageId: string) {
  const existing = await prisma.storePage.findFirst({
    where: { id: pageId, brandId },
  });
  if (!existing) throw new StorePageError("Página no encontrada.");
  await prisma.storePage.delete({ where: { id: pageId } });
}

export async function reorderStorePages(brandId: string, orderedIds: string[]) {
  const existing = await prisma.storePage.findMany({
    where: { brandId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));
  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    throw new StorePageError("La lista de orden no calza con las páginas actuales.");
  }
  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.storePage.update({ where: { id }, data: { position } }),
    ),
  );
}

// ----------------------------------------------------------------------------
// MENÚ DE NAVEGACIÓN — StorefrontMenuItem
// ----------------------------------------------------------------------------

export class StorefrontMenuError extends Error {}

/// Ítems del menú de navegación de la vitrina — cada uno es un label +
/// una url, que puede ser interna (ej. "/pagina/sobre-nosotros",
/// "/coleccion/verano-2026") o externa (ej. un link de Instagram). Se
/// arma a mano, no se genera solo a partir de las páginas/colecciones,
/// para que la marca controle qué aparece y en qué orden — mismo criterio
/// que el "Menús" de Tiendanube. Ver conversación del 2026-09-14.
export async function listStorefrontMenuItems(brandId: string) {
  return prisma.storefrontMenuItem.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
  });
}

type MenuItemInput = { label: string; url: string };

export async function createStorefrontMenuItem(brandId: string, data: MenuItemInput) {
  const label = data.label.trim();
  const url = data.url.trim();
  if (!label) throw new StorefrontMenuError("Ingresa un nombre para el ítem del menú.");
  if (!url) throw new StorefrontMenuError("Ingresa el link del ítem del menú.");
  const count = await prisma.storefrontMenuItem.count({ where: { brandId } });
  return prisma.storefrontMenuItem.create({
    data: { brandId, label, url, position: count },
  });
}

export async function updateStorefrontMenuItem(
  brandId: string,
  itemId: string,
  data: MenuItemInput,
) {
  const existing = await prisma.storefrontMenuItem.findFirst({
    where: { id: itemId, brandId },
  });
  if (!existing) throw new StorefrontMenuError("Ítem no encontrado.");
  const label = data.label.trim();
  const url = data.url.trim();
  if (!label) throw new StorefrontMenuError("Ingresa un nombre para el ítem del menú.");
  if (!url) throw new StorefrontMenuError("Ingresa el link del ítem del menú.");
  return prisma.storefrontMenuItem.update({
    where: { id: itemId },
    data: { label, url },
  });
}

export async function deleteStorefrontMenuItem(brandId: string, itemId: string) {
  const existing = await prisma.storefrontMenuItem.findFirst({
    where: { id: itemId, brandId },
  });
  if (!existing) throw new StorefrontMenuError("Ítem no encontrado.");
  await prisma.storefrontMenuItem.delete({ where: { id: itemId } });
}

export async function reorderStorefrontMenuItems(brandId: string, orderedIds: string[]) {
  const existing = await prisma.storefrontMenuItem.findMany({
    where: { brandId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((i) => i.id));
  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    throw new StorefrontMenuError("La lista de orden no calza con los ítems actuales.");
  }
  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.storefrontMenuItem.update({ where: { id }, data: { position } }),
    ),
  );
}
