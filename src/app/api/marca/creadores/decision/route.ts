import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { enrollmentDecisionSchema } from "@/lib/validation/brand";
import {
  approveEnrollment,
  rejectEnrollment,
  EnrollmentManagementError,
} from "@/server/services/enrollment-management-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = enrollmentDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    if (parsed.data.decision === "APPROVE") {
      await approveEnrollment(profile.id, parsed.data.enrollmentId);
    } else {
      await rejectEnrollment(profile.id, parsed.data.enrollmentId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof EnrollmentManagementError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo procesar la solicitud." }, { status: 500 });
  }
}
