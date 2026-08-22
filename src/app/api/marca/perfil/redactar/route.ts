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

  const rules = [
    "Español de Colombia, tono cercano y profesional.",
    "Máximo 150 caracteres — debe caber en 2 líneas cortas, así que sé breve y directo.",
    "Una sola frase (o dos muy cortas), sin emojis, sin comillas, sin punto final si no hace falta.",
    "No inventes datos que no te dieron: nada de 'líder en...', premios, años de experiencia, tamaño de la empresa ni cifras que no aparezcan en la información dada.",
    "Nada de relleno genérico de marketing ('tecnología moderna', 'aliado perfecto', 'alto valor agregado'). Sé concreto sobre qué vende la marca.",
    "Responde solo con el texto final, nada más.",
  ].join("\n- ");

  const prompt = draft
    ? `Mejora (no reescribas desde cero, mantén la idea) esta descripción de la marca "${companyName}" para su perfil en un marketplace de marketing de afiliados, que ven creadores de contenido.\nTexto actual: "${draft}"${websiteUrl ? `\nPágina web de referencia (úsala solo para entender qué venden, no para inventar más): ${websiteUrl}` : ""}\n\nReglas:\n- ${rules}`
    : `Escribe una descripción corta para el perfil de la marca "${companyName}" en un marketplace de marketing de afiliados, que ven creadores de contenido en Colombia. Solo tienes el nombre de la marca${websiteUrl ? ` y su página web (${websiteUrl})` : ""} — si no es obvio a qué se dedica, escribe algo genérico y breve tipo "Marca colombiana — cuéntanos qué vendes para afinar tu descripción" en vez de inventar un rubro.\n\nReglas:\n- ${rules}`;

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
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error(errBody?.error?.message ?? `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = (data.content?.[0]?.text ?? "").trim().slice(0, 150);
    if (!text) throw new Error("Respuesta vacía");

    return NextResponse.json({ description: text });
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo generar la descripción (${err instanceof Error ? err.message : "error desconocido"}).` },
      { status: 502 }
    );
  }
}
