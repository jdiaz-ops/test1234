import { NextResponse } from "next/server";
import { reorderOrganizedBrands } from "@/server/services/store-organizer-service";

/// Cron diario: en las tiendas con el organizador aplicado, lo más vendido
/// sube dentro de cada colección, las colecciones y el menú se ordenan
/// por demanda y "Los más vendidos" de la portada se actualiza con los
/// pedidos reales (ver store-organizer-service.ts). Misma autenticación
/// que los otros crons — ver /api/cron/pagos-diarios.
export const maxDuration = 300;

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
  return NextResponse.json({ brands: await reorderOrganizedBrands() });
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ brands: await reorderOrganizedBrands() });
}
