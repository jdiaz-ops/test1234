import { prisma } from "@/lib/prisma";

export async function listAllTransactions() {
  return prisma.transaction.findMany({
    include: { creator: true, offer: { include: { brand: true } }, commission: true },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
}

export async function listBrandCharges() {
  return prisma.brandCharge.findMany({
    include: { brand: true },
    orderBy: { periodStart: "desc" },
    take: 100,
  });
}

export async function listPayouts() {
  return prisma.payout.findMany({
    include: { creator: true },
    orderBy: { periodStart: "desc" },
    take: 100,
  });
}

export async function listStoreHealth() {
  return prisma.brandProfile.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      companyName: true,
      storeType: true,
      storeUrl: true,
      storeConnectionStatus: true,
      storeLastSyncedAt: true,
    },
    orderBy: { companyName: "asc" },
  });
}
