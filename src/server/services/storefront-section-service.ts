import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseSectionConfig,
  type SectionType,
} from "@/lib/storefront-sections";

export class StorefrontSectionError extends Error {}

export async function listStorefrontSections(brandId: string) {
  return prisma.storefrontSection.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
  });
}

/// Solo las prendidas, en orden — lo que consume la vitrina pública.
export async function listEnabledStorefrontSections(brandId: string) {
  return prisma.storefrontSection.findMany({
    where: { brandId, enabled: true },
    orderBy: { position: "asc" },
  });
}

export async function createStorefrontSection(
  brandId: string,
  data: { type: SectionType; config: unknown },
) {
  const config = parseSectionConfig(data.type, data.config);
  const count = await prisma.storefrontSection.count({ where: { brandId } });
  return prisma.storefrontSection.create({
    data: {
      brandId,
      type: data.type,
      config: config as Prisma.InputJsonValue,
      position: count,
    },
  });
}

export async function updateStorefrontSection(
  brandId: string,
  sectionId: string,
  data: { config?: unknown; enabled?: boolean },
) {
  const existing = await prisma.storefrontSection.findFirst({
    where: { id: sectionId, brandId },
  });
  if (!existing) throw new StorefrontSectionError("Sección no encontrada.");

  const updateData: Prisma.StorefrontSectionUpdateInput = {};
  if (data.config !== undefined) {
    updateData.config = parseSectionConfig(
      existing.type as SectionType,
      data.config,
    ) as Prisma.InputJsonValue;
  }
  if (data.enabled !== undefined) updateData.enabled = data.enabled;

  return prisma.storefrontSection.update({
    where: { id: sectionId },
    data: updateData,
  });
}

export async function deleteStorefrontSection(brandId: string, sectionId: string) {
  const existing = await prisma.storefrontSection.findFirst({
    where: { id: sectionId, brandId },
  });
  if (!existing) throw new StorefrontSectionError("Sección no encontrada.");
  await prisma.storefrontSection.delete({ where: { id: sectionId } });
}

/// Recibe el nuevo orden completo (todos los ids de la marca, en el
/// orden final) — más simple que mover una sola posición a mano.
export async function reorderStorefrontSections(brandId: string, orderedIds: string[]) {
  const existing = await prisma.storefrontSection.findMany({
    where: { brandId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    throw new StorefrontSectionError("La lista de orden no calza con las secciones actuales.");
  }
  await prisma.$transaction(
    orderedIds.map((id, position) =>
      prisma.storefrontSection.update({ where: { id }, data: { position } }),
    ),
  );
}
