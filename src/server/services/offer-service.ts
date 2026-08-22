import { prisma } from "@/lib/prisma";

export async function listOffersForBrand(brandId: string) {
  return prisma.offer.findMany({
    where: { brandId },
    include: { category: true, _count: { select: { enrollments: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOffer(
  brandId: string,
  data: {
    name: string;
    description?: string;
    categoryId?: string | null;
    defaultCommissionPercent: number;
    defaultDiscountPercent: number;
    joinMode: "OPEN" | "APPROVAL";
  }
) {
  return prisma.offer.create({ data: { ...data, brandId } });
}

export async function updateOffer(
  brandId: string,
  offerId: string,
  data: {
    name: string;
    description?: string;
    categoryId?: string | null;
    defaultCommissionPercent: number;
    defaultDiscountPercent: number;
    joinMode: "OPEN" | "APPROVAL";
    status: "ACTIVE" | "PAUSED";
  }
) {
  // updateMany con el brandId en el where evita que una marca edite la
  // oferta de otra, sin necesitar una consulta extra de verificación.
  return prisma.offer.updateMany({ where: { id: offerId, brandId }, data });
}
