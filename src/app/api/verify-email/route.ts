import { NextResponse } from "next/server";
import { verifyEmailSchema } from "@/lib/validation/auth";
import { verifyEmail, AuthServiceError } from "@/server/services/auth-service";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = verifyEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await verifyEmail(parsed.data.token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo verificar el correo." }, { status: 500 });
  }
}
