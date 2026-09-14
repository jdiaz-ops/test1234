import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  storefrontMenuItemSchema,
  reorderStorefrontMenuItemsSchema,
} from "@/lib/validation/brand";
import {
  listStorefrontMenuItems,
  createStorefrontMenuItem,
  reorderStorefrontMenuItems,
  StorefrontMenuError,
} from "@/server/services/store-page-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const items = await listStorefrontMenuItems(profile.id);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = storefrontMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const item = await createStorefrontMenuItem(profile.id, parsed.data);
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    if (err instanceof StorefrontMenuError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

/// Reordena TODOS los ítems del menú de la marca de una — para editar uno
/// solo usa /api/marca/tienda/menu/[id].
export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = reorderStorefrontMenuItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await reorderStorefrontMenuItems(profile.id, parsed.data.order);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorefrontMenuError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
