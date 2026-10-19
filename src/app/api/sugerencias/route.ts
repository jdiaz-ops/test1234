import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { SUGGESTIONS_ENABLED } from "@/lib/features";
import { limitOrReject } from "@/lib/rate-limit";
import { FileUploadError } from "@/lib/file-upload";
import { suggestionInputSchema } from "@/lib/suggestions";
import { createSuggestion, SuggestionError } from "@/server/services/suggestion-service";

/// POST (multipart) → buzón de sugerencias del portal de marcas y del de
/// creadoras: `message` y/o `audio` (nota de voz), más `kind`, `pagePath`
/// y `audioSeconds`. Ver suggestion-service.ts.
export async function POST(req: Request) {
  if (!SUGGESTIONS_ENABLED) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "BRAND" && role !== "CREATOR")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // 10 por hora por IP: de sobra para contar algo, y frena un envío en bucle.
  const limited = await limitOrReject(req, "sugerencias", 10, 60 * 60);
  if (limited) return limited;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "No llegó el mensaje — intenta de nuevo." }, { status: 400 });
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const parsed = suggestionInputSchema.safeParse({
    kind: text("kind"),
    message: text("message"),
    pagePath: text("pagePath"),
    audioSeconds: text("audioSeconds"),
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const audio = form.get("audio");

  try {
    await createSuggestion({
      ...parsed.data,
      userId: session.user.id,
      portal: role,
      audio: audio instanceof File ? audio : null,
      userAgent: req.headers.get("user-agent"),
      sentByAdmin: Boolean(session.user.impersonated),
    });
  } catch (err) {
    if (err instanceof SuggestionError || err instanceof FileUploadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
