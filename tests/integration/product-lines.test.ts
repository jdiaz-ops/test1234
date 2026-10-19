import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listProductLines, renameProductLines } from "@/server/services/product-lines-service";
import { createBrand, createProduct, hasDb } from "./helpers";

describe.skipIf(!hasDb)("nombres por línea", () => {
  it("cambia el comienzo del nombre de toda la línea y deja el link y los atributos", async () => {
    const brand = await createBrand();
    const black = await createProduct(brand.id, { name: "Gel Polish Blancos, Negros y Grises – SUPER BLACK", price: 15900, stock: 5 });
    await createProduct(brand.id, { name: "Gel Polish Blancos, Negros y Grises – DIGNA", price: 15900, stock: 5 });
    await createProduct(brand.id, { name: "Gel Polish Verdes – CANTANTE", price: 15900, stock: 5 });
    await createProduct(brand.id, { name: "Gel Polish Verdes – RECATADA", price: 15900, stock: 5 });
    await prisma.product.update({ where: { id: black.id }, data: { attributes: { Grupo: "Gel Polish Blancos, Negros y Grises", Referencias: "SUPER BLACK" } } });

    expect(await listProductLines(brand.id)).toEqual([
      { line: "Gel Polish Blancos, Negros y Grises", count: 2, samples: ["DIGNA", "SUPER BLACK"] },
      { line: "Gel Polish Verdes", count: 2, samples: ["CANTANTE", "RECATADA"] },
    ]);

    const result = await renameProductLines(brand.id, [{ line: "Gel Polish Blancos, Negros y Grises", newLine: "Gel Polish" }], true);
    expect(result).toEqual({ renamed: 2 });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: black.id } });
    expect(after).toMatchObject({ name: "Gel Polish – Super Black", slug: black.slug, attributes: { Grupo: "Gel Polish Blancos, Negros y Grises", Referencias: "SUPER BLACK" } });
    // La otra línea no se toca.
    expect((await prisma.product.findMany({ where: { brandId: brand.id, name: { startsWith: "Gel Polish Verdes" } } })).length).toBe(2);
  });
});
