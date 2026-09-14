import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { listStoreCustomers } from "@/server/services/store-customer-service";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const customers = await listStoreCustomers(profile.id);
  return NextResponse.json({ customers });
}
