import { NextResponse } from "next/server";
import { requireCreatorProfile } from "@/lib/current-creator";
import { submitContentChallengeSchema } from "@/lib/validation/creator";
import { submitContentChallenge, ChallengeError } from "@/server/services/challenge-service";

export async function POST(req: Request) {
  const profile = await requireCreatorProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = submitContentChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await submitContentChallenge(profile.id, parsed.data.challengeId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ChallengeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
