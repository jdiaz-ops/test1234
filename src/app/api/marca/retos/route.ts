import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { challengeSchema } from "@/lib/validation/brand";
import { createChallenge, endChallenge, ChallengeError } from "@/server/services/challenge-service";

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = challengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const challenge = await createChallenge(profile.id, parsed.data);
    return NextResponse.json({ ok: true, challengeId: challenge.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ChallengeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { challengeId } = await req.json();
  if (!challengeId) return NextResponse.json({ error: "Falta challengeId" }, { status: 400 });

  try {
    await endChallenge(profile.id, challengeId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ChallengeError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
