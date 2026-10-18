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

/// La marca de la sesión, pero SOLO si quien está adentro es un admin con
/// "Entrar como" (sesión de impersonación, ver auth.ts). Para las
/// herramientas que ninguna marca debe ver ni poder llamar — la
/// importación desde Shopify y todo lo que cuelga de ella. Se vuelve a
/// comprobar en la base que quien impersona sea un admin: la sesión es un
/// JWT y acá no se confía solo en su contenido. Pedido explícito de Juan,
/// 2026-10-18: "Ninguna marca puede ver esto."
export async function requireAdminActingAsBrand() {
  const session = await auth();
  if (!session?.user || session.user.role !== "BRAND" || !session.user.impersonated || !session.user.impersonatorId) {
    return null;
  }
  const admin = await prisma.user.findUnique({ where: { id: session.user.impersonatorId }, select: { role: true } });
  if (admin?.role !== "ADMIN") return null;
  return prisma.brandProfile.findUnique({ where: { userId: session.user.id } });
}

/// Para decidir en las páginas del portal si se muestran esas herramientas.
export async function isAdminActingAsBrand() {
  return (await requireAdminActingAsBrand()) !== null;
}
