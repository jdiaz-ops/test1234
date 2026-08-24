import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { moveCollectionSchema } from "@/lib/validation/creator";
import { moveCollection, CollectionError } from "@/server/services/collection-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = moveCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await moveCollection(profile.id, id, parsed.data.direction);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CollectionError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo mover." }, { status: 500 });
  }
}
