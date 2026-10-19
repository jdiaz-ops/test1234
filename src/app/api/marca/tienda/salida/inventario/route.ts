import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { GoLiveStepError, listNoStockProducts, setStepStock, setStockForAllNoStock } from "@/server/services/go-live-service";

/// "Pon el inventario de lo que controlas" desde el Dashboard (ver
/// go-live-steps.tsx): GET lista lo que se vende sin control de inventario,
/// PATCH le pone las unidades a un producto o a una variante, o con
/// { all: true } a todos los que faltan.
export async function GET(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await listNoStockProducts(profile.id, new URL(req.url).searchParams.get("q")));
}

const bodySchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().optional(),
  stock: z.coerce.number().int("Las unidades van en números enteros.").min(0, "No puede ser negativo.").max(1_000_000),
});

const allSchema = z.object({
  all: z.literal(true),
  stock: z.coerce.number().int("Las unidades van en números enteros.").min(1, "Pon al menos 1 unidad.").max(1_000_000),
});

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const json = await req.json().catch(() => null);
  if (json?.all === true) {
    const all = allSchema.safeParse(json);
    if (!all.success) return NextResponse.json({ error: all.error.issues[0]?.message ?? "Revisa las unidades." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await setStockForAllNoStock(profile.id, all.data.stock)) });
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Revisa las unidades." }, { status: 400 });
  try {
    await setStepStock(profile.id, body.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GoLiveStepError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
