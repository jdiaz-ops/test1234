import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/// Equivalente a requireCreatorProfile pero para el Portal Marca.
export async function requireBrandProfile() {
  const session = await auth();
  if (!session?.user || session.user.role !== "BRAND") {
    return null;
  }
  return prisma.brandProfile.findUnique({ where: { userId: session.user.id } });
}
