import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { updateStoreSchema } from "@/lib/validation/brand";
import { updateStoreConnection, getWebhookUrl } from "@/server/services/brand-profile-service";
import { syncProductsForBrand } from "@/server/services/product-sync-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = updateStoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await updateStoreConnection(profile.userId, parsed.data);

  // Entrada manual de credenciales (flujo viejo, sin OAuth) — igual que en
  // los callbacks de OAuth, se sincroniza ya el catálogo, sin bloquear la
  // respuesta si falla.
  if (updated.storeConnectionStatus === "CONNECTED") {
    try {
      await syncProductsForBrand(updated.id);
    } catch (syncErr) {
      console.error(`[tienda] No se pudo sincronizar el catálogo inicial de ${updated.id}:`, syncErr);
    }
  }

  return NextResponse.json({
    ok: true,
    webhookSecret: updated.webhookSecret,
    webhookUrl:
      updated.storeType === "SHOPIFY" || updated.storeType === "WOOCOMMERCE"
        ? getWebhookUrl(updated.id, updated.storeType)
        : null,
  });
}
