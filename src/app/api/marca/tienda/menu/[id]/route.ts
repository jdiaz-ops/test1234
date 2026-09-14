import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { storefrontMenuItemSchema } from "@/lib/validation/brand";
import {
  updateStorefrontMenuItem,
  deleteStorefrontMenuItem,
  StorefrontMenuError,
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
  const parsed = storefrontMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const item = await updateStorefrontMenuItem(profile.id, id, parsed.data);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof StorefrontMenuError)
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
    await deleteStorefrontMenuItem(profile.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorefrontMenuError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
