import { NextResponse } from "next/server";
import { refreshAllCustomDomains } from "@/server/services/custom-domain-service";

/// Cron diario: revisa los dominios propios verificados — activa los que ya
/// abren la tienda (y le avisa a la marca) y devuelve al subdominio los que
/// dejaron de responder (ver refreshCustomDomain). Misma autenticación que
/// los otros crons — ver /api/cron/pagos-diarios.
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
  return NextResponse.json(await refreshAllCustomDomains());
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await refreshAllCustomDomains());
}
