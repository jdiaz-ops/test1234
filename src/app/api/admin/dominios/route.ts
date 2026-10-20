import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { checkVercelConnection } from "@/server/integrations/vercel-domains";

/// "Probar conexión" de los dominios propios con Vercel — solo admin, solo
/// lee. Ver checkVercelConnection.
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json(await checkVercelConnection());
}
