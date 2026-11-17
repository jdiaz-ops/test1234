import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseInventoryCsv } from "@/lib/inventory-file";
import { applyInventoryFile, previewInventoryFile } from "@/server/services/inventory-file-service";
import { createBrand, createProduct, hasDb } from "./helpers";

async function product(brandId: string, name: string, data: { price: number; stock: number | null; status?: "ACTIVE" | "DRAFT" | "UNLISTED"; compareAtPrice?: number }) {
  const created = await createProduct(brandId, { name, price: data.price, stock: data.stock });
  return prisma.product.update({
    where: { id: created.id },
    data: { status: data.status ?? "ACTIVE", available: data.status !== "DRAFT", compareAtPrice: data.compareAtPrice ?? null },
  });
}
const read = (id: string) => prisma.product.findUniqueOrThrow({ where: { id } });

describe.skipIf(!hasDb)("inventario y precios de promoción con un archivo", () => {
  it("muestra qué cambia y las novedades, y aplica solo lo de esta marca", async () => {
    const brand = await createBrand();
    const chicago = await product(brand.id, "Esmalte Tradicional Chicago", { price: 4000, stock: 5 });
    const roma = await product(brand.id, "Esmalte Tradicional Roma", { price: 4000, stock: 0, status: "DRAFT" });
    const gelRoma = await product(brand.id, "Esmalte Gel Roma", { price: 9000, stock: 3 });
    const mate = await product(brand.id, "Matificador", { price: 2000, stock: 10 });
    const limas = await product(brand.id, "Limas medianas", { price: 12000, stock: 49 });
    const brillo = await product(brand.id, "Brillo", { price: 4000, stock: 1, status: "UNLISTED" });
    const kit = await createProduct(brand.id, { name: "Kit Base", price: 5000, stock: null, variants: [{ label: "Grande", stock: 3 }] });
    const otherBrand = await createBrand();
    const theirs = await product(otherBrand.id, "Esmalte Tradicional Chicago", { price: 4000, stock: 5 });

    const rows = parseInventoryCsv(`,Producto,Unidades,Precio unitario en oferta
,Chicago,22,2000
,Roma,139,2000
,Matificador ,197,2000
,Limas medianas ,49,10000
,Base ,93,2000
,Brillo,90,2000
,Tipei,1,2000
,Chicago,5,2000
`);
    const preview = await previewInventoryFile(brand.id, rows);
    const at = (name: string, n = 0) => preview.lines.filter((l) => l.name === name)[n];

    expect(at("Chicago")).toMatchObject({
      product: { id: chicago.id },
      stock: { from: 5, to: 22 },
      price: { regular: 4000, promoFrom: null, promoTo: 2000 },
      willChange: true,
      notes: [],
    });
    expect(at("Roma").candidates.map((c) => c.id).sort()).toEqual([roma.id, gelRoma.id].sort());
    expect(at("Roma").willChange).toBe(false);
    // Ya vale 2.000: la oferta no es menor, pero las unidades sí cambian.
    expect(at("Matificador")).toMatchObject({ stock: { to: 197 }, price: null, willChange: true });
    expect(at("Matificador").notes[0]).toContain("no es menor que el precio");
    expect(at("Limas medianas")).toMatchObject({ stock: null, price: { regular: 12000, promoTo: 10000 }, willChange: true });
    expect(at("Base")).toMatchObject({ product: { id: kit.id }, willChange: false });
    expect(at("Base").notes[0]).toContain("Tiene variantes");
    expect(at("Brillo").notes).toContain("Está oculto del catálogo: solo se compra con el link.");
    expect(at("Tipei").notes).toEqual(["No existe en la tienda."]);
    expect(at("Chicago", 1).notes[0]).toContain("La fila 2 del archivo ya es este producto");
    expect(preview.changes).toBe(4);
    // Los que el archivo no menciona: ninguno (todos aparecen arriba).
    expect(preview.notInFile).toEqual([]);

    // La marca elige el Roma tradicional y publica los borradores.
    const romaLine = at("Roma").line;
    const result = await applyInventoryFile(brand.id, rows, { choices: { [romaLine]: roma.id }, publishDrafts: true });
    expect(result).toEqual({ updated: 5, published: 1, failed: [] });

    expect(await read(chicago.id)).toMatchObject({ stock: 22 });
    expect(Number((await read(chicago.id)).price)).toBe(2000);
    expect(Number((await read(chicago.id)).compareAtPrice)).toBe(4000);
    const romaNow = await read(roma.id);
    expect(romaNow).toMatchObject({ stock: 139, status: "ACTIVE", available: true });
    expect([Number(romaNow.price), Number(romaNow.compareAtPrice)]).toEqual([2000, 4000]);
    expect(await read(gelRoma.id)).toMatchObject({ stock: 3 });
    const mateNow = await read(mate.id);
    expect([mateNow.stock, Number(mateNow.price), mateNow.compareAtPrice]).toEqual([197, 2000, null]);
    const limasNow = await read(limas.id);
    expect([limasNow.stock, Number(limasNow.price), Number(limasNow.compareAtPrice)]).toEqual([49, 10000, 12000]);
    expect(await read(brillo.id)).toMatchObject({ stock: 90, status: "UNLISTED" });
    // Otra marca con un producto igual: no se toca.
    expect(await read(theirs.id)).toMatchObject({ stock: 5 });

    // Con el mismo archivo otra vez, ya no hay nada que cambiar en Chicago.
    const again = await previewInventoryFile(brand.id, rows, { choices: { [romaLine]: roma.id } });
    expect(again.lines.find((l) => l.name === "Chicago")).toMatchObject({ willChange: false, notes: [] });
  });

  it("un borrador sin precio no se publica, y lo dice", async () => {
    const brand = await createBrand();
    const draft = await product(brand.id, "Esmalte Tradicional Viena", { price: 0, stock: 0, status: "DRAFT" });
    const rows = parseInventoryCsv("Producto,Unidades\nViena,5\n");
    const preview = await previewInventoryFile(brand.id, rows, { publishDrafts: true });
    expect(preview.lines[0]).toMatchObject({ publish: false, stock: { to: 5 }, willChange: true });
    expect(preview.lines[0].notes).toEqual(["Está en borrador y sin precio: no se puede publicar."]);
    await applyInventoryFile(brand.id, rows, { publishDrafts: true });
    expect(await read(draft.id)).toMatchObject({ stock: 5, status: "DRAFT" });
  });
});
