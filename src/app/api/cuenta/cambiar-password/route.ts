import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword, AuthServiceError } from "@/server/services/auth-service";

// Ruta genérica, reutilizable por cualquier rol (creador, marca, admin).
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await changePassword(session.user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo cambiar la contraseña." }, { status: 500 });
  }
}
