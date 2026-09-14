import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { updateStoreCustomerSchema } from "@/lib/validation/brand";
import {
  getStoreCustomerDetail,
  updateStoreCustomer,
} from "@/server/services/store-customer-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { email } = await params;
  const customer = await getStoreCustomerDetail(profile.id, decodeURIComponent(email));
  if (!customer)
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ email: string }> },
) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { email } = await params;
  const body = await req.json();
  const parsed = updateStoreCustomerSchema.safeParse({
    ...body,
    email: decodeURIComponent(email),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const customer = await updateStoreCustomer(profile.id, parsed.data);
  return NextResponse.json({ ok: true, customer });
}
