import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setDiscoverableSchema } from "@/lib/validation/creator";
import { setCreatorDiscoverable } from "@/server/services/creator-profile-service";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CREATOR") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = setDiscoverableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const profile = await setCreatorDiscoverable(
    session.user.id,
    parsed.data.discoverable,
  );
  return NextResponse.json({ ok: true, discoverable: profile.discoverable });
}
