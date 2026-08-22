import { auth } from "@/auth";

/// Equivalente a requireCreatorProfile/requireBrandProfile para el Panel
/// Admin — aquí no hay un modelo de "perfil" aparte, el propio User ya
/// contiene el adminRole.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session.user;
}

/// Algunas acciones (config global, equipo interno) son exclusivas del
/// Propietario — el resto de roles internos no las necesitan.
export function isOwner(adminRole: string | null | undefined) {
  return adminRole === "OWNER";
}
