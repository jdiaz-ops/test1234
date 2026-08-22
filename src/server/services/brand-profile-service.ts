import { prisma } from "@/lib/prisma";

export async function getBrandProfileByUserId(userId: string) {
  return prisma.brandProfile.findUniqueOrThrow({
    where: { userId },
    include: { vertical: true },
  });
}

export async function updateBrandProfile(
  userId: string,
  data: {
    companyName: string;
    legalName?: string;
    taxId?: string;
    description?: string;
    city?: string;
  }
) {
  return prisma.brandProfile.update({ where: { userId }, data });
}

export async function updateStoreConnection(
  userId: string,
  data: { storeType: "SHOPIFY" | "WOOCOMMERCE" | "OTHER"; storeUrl: string }
) {
  return prisma.brandProfile.update({
    where: { userId },
    data: {
      storeType: data.storeType,
      storeUrl: data.storeUrl,
      // La verificación real de la conexión (API/webhooks) la hace el Motor
      // de Atribución — por ahora solo se guarda la intención.
      storeConnectionStatus: "NOT_CONNECTED",
    },
  });
}
