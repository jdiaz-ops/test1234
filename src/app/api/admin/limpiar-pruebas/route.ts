import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { deleteTestProfiles, findTestProfiles } from "@/server/services/admin-cleanup-service";

/// Borrar los perfiles de prueba (ver admin-cleanup-service.ts). GET
/// muestra cuáles se borrarían; POST los borra. Solo el Propietario.
async function owner() {
  const admin = await requireAdmin();
  return admin && isOwner(admin.adminRole) ? admin : null;
}

export async function GET() {
  if (!(await owner())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const profiles = await findTestProfiles();
  return NextResponse.json({
    profiles: profiles.map((p) => ({ name: p.name, email: p.email, role: p.role })),
  });
}

export async function POST() {
  if (!(await owner())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    return NextResponse.json(await deleteTestProfiles());
  } catch (err) {
    console.error("[limpiar-pruebas]", err);
    return NextResponse.json({ error: "No se pudieron borrar. No se borró nada." }, { status: 500 });
  }
}
