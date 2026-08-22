import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";

/// Genera/mejora la descripción del perfil de marca usando IA (API de Anthropic).
/// Requiere la variable de entorno ANTHROPIC_API_KEY configurada en Vercel — si
/// no está presente, devuelve un error claro en vez de fallar en silencio.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "La IA para redactar descripciones no está configurada todavía. Avísale a soporte." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const websiteUrl = typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
  const draft = typeof body.draft === "string" ? body.draft.trim() : "";

  if (!companyName) {
    return NextResponse.json({ error: "Escribe primero el nombre de la marca." }, { status: 400 });
  }

  const prompt = draft
    ? `Mejora esta descripción de la marca "${companyName}" para el perfil que ven creadores de contenido en un marketplace de marketing de afiliados en Colombia. Hazla más clara y atractiva, mismo idioma (español), tono cercano y profesional, sin emojis, sin comillas, máximo 500 caracteres, un solo párrafo. Texto actual: "${draft}"${websiteUrl ? `\nPágina web de referencia: ${websiteUrl}` : ""}`
    : `Escribe una descripción para el perfil de la marca "${companyName}" que ven creadores de contenido en un marketplace de marketing de afiliados en Colombia. Español, tono cercano y profesional, sin emojis, sin comillas, máximo 500 caracteres, un solo párrafo, que deje claro qué vende la marca y por qué a un creador le convendría promocionarla.${websiteUrl ? `\nPágina web de referencia: ${websiteUrl}` : ""}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = (data.content?.[0]?.text ?? "").trim().slice(0, 500);
    if (!text) throw new Error("Respuesta vacía");

    return NextResponse.json({ description: text });
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo generar la descripción (${err instanceof Error ? err.message : "error desconocido"}).` },
      { status: 502 }
    );
  }
}
