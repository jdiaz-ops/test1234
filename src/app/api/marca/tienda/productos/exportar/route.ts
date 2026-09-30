import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { buildProductsWorkbook } from "@/server/services/store-export-service";

export const maxDuration = 60;

/// Descarga en Excel (.xlsx) de los productos de la marca. Ver
/// store-export-service.ts.
export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const buffer = await buildProductsWorkbook(profile.id);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="productos-${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
