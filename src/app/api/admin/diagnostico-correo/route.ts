import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import {
  findUsersByEmail,
  deleteUserAccount,
  AdminDiagnosticsError,
} from "@/server/services/admin-diagnostics-service";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const email = new URL(req.url).searchParams.get("correo");
  if (!email) {
    return NextResponse.json(
      { error: "Falta el correo a buscar" },
      { status: 400 },
    );
  }

  const users = await findUsersByEmail(email);
  return NextResponse.json({ users });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "Falta el id de la cuenta" },
      { status: 400 },
    );
  }

  try {
    await deleteUserAccount(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminDiagnosticsError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[diagnostico-correo] error al borrar cuenta:", err);
    return NextResponse.json(
      { error: "No se pudo borrar la cuenta — revisa los logs del servidor." },
      { status: 500 },
    );
  }
}
