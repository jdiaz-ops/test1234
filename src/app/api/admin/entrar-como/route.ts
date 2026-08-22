import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { prisma } from "@/lib/prisma";
import { createImpersonationToken } from "@/lib/impersonation";

const schema = z.object({ userId: z.string().min(1) });

/// Solo el Propietario puede "entrar como" una marca o un creador — nunca
/// como otro admin (evita que esto se use para saltarse permisos entre
/// cuentas internas). Emite un token de un solo uso, de 60 segundos, que el
/// cliente consume de inmediato contra el proveedor de Credentials.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin || !isOwner(admin.adminRole)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target || target.role === "ADMIN") {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }

  const token = await createImpersonationToken(target.id, admin.id);
  return NextResponse.json({ token, role: target.role });
}
