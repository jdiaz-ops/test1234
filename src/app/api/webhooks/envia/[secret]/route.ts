import { NextResponse } from "next/server";
import { runLater } from "@/lib/run-later";
import { findEnviaConnectionBySecret, processEnviaWebhook } from "@/server/services/envia-service";

/// Avisos de Envia (cambios de estado de las guías). La marca pega este
/// link, con su secreto, en Envia → Configuración → Desarrolladores →
/// Webhooks (ver la tarjeta de Envia en Tienda → Conexiones). Envia pide
/// respuesta en menos de 5 segundos: se responde ya y el estado se
/// consulta después.
export const maxDuration = 60;

type Params = { params: Promise<{ secret: string }> };

export async function POST(req: Request, { params }: Params) {
  const { secret } = await params;
  const conn = await findEnviaConnectionBySecret(secret);
  if (!conn) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const payload = await req.json().catch(() => null);
  await runLater(() =>
    processEnviaWebhook(conn, payload).catch((err) => {
      console.error(`[envia] No se pudo procesar un aviso de Envia de la marca ${conn.brandId}:`, err);
    }),
  );
  return NextResponse.json({ ok: true });
}

/// Por si Envia revisa el link antes de guardarlo.
export async function GET(_req: Request, { params }: Params) {
  const { secret } = await params;
  const conn = await findEnviaConnectionBySecret(secret);
  return conn ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No encontrado" }, { status: 404 });
}
