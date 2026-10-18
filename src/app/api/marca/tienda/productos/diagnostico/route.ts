import { NextResponse } from "next/server";
import { requireAdminActingAsBrand } from "@/lib/current-brand";
import { auditCatalog } from "@/server/services/catalog-audit-service";

/// Diagnóstico del catálogo — herramienta del administrador con "Entrar
/// como". Ver catalog-audit-service.ts.
export const maxDuration = 60;

export async function GET() {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });
  return NextResponse.json(await auditCatalog(profile.id));
}
