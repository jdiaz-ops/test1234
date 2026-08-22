import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { enrollmentOverrideSchema } from "@/lib/validation/brand";
import { setEnrollmentOverrides, EnrollmentManagementError } from "@/server/services/enrollment-management-service";

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = enrollmentOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await setEnrollmentOverrides(profile.id, parsed.data.enrollmentId, {
      commissionPercentOverride: parsed.data.commissionPercentOverride,
      discountPercentOverride: parsed.data.discountPercentOverride,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EnrollmentManagementError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
