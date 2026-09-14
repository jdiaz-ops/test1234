import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { updateBrandCollectionSchema } from "@/lib/validation/brand";
import {
  getBrandCollection,
  updateBrandCollection,
  deleteBrandCollection,
  BrandCollectionError,
} from "@/server/services/brand-collection-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const collection = await getBrandCollection(profile.id, id);
  if (!collection)
    return NextResponse.json({ error: "Colección no encontrada" }, { status: 404 });
  return NextResponse.json({ collection });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateBrandCollectionSchema.safeParse({ ...body, collectionId: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const collection = await updateBrandCollection(profile.id, id, parsed.data);
    return NextResponse.json({ ok: true, collection });
  } catch (err) {
    if (err instanceof BrandCollectionError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    await deleteBrandCollection(profile.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BrandCollectionError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
