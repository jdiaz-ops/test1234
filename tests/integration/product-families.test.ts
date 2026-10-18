import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getSiblingProducts } from "@/server/services/product-sibling-service";
import { applyProductFamilies, previewProductFamilies } from "@/server/services/product-family-service";
import { createBrand, createProduct, hasDb } from "./helpers";

describe.skipIf(!hasDb)("familias de productos (otros aromas y tamaños)", () => {
  it("arma los otros aromas y tamaños por el nombre, y 'Familias' los deja guardados", async () => {
    const brand = await createBrand();
    const names = [
      "VELOTERAPIA SANDIA 50GR",
      "VELOTERAPIA MARACUYA 50GR",
      "VELOTERAPIA SANDIA 130GR",
      "ACEITE DE CUTICULA COCO 30ML",
      "ACEITE DE CUTICULA UVA 30ML",
      "REGENERADOR DE CUTICULA",
    ];
    const products: Record<string, Awaited<ReturnType<typeof createProduct>>> = {};
    for (const name of names) products[name] = await createProduct(brand.id, { name, price: 10000, stock: 5 });
    const sandia = products["VELOTERAPIA SANDIA 50GR"];

    // Sin nada guardado, por el nombre: otros aromas de 50GR y otros
    // tamaños de SANDIA.
    const dynamic = await getSiblingProducts(brand.id, sandia);
    expect(dynamic.map((g) => [g.axis, g.group, g.current, g.items.map((i) => [i.value, i.current])])).toEqual([
      ["Aroma", "VELOTERAPIA 50GR", "SANDIA", [["SANDIA", true], ["MARACUYA", false]]],
      ["Tamaño", "VELOTERAPIA SANDIA", "50GR", [["50GR", true], ["130GR", false]]],
    ]);
    expect(dynamic[0].items[1].slug).toBe(products["VELOTERAPIA MARACUYA 50GR"].slug);
    expect(await getSiblingProducts(brand.id, products["REGENERADOR DE CUTICULA"])).toEqual([]);

    // Guardado en los atributos.
    const preview = await previewProductFamilies(brand.id);
    expect(preview.families.map((f) => [f.group, f.axes, f.members.length])).toEqual([
      ["VELOTERAPIA", ["Aroma", "Tamaño"], 3],
      ["ACEITE DE CUTICULA", ["Aroma"], 2],
    ]);
    expect(preview.updates).toHaveLength(5);
    expect(await applyProductFamilies(brand.id)).toEqual({ families: 2, products: 5, skipped: 0 });
    const saved = await prisma.product.findUniqueOrThrow({ where: { id: sandia.id } });
    expect(saved.attributes).toEqual({ Grupo: "VELOTERAPIA", Aroma: "SANDIA", Tamaño: "50GR" });
    expect((await getSiblingProducts(brand.id, saved)).map((g) => [g.axis, g.items.map((i) => i.value)])).toEqual([
      ["Aroma", ["SANDIA", "MARACUYA"]],
      ["Tamaño", ["50GR", "130GR"]],
    ]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: products["REGENERADOR DE CUTICULA"].id } })).attributes).toEqual({});

    // Otra vez no cambia nada.
    expect(await applyProductFamilies(brand.id)).toEqual({ families: 2, products: 0, skipped: 0 });
  });

  it("un producto nuevo entra a la familia que ya existía con su mismo Grupo y eje", async () => {
    const brand = await createBrand();
    const acida = await createProduct(brand.id, { name: "Gel Polish Verdes – Acida 15 ml", price: 1, stock: 1 });
    const toxica = await createProduct(brand.id, { name: "Gel Polish Verdes – Toxica 15 ml", price: 1, stock: 1 });
    await prisma.product.update({ where: { id: acida.id }, data: { attributes: { Grupo: "Verdes", Tono: "Acida" } } });
    await prisma.product.update({ where: { id: toxica.id }, data: { attributes: { Grupo: "Verdes", Tono: "Toxica" } } });
    const dulce = await createProduct(brand.id, { name: "Gel Polish Verdes – Dulce 15 ml", price: 1, stock: 1 });
    expect(await applyProductFamilies(brand.id)).toEqual({ families: 1, products: 1, skipped: 0 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: dulce.id } })).attributes).toEqual({ Grupo: "Verdes", Tono: "Dulce" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: acida.id } })).attributes).toEqual({ Grupo: "Verdes", Tono: "Acida" });
  });
});
