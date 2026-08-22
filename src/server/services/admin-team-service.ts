import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export class AdminTeamError extends Error {}

export async function listAdmins() {
  return prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, adminRole: true, createdAt: true },
  });
}

export async function createAdmin(email: string, adminRole: "OWNER" | "SUPPORT" | "FINANCE" | "BRAND_APPROVER" | "CREATOR_APPROVER", temporaryPassword: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AdminTeamError("Ya existe una cuenta con este correo.");

  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  return prisma.user.create({
    data: { email, role: "ADMIN", adminRole, passwordHash, emailVerified: new Date() },
  });
}

export async function updateAdminRole(userId: string, adminRole: "OWNER" | "SUPPORT" | "FINANCE" | "BRAND_APPROVER" | "CREATOR_APPROVER") {
  return prisma.user.update({ where: { id: userId }, data: { adminRole } });
}

export async function removeAdmin(requestingUserId: string, targetUserId: string) {
  if (requestingUserId === targetUserId) {
    throw new AdminTeamError("No puedes eliminar tu propia cuenta desde aquí.");
  }
  await prisma.user.delete({ where: { id: targetUserId } });
}
