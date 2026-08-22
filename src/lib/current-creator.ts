import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/// Helper compartido por las rutas de API del Portal Creador: valida sesión
/// + rol, y devuelve el CreatorProfile del usuario autenticado.
export async function requireCreatorProfile() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CREATOR") {
    return null;
  }
  const profile = await prisma.creatorProfile.findUnique({
    where: { userId: session.user.id },
  });
  return profile;
}
