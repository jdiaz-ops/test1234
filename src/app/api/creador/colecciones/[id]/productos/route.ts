import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { setCollectionProductsSchema } from "@/lib/validation/creator";
import { setCollectionProducts, CollectionError } from "@/server/services/collection-service";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = setCollectionProductsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const collection = await setCollectionProducts(profile.id, id, parsed.data.productIds);
    return NextResponse.json({ ok: true, collection });
  } catch (err) {
    if (err instanceof CollectionError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
