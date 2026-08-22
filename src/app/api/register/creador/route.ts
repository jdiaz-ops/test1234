import { NextResponse } from "next/server";
import { registerCreatorSchema } from "@/lib/validation/auth";
import { registerCreator, AuthServiceError } from "@/server/services/auth-service";

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = registerCreatorSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const user = await registerCreator(parsed.data);
    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo completar el registro." }, { status: 500 });
  }
}
