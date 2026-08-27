import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize-email";

export class AdminTeamError extends Error {}

export async function listAdmins() {
  return prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, adminRole: true, createdAt: true },
  });
}

export async function createAdmin(
  rawEmail: string,
  adminRole:
    | "OWNER"
    | "SUPPORT"
    | "FINANCE"
    | "BRAND_APPROVER"
    | "CREATOR_APPROVER",
  temporaryPassword: string,
) {
  const email = normalizeEmail(rawEmail);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing)
    throw new AdminTeamError("Ya existe una cuenta con este correo.");

  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  return prisma.user.create({
    data: {
      email,
      role: "ADMIN",
      adminRole,
      passwordHash,
      emailVerified: new Date(),
    },
  });
}

export async function updateAdminRole(
  userId: string,
  adminRole:
    | "OWNER"
    | "SUPPORT"
    | "FINANCE"
    | "BRAND_APPROVER"
    | "CREATOR_APPROVER",
) {
  return prisma.user.update({ where: { id: userId }, data: { adminRole } });
}

export async function removeAdmin(
  requestingUserId: string,
  targetUserId: string,
) {
  if (requestingUserId === targetUserId) {
    throw new AdminTeamError("No puedes eliminar tu propia cuenta desde aquí.");
  }
  await prisma.user.delete({ where: { id: targetUserId } });
}
