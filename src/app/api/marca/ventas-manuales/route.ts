import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { recordManualSaleSchema } from "@/lib/validation/brand";
import { recordManualSale, ManualSaleError } from "@/server/services/attribution-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = recordManualSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await recordManualSale({
      brandId: profile.id,
      discountCode: parsed.data.discountCode,
      grossAmount: parsed.data.grossAmount,
      occurredAt: new Date(parsed.data.occurredAt),
      note: parsed.data.note || undefined,
      customerEmail: parsed.data.customerEmail || undefined,
    });
    return NextResponse.json({ ok: true, transactionId: result.transaction?.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ManualSaleError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
