import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { archiveStoreOrders, deleteStoreOrders } from "@/server/services/store-order-service";

const schema = z.object({
  action: z.enum(["archive", "unarchive", "delete"]),
  orderIds: z.array(z.string().min(1)).min(1, "Elige al menos un pedido").max(200),
});

/// Archivar, desarchivar o eliminar pedidos — desde la lista (varios) o el
/// detalle (uno). Eliminar solo aplica a lo que nunca fue una venta real
/// (ver canDeleteStoreOrder); el resto se salta y se informa.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { action, orderIds } = parsed.data;
  if (action === "delete") {
    const result = await deleteStoreOrders(profile.id, orderIds);
    return NextResponse.json({ ok: true, ...result });
  }
  const result = await archiveStoreOrders(profile.id, orderIds, action === "archive");
  return NextResponse.json({ ok: true, ...result });
}
