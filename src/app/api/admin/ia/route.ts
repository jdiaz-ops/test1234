import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { checkAiStatus } from "@/server/services/ai-status-service";

/// "Probar conexión" con la IA — solo admin. Ver ai-status-service.ts.
export const maxDuration = 60;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await checkAiStatus());
}
