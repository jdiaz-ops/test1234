import { NextResponse } from "next/server";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/server/services/auth-service";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = requestPasswordResetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await requestPasswordReset(parsed.data.email);

  // Siempre respondemos ok, exista o no la cuenta, para no filtrar qué
  // correos están registrados.
  return NextResponse.json({ ok: true });
}
