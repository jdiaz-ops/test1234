import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { createAdminSchema, updateAdminRoleSchema, removeAdminSchema } from "@/lib/validation/admin";
import { createAdmin, updateAdminRole, removeAdmin, AdminTeamError } from "@/server/services/admin-team-service";

function ownerOnly(admin: { adminRole?: string | null } | null) {
  return admin && isOwner(admin.adminRole);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!ownerOnly(admin)) return NextResponse.json({ error: "Solo el propietario puede agregar equipo." }, { status: 403 });

  const body = await req.json();
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await createAdmin(parsed.data.email, parsed.data.adminRole, parsed.data.temporaryPassword);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof AdminTeamError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!ownerOnly(admin)) return NextResponse.json({ error: "Solo el propietario puede editar roles." }, { status: 403 });

  const body = await req.json();
  const parsed = updateAdminRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await updateAdminRole(parsed.data.userId, parsed.data.adminRole);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!ownerOnly(admin)) return NextResponse.json({ error: "Solo el propietario puede eliminar cuentas." }, { status: 403 });

  const body = await req.json();
  const parsed = removeAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await removeAdmin(admin!.id, parsed.data.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminTeamError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "No se pudo eliminar la cuenta." }, { status: 500 });
  }
}
