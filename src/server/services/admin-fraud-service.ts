import { prisma } from "@/lib/prisma";

export async function listFraudFlags() {
  return prisma.fraudFlag.findMany({ orderBy: { createdAt: "desc" } });
}

export async function reviewFraudFlag(flagId: string, status: "CLEARED" | "CONFIRMED_FRAUD") {
  return prisma.fraudFlag.update({
    where: { id: flagId },
    data: { status, reviewedAt: new Date() },
  });
}
