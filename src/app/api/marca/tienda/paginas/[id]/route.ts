import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { storePageSchema } from "@/lib/validation/brand";
import {
  updateStorePage,
  deleteStorePage,
  StorePageError,
} from "@/server/services/store-page-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = storePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const page = await updateStorePage(profile.id, id, parsed.data);
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    if (err instanceof StorePageError)
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
    await deleteStorePage(profile.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorePageError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
