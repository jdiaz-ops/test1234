import { prisma } from "@/lib/prisma";

export class BrandStoreConfigError extends Error {}

export async function saveShippingConfig(
  userId: string,
  data: {
    shippingFlatRate?: number | null;
    freeShippingThreshold?: number | null;
    shippingNotes?: string;
  },
) {
  return prisma.brandProfile.update({
    where: { userId },
    data: {
      shippingFlatRate: data.shippingFlatRate ?? null,
      freeShippingThreshold: data.freeShippingThreshold ?? null,
      shippingNotes: data.shippingNotes || null,
    },
  });
}

/// El slug de la vitrina pública de "Mi tienda" (marcolini.lat/{slug}) —
/// único en toda la plataforma, por eso se valida disponibilidad antes de
/// guardar (igual que CreatorProfile.storefrontSlug al registrarse).
export async function saveStorefrontSlug(
  userId: string,
  brandId: string,
  slug: string,
) {
  const existing = await prisma.brandProfile.findUnique({
    where: { storefrontSlug: slug },
  });
  if (existing && existing.id !== brandId) {
    throw new BrandStoreConfigError(
      "Ese link ya lo tiene otra marca — elige otro.",
    );
  }

  return prisma.brandProfile.update({
    where: { userId },
    data: { storefrontSlug: slug },
  });
}
