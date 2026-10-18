import { NextResponse } from "next/server";

/// Señal de vida pública, sin secretos: qué versión está desplegada y si
/// la IA está configurada (solo sí/no). Sirve para comprobar desde afuera
/// que un despliegue tomó una variable de entorno. Ver conversación del
/// 2026-10-18.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      ia: Boolean(process.env.ANTHROPIC_API_KEY),
      at: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
