import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { listBrandOrders } from "@/server/services/store-order-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const orders = await listBrandOrders(profile.id);
  return NextResponse.json({ orders });
}
