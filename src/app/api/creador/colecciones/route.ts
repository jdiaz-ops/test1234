import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { createCollectionSchema } from "@/lib/validation/creator";
import { listCollectionsForCreator, createCollection } from "@/server/services/collection-service";

export async function GET() {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const collections = await listCollectionsForCreator(profile.id);
  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createCollectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const collection = await createCollection(profile.id, {
    name: parsed.data.name,
    description: parsed.data.description || undefined,
  });
  return NextResponse.json({ ok: true, collection }, { status: 201 });
}
