import { NextResponse } from "next/server";
import { syncAllConnectedBrands } from "@/server/services/product-sync-service";

/// Cron diario de respaldo — la sincronización real ya pasa sola al
/// conectar la tienda y con cada webhook de producto (ver
/// product-sync-service.ts); esto solo existe por si algún webhook se
/// perdió, para que nunca pase más de un día sin que el catálogo esté al
/// día. Mismo mecanismo de autenticación que el cron de pagos — ver
/// /api/cron/pagos-diarios.
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
  return NextResponse.json(await syncAllConnectedBrands());
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await syncAllConnectedBrands());
}
