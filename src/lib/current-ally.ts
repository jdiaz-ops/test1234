import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/// El aliado de la sesión, leído fresco de la base (como requireBrandProfile).
export async function requireAllyProfile() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ALLY") return null;
  return prisma.allyProfile.findUnique({ where: { userId: session.user.id } });
}
