import ExcelJS from "exceljs";
import type { ProductStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  InventoryFileError,
  matchInventoryRow,
  parseInventoryCsv,
  readInventoryTable,
  type InventoryRow,
} from "@/lib/inventory-file";
import { joinPromo, splitPromo } from "@/lib/promo-price";
import { quickUpdateManualProduct } from "@/server/services/brand-store-product-service";

/// Inventario y precio de promoción con el archivo de la marca: primero se
/// muestra qué va a cambiar y qué novedades hay; se aplica solo cuando la
/// marca lo confirma (ver inventory-file-updater.tsx). Solo H la Cosedora
/// (inventoryFileAllowed). Pedido del 2026-11-17.

/// Una celda de Excel como texto (fórmulas, texto con formato…).
function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("text" in value) return String((value as { text: unknown }).text ?? "");
    if ("result" in value) return String((value as { result: unknown }).result ?? "");
    if ("richText" in value) return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return String(value);
}

/// El archivo subido: CSV (coma o punto y coma) o Excel (.xlsx, primera hoja).
export async function readInventoryFile(file: File): Promise<InventoryRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xls")) throw new InventoryFileError("Guarda el Excel como .xlsx o como CSV y vuelve a subirlo.");
  if (!name.endsWith(".xlsx")) return parseInventoryCsv(await file.text());
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new InventoryFileError("No pudimos abrir ese Excel. Guárdalo como .xlsx o como CSV.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new InventoryFileError("El Excel no tiene hojas.");
  const cells: string[][] = [];
  for (let r = 1; r <= sheet.rowCount; r++) {
    cells.push((sheet.getRow(r).values as unknown[]).slice(1).map(cellText));
  }
  return readInventoryTable(cells);
}

type Brief = { id: string; name: string; status: ProductStatus };

export type InventoryPreviewLine = {
  line: number;
  name: string;
  units: number | null;
  promoPrice: number | null;
  product: Brief | null;
  /// Cuando varios productos coinciden: la marca elige uno.
  candidates: Brief[];
  stock: { from: number | null; to: number } | null;
  price: { regular: number; promoFrom: number | null; promoTo: number } | null;
  publish: boolean;
  /// Novedades de la fila (no existe, borrador, variantes…).
  notes: string[];
  willChange: boolean;
};

export type InventoryPreview = {
  lines: InventoryPreviewLine[];
  /// Productos de la tienda que el archivo no menciona.
  notInFile: Brief[];
  changes: number;
};

const pesos = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

/// Qué haría el archivo con los productos de la marca, sin cambiar nada.
/// choices: el producto que eligió la marca para una fila (por número de
/// fila). publishDrafts: publicar los que están en borrador.
export async function previewInventoryFile(
  brandId: string,
  rows: InventoryRow[],
  options: { choices?: Record<number, string>; publishDrafts?: boolean } = {},
): Promise<InventoryPreview> {
  const products = await prisma.product.findMany({
    where: { brandId, manual: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      status: true,
      hasVariants: true,
      stock: true,
      price: true,
      compareAtPrice: true,
      variants: { select: { option1Value: true, option2Value: true, option3Value: true } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const matchable = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    variantValues: p.variants.flatMap((v) => [v.option1Value, v.option2Value, v.option3Value]).filter((v): v is string => Boolean(v)),
  }));
  const brief = (p: (typeof products)[number]): Brief => ({ id: p.id, name: p.name, status: p.status });
  const usedBy = new Map<string, number>();

  const lines = rows.map((row): InventoryPreviewLine => {
    const line: InventoryPreviewLine = {
      ...row,
      product: null,
      candidates: [],
      stock: null,
      price: null,
      publish: false,
      notes: [],
      willChange: false,
    };
    const chosen = options.choices?.[row.line];
    const match = chosen && byId.has(chosen) ? { kind: "product" as const, productId: chosen } : matchInventoryRow(row.name, matchable);
    if (match.kind === "none") {
      line.notes.push("No existe en la tienda.");
      return line;
    }
    if (match.kind === "ambiguous") {
      line.candidates = match.productIds.map((id) => brief(byId.get(id)!));
      line.notes.push("Varios productos coinciden: elige cuál es.");
      return line;
    }
    const product = byId.get(match.productId)!;
    line.product = brief(product);
    if (match.kind === "variant") {
      line.notes.push(`Es la variante «${match.variant}»: el inventario y el precio de las variantes se cambian desde Editar.`);
      return line;
    }
    const earlier = usedBy.get(product.id);
    if (earlier != null) {
      line.notes.push(`La fila ${earlier} del archivo ya es este producto: se usa esa.`);
      return line;
    }
    usedBy.set(product.id, row.line);
    if (product.status === "DRAFT") {
      const priced = product.hasVariants || Number(product.price) > 0;
      line.publish = Boolean(options.publishDrafts) && priced;
      line.notes.push(
        line.publish
          ? "Está en borrador: se publica."
          : priced
            ? "Está en borrador: no se ve en la tienda."
            : "Está en borrador y sin precio: no se puede publicar.",
      );
    }
    if (product.status === "UNLISTED") line.notes.push("Está oculto del catálogo: solo se compra con el link.");
    if (product.hasVariants) {
      line.notes.push("Tiene variantes: el inventario y el precio se cambian por variante desde Editar.");
      line.willChange = line.publish;
      return line;
    }
    if (row.units != null && row.units !== product.stock) line.stock = { from: product.stock, to: row.units };
    if (row.promoPrice != null) {
      const { regular, promo } = splitPromo(Number(product.price), product.compareAtPrice != null ? Number(product.compareAtPrice) : null);
      if (regular == null || row.promoPrice >= regular) {
        line.notes.push(`El precio de oferta (${pesos(row.promoPrice)}) no es menor que el precio (${pesos(regular ?? 0)}): el precio no se cambia.`);
      } else if (promo !== row.promoPrice) {
        line.price = { regular, promoFrom: promo, promoTo: row.promoPrice };
      }
    }
    if (row.units == null && row.promoPrice == null) line.notes.push("La fila no trae unidades ni precio.");
    line.willChange = Boolean(line.stock || line.price || line.publish);
    return line;
  });

  const mentioned = new Set(lines.flatMap((l) => [l.product?.id, ...l.candidates.map((c) => c.id)]));
  const notInFile = products.filter((p) => !mentioned.has(p.id)).map(brief);
  return { lines, notInFile, changes: lines.filter((l) => l.willChange).length };
}

/// Aplica lo que mostró la vista previa (se vuelve a calcular con lo que
/// hay ahora en la tienda): unidades, precio de promoción (el normal queda
/// tachado) y, si la marca lo pidió, publica los borradores.
export async function applyInventoryFile(
  brandId: string,
  rows: InventoryRow[],
  options: { choices?: Record<number, string>; publishDrafts?: boolean } = {},
) {
  const preview = await previewInventoryFile(brandId, rows, options);
  let updated = 0;
  let published = 0;
  const failed: { name: string; error: string }[] = [];
  for (const line of preview.lines) {
    if (!line.willChange || !line.product) continue;
    try {
      await quickUpdateManualProduct(brandId, line.product.id, {
        ...(line.stock ? { stock: line.stock.to } : {}),
        ...(line.price ? joinPromo(line.price.regular, line.price.promoTo) : {}),
        ...(line.publish ? { status: "ACTIVE" as const } : {}),
      });
      updated += 1;
      if (line.publish) published += 1;
    } catch (err) {
      // Una fila que falla no frena las demás: se cuenta y se avisa.
      failed.push({ name: line.product.name, error: err instanceof Error ? err.message : "No se pudo guardar." });
    }
  }
  return { updated, published, failed };
}
