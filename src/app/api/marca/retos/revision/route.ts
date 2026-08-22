import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { reviewSubmissionSchema } from "@/lib/validation/brand";
import { reviewContentSubmission, ChallengeError } from "@/server/services/challenge-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = reviewSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await reviewContentSubmission(profile.id, parsed.data.rewardId, profile.userId, parsed.data.decision);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ChallengeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
