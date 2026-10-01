import { NextResponse } from "next/server";
import { retryFailedDeliveries } from "@/server/services/webhook-service";

/// Reintento manual de Conexiones (el automático corre dentro del cron
/// diario de /api/cron/pagos-diarios): reintenta los webhooks que no
/// llegaron (además de los reintentos inmediatos y del botón "Reenviar") y
/// limpia el historial viejo. Mismo mecanismo de autenticación que el cron
/// de pagos — ver /api/cron/pagos-diarios.
function isAuthorized(req: Request) {
  if (!process.env.CRON_SECRET) return false;
  const bearer = req.headers.get("authorization");
  if (bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const custom = req.headers.get("x-cron-secret");
  if (custom === process.env.CRON_SECRET) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await retryFailedDeliveries());
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await retryFailedDeliveries());
}
