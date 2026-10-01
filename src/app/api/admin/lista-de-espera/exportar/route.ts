import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { buildWaitlistWorkbook } from "@/server/services/waitlist-service";

export const maxDuration = 60;

/// Descarga en Excel de la lista de espera (?tipo=marcas para marcas).
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const brands = new URL(req.url).searchParams.get("tipo") === "marcas";
  const buffer = await buildWaitlistWorkbook(brands ? "BRAND" : "CREATOR");
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lista-de-espera-${brands ? "marcas" : "creadores"}-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
