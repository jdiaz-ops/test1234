import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdminActingAsBrand } from "@/lib/current-brand";

/// Convierte un Excel (.xlsx) de la marca en texto (una línea por fila,
/// celdas separadas por " | ") para que el navegador lo mande a leer por
/// pedazos (leer-archivos). Sin IA.
export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHARS = 400_000;

export async function POST(req: Request) {
  const profile = await requireAdminActingAsBrand();
  if (!profile) return NextResponse.json({ error: "Solo el administrador de Marcolini puede usar esta herramienta." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Selecciona un archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El Excel es muy grande (máximo 4 MB)." }, { status: 400 });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`# Hoja: ${sheet.name}`);
      sheet.eachRow((row) => {
        const cells = (row.values as unknown[])
          .slice(1)
          .map((v) => {
            if (v == null) return "";
            if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
            if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result ?? "");
            if (typeof v === "object" && "richText" in v) {
              return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
            }
            return String(v);
          })
          .map((s) => s.replace(/\s+/g, " ").trim());
        if (cells.some(Boolean)) lines.push(cells.join(" | "));
      });
    });
    return NextResponse.json({ ok: true, text: lines.join("\n").slice(0, MAX_CHARS) });
  } catch {
    return NextResponse.json({ error: "No pudimos abrir ese Excel. Guárdalo como .xlsx o como CSV." }, { status: 400 });
  }
}
