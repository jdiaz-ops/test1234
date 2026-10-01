import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { buildWaitlistWorkbook } from "@/server/services/waitlist-service";

export const maxDuration = 60;

/// Descarga en Excel de la lista de espera de creadores.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const buffer = await buildWaitlistWorkbook("CREATOR");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lista-de-espera-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
