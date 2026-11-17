import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { inventoryFileAllowed } from "@/lib/features";
import { InventoryFileError } from "@/lib/inventory-file";
import { BrandStoreProductError } from "@/server/services/brand-store-product-service";
import { applyInventoryFile, previewInventoryFile, readInventoryFile } from "@/server/services/inventory-file-service";

const MAX_BYTES = 2 * 1024 * 1024;
/// { "número de fila": "id del producto que eligió la marca" }
const choicesSchema = z.record(z.string(), z.string().min(1));

/// Actualizar inventario y precio de promoción con un archivo (CSV o
/// Excel): con apply=1 aplica, si no, solo muestra qué cambiaría. Solo H la
/// Cosedora (inventoryFileAllowed). Ver inventory-file-service.ts.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!inventoryFileAllowed(profile)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Elige el archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo es muy grande (máximo 2 MB)." }, { status: 400 });
  let rawChoices: unknown = {};
  try {
    rawChoices = JSON.parse(String(form?.get("choices") ?? "{}"));
  } catch {
    rawChoices = null;
  }
  const parsedChoices = choicesSchema.safeParse(rawChoices);
  if (!parsedChoices.success) return NextResponse.json({ error: "Elección inválida." }, { status: 400 });
  const choices = Object.fromEntries(Object.entries(parsedChoices.data).map(([line, id]) => [Number(line), id]));
  const options = { choices, publishDrafts: form?.get("publishDrafts") === "1" };

  try {
    const rows = await readInventoryFile(file);
    if (form?.get("apply") === "1") {
      return NextResponse.json({ ok: true, result: await applyInventoryFile(profile.id, rows, options) });
    }
    return NextResponse.json({ ok: true, preview: await previewInventoryFile(profile.id, rows, options) });
  } catch (err) {
    if (err instanceof InventoryFileError || err instanceof BrandStoreProductError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[productos] inventario con archivo falló", err);
    return NextResponse.json({ error: "No se pudo leer el archivo por un error del servidor. Intenta de nuevo." }, { status: 500 });
  }
}
