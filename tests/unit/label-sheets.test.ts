import { PDFDocument, PDFName, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { LETTER, addLabelSheets, labelLayout } from "@/server/services/label-sheets";

const INTER = { width: 284, height: 340 };

describe("guías de a varias por hoja carta", () => {
  it("las de Interrapidísimo van de a 4, a tamaño real, en orden y centradas", () => {
    const slots = labelLayout(Array.from({ length: 7 }, () => INTER));
    expect(slots.map((s) => s.sheet)).toEqual([0, 0, 0, 0, 1, 1, 1]);
    // Izquierda a derecha y de arriba abajo; 22 puntos a los lados y 56 arriba y abajo.
    expect(slots.slice(0, 4).map((s) => ("x" in s ? [s.x, s.y] : null))).toEqual([
      [22, 396],
      [306, 396],
      [22, 56],
      [306, 56],
    ]);
    // La hoja siguiente empieza otra vez arriba a la izquierda.
    expect(slots[4]).toMatchObject({ x: 22, y: 396 });
  });

  it("otros tamaños: las que quepan sin achicarlas; la que no cabe, sola y como llegó", () => {
    // 4x6 pulgadas: dos por hoja.
    const fourBySix = labelLayout([{ width: 288, height: 432 }, { width: 288, height: 432 }, { width: 288, height: 432 }]);
    expect(fourBySix.map((s) => s.sheet)).toEqual([0, 0, 1]);
    // Una guía del tamaño de la hoja, o girada, va sola.
    expect(labelLayout([LETTER])).toEqual([{ sheet: 0, asIs: true }]);
    expect(labelLayout([{ ...INTER, asIs: true }, INTER])).toEqual([
      { sheet: 0, asIs: true },
      expect.objectContaining({ sheet: 1, x: 22, y: 396 }),
    ]);
    // Si cambia el tamaño, hoja nueva.
    expect(labelLayout([INTER, { width: 288, height: 432 }, INTER]).map((s) => s.sheet)).toEqual([0, 1, 2]);
  });

  it("arma las hojas carta con las guías dibujadas, no copiadas en hojas sueltas", async () => {
    const pages = [];
    for (let i = 0; i < 7; i++) {
      const doc = await PDFDocument.create();
      doc.addPage([INTER.width, INTER.height]).drawText(`Guia ${i + 1}`, { x: 20, y: 300, size: 12 });
      pages.push(doc.getPage(0));
    }
    const girada = await PDFDocument.create();
    girada.addPage([INTER.width, INTER.height]).setRotation(degrees(90));
    pages.push(girada.getPage(0));
    // Una página en blanco no se puede dibujar dentro de otra: va sola.
    const enBlanco = await PDFDocument.create();
    enBlanco.addPage([INTER.width, INTER.height]);
    pages.push(enBlanco.getPage(0));

    const pdf = await PDFDocument.create();
    expect(await addLabelSheets(pdf, pages)).toEqual({ failed: 0 });
    // 7 guías en 2 hojas carta (4 + 3); la girada y la en blanco, cada una en su página.
    expect(pdf.getPages().map((p) => [p.getWidth(), p.getHeight()])).toEqual([
      [612, 792],
      [612, 792],
      [284, 340],
      [284, 340],
    ]);
    // Y el PDF se guarda bien.
    expect((await pdf.save()).length).toBeGreaterThan(1000);
    const drawn = (index: number) => pdf.getPage(index).node.Resources()?.lookup(PDFName.of("XObject"))?.toString().match(/EmbeddedPdfPage/g)?.length ?? 0;
    expect([drawn(0), drawn(1)]).toEqual([4, 3]);
  });
});
