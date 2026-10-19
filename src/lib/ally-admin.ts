import { requireAdmin } from "@/lib/current-admin";

/// Admin → Aliados: el Propietario y Finanzas (que les paga).
export async function requireAllyAdmin() {
  const admin = await requireAdmin();
  return admin && (admin.adminRole === "OWNER" || admin.adminRole === "FINANCE") ? admin : null;
}

export const ALLY_ADMIN_FORBIDDEN = { error: "Solo el Propietario o Finanzas pueden manejar aliados." };
