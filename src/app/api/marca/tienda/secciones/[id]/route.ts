import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { updateStorefrontSectionSchema } from "@/lib/validation/brand";
import {
  updateStorefrontSection,
  deleteStorefrontSection,
  StorefrontSectionError,
} from "@/server/services/storefront-section-service";
import { ZodError } from "zod";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateStorefrontSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const section = await updateStorefrontSection(profile.id, id, parsed.data);
    return NextResponse.json({ ok: true, section });
  } catch (err) {
    if (err instanceof StorefrontSectionError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof ZodError)
      return NextResponse.json({ error: "No se pudo guardar la sección." }, { status: 400 });
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
    await deleteStorefrontSection(profile.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorefrontSectionError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
