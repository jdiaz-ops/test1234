import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/// Equivalente a requireCreatorProfile/requireBrandProfile para el Panel
/// Admin — aquí no hay un modelo de "perfil" aparte, el propio User ya
/// contiene el adminRole.
///
/// A propósito NO confía en el rol que trae la sesión (JWT) — lo
/// re-verifica contra la base en cada llamada. La sesión es JWT (no se
/// re-valida sola en cada request), así que si a alguien lo sacan del
/// equipo o le bajan el rol desde Equipo, su sesión ya abierta seguiría
/// teniendo los permisos viejos hasta que expire el token si esto no
/// consultara la base cada vez — exactamente lo mismo que ya hacían
/// requireBrandProfile/requireCreatorProfile (nunca confiaron en nada que
/// no fuera fresco de la base), esto solo lo empareja para Admin.
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, role: true, adminRole: true },
  });
  if (!user || user.role !== "ADMIN") return null;

  return user;
}

/// Algunas acciones (config global, equipo interno) son exclusivas del
/// Propietario — el resto de roles internos no las necesitan.
export function isOwner(adminRole: string | null | undefined) {
  return adminRole === "OWNER";
}
