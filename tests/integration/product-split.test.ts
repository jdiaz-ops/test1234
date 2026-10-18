import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { commonNamePrefix, groupLabel, splitProductsVariants, splitProductVariants } from "@/server/services/product-split-service";
import { getPublicBrandCollection } from "@/server/services/brand-collection-service";
import { getSiblingProducts } from "@/server/services/product-sibling-service";
import { toCardProduct } from "@/components/storefront/product-card";
import { createBrand, createProduct, hasDb } from "./helpers";

describe("grupo de un producto separado", () => {
  it("es su nombre sin lo que comparte con los demás", () => {
    const prefix = commonNamePrefix(["Gel Polish Rosados", "Gel Polish Verdes", "Gel Polish Salmón y Naranjas"]);
    expect(prefix).toBe("Gel Polish ");
    expect(groupLabel("Gel Polish Salmón y Naranjas", prefix)).toBe("Salmón y Naranjas");
    // Sin prefijo común, o si el prefijo es un nombre entero, va el nombre.
    expect(commonNamePrefix(["Gel Polish", "Gel Polish Verdes"])).toBe("");
    expect(groupLabel("Top Coat", "")).toBe("Top Coat");
    expect(commonNamePrefix(["Solo uno"])).toBe("");
  });
});

describe.skipIf(!hasDb)("separar variantes en productos", () => {
  it("cada tono queda como producto propio con su foto, precio, inventario, colecciones y atributos; el original se oculta", async () => {
    const brand = await createBrand();
    const collection = await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Gel Polish", slug: "gel-polish" } });
    const placa = await createProduct(brand.id, {
      name: "Gel Polish Rosados",
      price: 15900,
      stock: null,
      variants: [
        { label: "Princesa", stock: 4 },
        { label: "Loca", stock: 0 },
        { label: "Reina", stock: null },
      ],
    });
    await prisma.product.update({
      where: { id: placa.id },
      data: {
        optionNames: ["Tono"],
        description: "<p>Esmalte semipermanente</p>",
        brandCollections: { create: { collectionId: collection.id, position: 0 } },
      },
    });
    // Por nombre, no por posición: la base no garantiza el orden de las
    // variantes recién creadas (en CI salían en otro orden).
    await prisma.productVariant.update({
      where: { id: placa.variants.find((v) => v.option1Value === "Loca")!.id },
      data: { price: 17900, imageUrl: "https://cdn.prueba.test/loca.jpg", sku: "GP-LOCA" },
    });
    await prisma.productVariant.update({
      where: { id: placa.variants.find((v) => v.option1Value === "Princesa")!.id },
      data: { imageUrl: "https://cdn.prueba.test/princesa.jpg" },
    });
    // Galería del original: la placa con todos los tonos + la foto de cada tono.
    await prisma.productImage.createMany({
      data: ["https://cdn.prueba.test/placa.jpg", "https://cdn.prueba.test/princesa.jpg", "https://cdn.prueba.test/loca.jpg"].map((url, position) => ({
        productId: placa.id,
        url,
        position,
      })),
    });
    const verdes = await createProduct(brand.id, {
      name: "Gel Polish Verdes",
      price: 15900,
      stock: null,
      variants: [{ label: "Acida", stock: 2 }],
    });
    await prisma.product.update({ where: { id: verdes.id }, data: { optionNames: ["Tono"] } });
    const sinVariantes = await createProduct(brand.id, { name: "Top Coat", price: 22000, stock: 3 });

    const result = await splitProductsVariants(brand.id, [placa.id, verdes.id, sinVariantes.id]);
    expect(result).toEqual({ changed: 4, skipped: 1, splitProducts: 2 });

    const created = await prisma.product.findMany({
      where: { brandId: brand.id, name: { startsWith: "Gel Polish Rosados –" } },
      include: { variants: true, images: true, brandCollections: true },
      orderBy: { name: "asc" },
    });
    expect(created.map((p) => p.name)).toEqual(["Gel Polish Rosados – Loca", "Gel Polish Rosados – Princesa", "Gel Polish Rosados – Reina"]);
    const loca = created[0];
    expect(loca).toMatchObject({
      hasVariants: false,
      stock: 0,
      sku: "GP-LOCA",
      imageUrl: "https://cdn.prueba.test/loca.jpg",
      status: "ACTIVE",
      available: true,
      description: "<p>Esmalte semipermanente</p>",
      attributes: { Grupo: "Rosados", Tono: "Loca" },
    });
    expect(Number(loca.price)).toBe(17900);
    expect(loca.variants).toHaveLength(0);
    expect(loca.brandCollections.map((c) => c.collectionId)).toEqual([collection.id]);
    expect(loca.slug).toBe("gel-polish-rosados-loca");
    // Cada tono se queda con su foto y la general (la placa), no con las
    // de los demás tonos.
    expect(loca.images.map((i) => i.url)).toEqual(["https://cdn.prueba.test/loca.jpg", "https://cdn.prueba.test/placa.jpg"]);
    const princesa = created[1];
    expect(Number(princesa.price)).toBe(15900);
    expect(princesa.stock).toBe(4);
    expect(princesa.images.map((i) => i.url)).toEqual(["https://cdn.prueba.test/princesa.jpg", "https://cdn.prueba.test/placa.jpg"]);
    expect(created[2].stock).toBeNull();
    expect(created[2].imageUrl).toBe("https://cdn.prueba.test/placa.jpg");

    // Dentro del producto, los otros tonos del grupo (como las variaciones
    // de Amazon): el actual primero, los demás como links.
    const siblings = await getSiblingProducts(brand.id, loca);
    expect(siblings).toMatchObject({ group: "Rosados", axis: "Tono", current: "Loca" });
    expect(siblings!.items.map((i) => [i.value, i.current, i.soldOut])).toEqual([
      ["Loca", true, true],
      ["Princesa", false, false],
      ["Reina", false, false],
    ]);
    expect(await getSiblingProducts(brand.id, sinVariantes)).toBeNull();

    const acida = await prisma.product.findFirstOrThrow({ where: { brandId: brand.id, name: "Gel Polish Verdes – Acida" } });
    expect(acida.attributes).toEqual({ Grupo: "Verdes", Tono: "Acida" });

    // Los originales quedaron ocultos; el que no tenía variantes, igual.
    const original = await prisma.product.findUniqueOrThrow({ where: { id: placa.id } });
    expect(original).toMatchObject({ status: "DRAFT", available: false, hasVariants: true });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: sinVariantes.id } })).status).toBe("ACTIVE");

    // La colección pública muestra los nuevos (no el original) con sus
    // atributos para los filtros.
    // "Loca" quedó con stock 0: por defecto la vitrina esconde los agotados
    // (ver product-stock.ts), así que acá se piden con la opción prendida.
    const publicCollection = await getPublicBrandCollection(brand.id, "gel-polish", { showSoldOut: true });
    const cards = publicCollection!.products.map((p) => toCardProduct(p.product));
    expect(cards.map((c) => c.name).sort()).toEqual(["Gel Polish Rosados – Loca", "Gel Polish Rosados – Princesa", "Gel Polish Rosados – Reina"]);
    expect(cards.find((c) => c.name.endsWith("Loca"))?.attributes).toEqual({ Grupo: "Rosados", Tono: "Loca" });

    // Un producto sin variantes no se puede separar.
    await expect(splitProductVariants(brand.id, sinVariantes.id)).rejects.toThrow(/no tiene variantes/);
  });
});
