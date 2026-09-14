import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  listBrandCollections,
  createBrandCollection,
  BrandCollectionError,
} from "@/server/services/brand-collection-service";

const createSchema = z.object({
  name: z.string().min(2, "Ingresa un nombre para la colección"),
});

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const collections = await listBrandCollections(profile.id);
  return NextResponse.json({ collections });
}

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const collection = await createBrandCollection(profile.id, parsed.data.name);
    return NextResponse.json({ ok: true, collection });
  } catch (err) {
    if (err instanceof BrandCollectionError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
