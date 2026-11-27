import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPackingSlipsPdf, pdfText, slipItems, type SlipOrder } from "@/server/services/packing-slip-service";

const item = (name: string, quantity: number, sku: string | null = null, variantLabel: string | null = null) => ({
  name,
  quantity,
  sku,
  variantLabel,
});

const order = (number: string, items: ReturnType<typeof slipItems>): SlipOrder => ({
  number,
  buyerName: "Ana María Gómez",
  place: "Bogotá, Bogotá D.C.",
  notes: null,
  carrier: "Interrapidísimo",
  trackingNumber: "240012345678",
  items,
});

const pagesOf = async (pdf: Uint8Array) => (await PDFDocument.load(pdf)).getPageCount();

describe("hoja de empaque", () => {
  it("una línea por producto, con las cantidades sumadas y en orden natural", () => {
    expect(
      slipItems([
        item("Esmalte Tono 10", 1, "ET-10"),
        item("Esmalte Tono 2", 2, "ET-2"),
        item("Esmalte Tono 10", 2, "ET-10"),
        item("Kit Stamping", 1, null, "Dorado"),
      ]),
    ).toEqual([
      { quantity: 2, name: "Esmalte Tono 2", sku: "ET-2" },
      { quantity: 3, name: "Esmalte Tono 10", sku: "ET-10" },
      { quantity: 1, name: "Kit Stamping - Dorado", sku: null },
    ]);
  });

  it("deja tildes y eñes, y quita lo que la fuente del PDF no puede escribir", () => {
    expect(pdfText("Top Coat 💅 Peñón\n«Brillo» 光")).toBe("Top Coat Peñón «Brillo»");
  });

  it("varios pedidos por hoja, y uno muy largo sigue en la siguiente", async () => {
    const small = Array.from({ length: 10 }, (_, i) =>
      order(`P${i}`, slipItems([item("Esmalte Chicago", 1 + (i % 3), "ET-CHI"), item("Matificador 💅", 1, "MAT")])),
    );
    expect(await pagesOf(await buildPackingSlipsPdf("H la Cosedora", small, new Date()))).toBeLessThanOrEqual(2);

    const long = order("LARGO", slipItems(Array.from({ length: 60 }, (_, i) => item(`Esmalte Tono ${i + 1}`, 1, `ET-${i}`))));
    expect(await pagesOf(await buildPackingSlipsPdf("H la Cosedora", [long], new Date()))).toBe(3);
  });
});
