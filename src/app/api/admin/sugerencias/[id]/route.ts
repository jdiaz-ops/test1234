import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/current-admin";
import { SUGGESTIONS_ENABLED } from "@/lib/features";
import { setSuggestionStatus, SuggestionError } from "@/server/services/suggestion-service";

const bodySchema = z.object({ status: z.enum(["NEW", "READ", "DONE"]) });

/// PATCH { status } → Admin → Sugerencias: nueva, leída o resuelta (la
/// marca o creadora ve ese estado en "Lo que nos has enviado").
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!SUGGESTIONS_ENABLED) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
  const { id } = await params;
  try {
    await setSuggestionStatus(id, parsed.data.status);
  } catch (err) {
    if (err instanceof SuggestionError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
  return NextResponse.json({ ok: true });
}
