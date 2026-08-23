import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { prisma } from "@/lib/prisma";

/// Paso "Cómo te cobramos" del onboarding — la marca confirma que entendió
/// el ciclo de corte mensual, transferencia y bloqueo por impago.
export async function POST() {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  await prisma.brandProfile.update({ where: { id: profile.id }, data: { billingAcknowledgedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
