import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { BrandCollectionError, setCollectionInCategories } from "@/server/services/brand-collection-service";

/// Mostrar u ocultar la colección en la página "Todas las categorías" de la
/// tienda (la de "Categorías" en la barra de abajo del celular).
const bodySchema = z.object({ show: z.boolean() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  const { id } = await params;
  try {
    await setCollectionInCategories(profile.id, id, body.data.show);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof BrandCollectionError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
