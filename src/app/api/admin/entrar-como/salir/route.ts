import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createImpersonationToken } from "@/lib/impersonation";

/// No usa requireAdmin() a propósito: mientras se está "viendo como" una
/// marca o un creador, la sesión actual tiene role CREATOR/BRAND, no ADMIN
/// — la autorización aquí es otra: que esta sesión sea, ella misma, una
/// sesión de impersonación (impersonated=true) con un impersonatorId válido,
/// ambos datos leídos del JWT firmado por el servidor, nunca del cliente.
export async function POST() {
  const session = await auth();
  if (!session?.user?.impersonated || !session.user.impersonatorId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = await createImpersonationToken(session.user.impersonatorId, session.user.impersonatorId);
  return NextResponse.json({ token });
}
