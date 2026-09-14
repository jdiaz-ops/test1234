import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { storePageSchema, reorderStorePagesSchema } from "@/lib/validation/brand";
import {
  listStorePages,
  createStorePage,
  reorderStorePages,
  StorePageError,
} from "@/server/services/store-page-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const pages = await listStorePages(profile.id);
  return NextResponse.json({ pages });
}

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = storePageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const page = await createStorePage(profile.id, parsed.data);
    return NextResponse.json({ ok: true, page });
  } catch (err) {
    if (err instanceof StorePageError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

/// Reordena TODAS las páginas de la marca de una — para editar una sola
/// (título/cuerpo) usa /api/marca/tienda/paginas/[id].
export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = reorderStorePagesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await reorderStorePages(profile.id, parsed.data.order);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorePageError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
