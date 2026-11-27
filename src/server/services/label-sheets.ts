import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

/// Las guías en hojas carta, varias por hoja y a tamaño real, para no gastar
/// una hoja por guía (pedido del 2026-11-27): las de Interrapidísimo
/// (284 × 340 puntos, 10 × 12 cm) van de a 4. Sin achicarlas: el código de
/// barras y el QR quedan exactos (se dibujan como vienen, no como imagen).
/// Ver mergedOrderLabels en envia-service.ts.

export const LETTER = { width: 612, height: 792 } as const;
/// Lo que casi ninguna impresora alcanza a imprimir en el borde (¼ de pulgada).
const PRINTER_MARGIN = 18;
/// Debajo de las guías, si hay espacio: "Guías 1–4 de 31 · Hoja 1 de 8".
const FOOTER_SPACE = 30;

export type LabelSize = { width: number; height: number; asIs?: boolean };
export type LabelSlot =
  | { sheet: number; asIs: true }
  | { sheet: number; x: number; y: number; cols: number; rows: number };

const sameSize = (a: LabelSize, b: LabelSize) => Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/// Dónde va cada guía, en orden: de izquierda a derecha y de arriba abajo,
/// tantas por hoja como quepan sin achicarlas, centradas en la hoja. Una
/// guía de otro tamaño empieza hoja nueva; la que no cabe más de una vez por
/// hoja (o viene girada, `asIs`) va sola en su hoja, como llegó.
export function labelLayout(labels: LabelSize[], page: { width: number; height: number } = LETTER): LabelSlot[] {
  const slots: LabelSlot[] = [];
  let sheet = -1;
  let current: { size: LabelSize; cols: number; rows: number; used: number } | null = null;
  for (const size of labels) {
    const cols = Math.floor((page.width - 2 * PRINTER_MARGIN) / size.width);
    const rows = Math.floor((page.height - 2 * PRINTER_MARGIN) / size.height);
    if (size.asIs || cols * rows < 2) {
      sheet += 1;
      current = null;
      slots.push({ sheet, asIs: true });
      continue;
    }
    if (!current || !sameSize(current.size, size) || current.used === current.cols * current.rows) {
      sheet += 1;
      current = { size, cols, rows, used: 0 };
    }
    const cell = current.used++;
    const left = (page.width - cols * size.width) / 2;
    const top = (page.height - rows * size.height) / 2;
    slots.push({
      sheet,
      cols,
      rows,
      x: left + (cell % cols) * size.width,
      y: page.height - top - (Math.floor(cell / cols) + 1) * size.height,
    });
  }
  return slots;
}

/// Agrega a `pdf` las guías (páginas de los PDF de Envia, en orden) en hojas
/// carta, con líneas punteadas para cortar entre una y otra. Devuelve
/// cuántas no se pudieron poner.
export async function addLabelSheets(pdf: PDFDocument, labels: PDFPage[]): Promise<{ failed: number }> {
  // Girada, o sin contenido (no se puede dibujar dentro de otra hoja): sola.
  const slots = labelLayout(
    labels.map((p) => ({
      width: p.getWidth(),
      height: p.getHeight(),
      asIs: p.getRotation().angle % 360 !== 0 || !p.node.Contents(),
    })),
  );
  const totalSheets = slots.length > 0 ? slots[slots.length - 1].sheet + 1 : 0;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const gray = rgb(0.6, 0.6, 0.6);
  type GridSheet = { page: PDFPage; number: number; size: LabelSize; cols: number; rows: number; used: number; first: number; last: number };
  const sheets: GridSheet[] = [];
  let failed = 0;

  for (const [i, slot] of slots.entries()) {
    const label = labels[i];
    try {
      if ("asIs" in slot) {
        const [copy] = await pdf.copyPages(label.doc, [label.doc.getPages().indexOf(label)]);
        pdf.addPage(copy);
        continue;
      }
      let sheet = sheets.at(-1);
      if (!sheet || sheet.number !== slot.sheet) {
        sheet = {
          page: pdf.addPage([LETTER.width, LETTER.height]),
          number: slot.sheet,
          size: { width: label.getWidth(), height: label.getHeight() },
          cols: slot.cols,
          rows: slot.rows,
          used: 0,
          first: i + 1,
          last: i + 1,
        };
        sheets.push(sheet);
      }
      const embedded = await pdf.embedPage(label);
      // Ya (y no al guardar): si una guía no se puede dibujar, falla aquí.
      await embedded.embed();
      sheet.page.drawPage(embedded, { x: slot.x, y: slot.y, width: label.getWidth(), height: label.getHeight() });
      sheet.used += 1;
      sheet.last = i + 1;
    } catch {
      failed += 1;
    }
  }

  for (const sheet of sheets) {
    const { page, size, cols, rows, used } = sheet;
    const left = (LETTER.width - cols * size.width) / 2;
    const top = (LETTER.height - rows * size.height) / 2;
    const usedCols = Math.min(used, cols);
    const usedRows = Math.ceil(used / cols);
    const dash = { thickness: 0.6, color: gray, dashArray: [4, 4] };
    for (let c = 1; c < usedCols; c++) {
      const x = left + c * size.width;
      page.drawLine({ start: { x, y: LETTER.height - top }, end: { x, y: LETTER.height - top - usedRows * size.height }, ...dash });
    }
    for (let r = 1; r < usedRows; r++) {
      const y = LETTER.height - top - r * size.height;
      page.drawLine({ start: { x: left, y }, end: { x: left + usedCols * size.width, y }, ...dash });
    }
    if (top >= FOOTER_SPACE) {
      const range = sheet.last > sheet.first ? `${sheet.first}–${sheet.last}` : `${sheet.first}`;
      const text = `Guías ${range} de ${labels.length} · Hoja ${sheet.number + 1} de ${totalSheets}`;
      page.drawText(text, { x: (LETTER.width - font.widthOfTextAtSize(text, 8)) / 2, y: top / 2 - 3, size: 8, font, color: gray });
    }
  }
  return { failed };
}
