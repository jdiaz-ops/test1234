import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createManualProduct, updateManualProduct } from "@/server/services/brand-store-product-service";
import { createBrand, hasDb } from "./helpers";

const variant = (color: string, price: number | null) => ({
  option1Value: color,
  option2Value: null,
  option3Value: null,
  price,
  sku: "",
  barcode: "",
  stock: null,
  weight: null,
  weightUnit: "KG" as const,
});

describe.skipIf(!hasDb)("precio base de un producto con variantes", () => {
  it("al crear y al editar queda en el menor precio de las variantes", async () => {
    const brand = await createBrand();
    const created = await createManualProduct(brand.id, {
      name: "Gel Polish Azules",
      slug: "gel-polish-azules",
      price: 0,
      images: [],
      hasVariants: true,
      optionNames: ["Color"],
      variants: [variant("Cabrona", 18900), variant("Patrona", 15900)],
    });
    expect(Number(created.price)).toBe(15900);

    await updateManualProduct(brand.id, created.id, {
      name: "Gel Polish Azules",
      slug: "gel-polish-azules",
      price: 0,
      images: [],
      hasVariants: true,
      optionNames: ["Color"],
      variants: [variant("Cabrona", 21000), variant("Patrona", null)],
    });
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: created.id } })).price)).toBe(21000);

    // Sin precios propios, el base es el que mande la marca.
    const plain = await createManualProduct(brand.id, {
      name: "Top coat",
      slug: "top-coat",
      price: 12000,
      images: [],
      hasVariants: true,
      optionNames: ["Tamaño"],
      variants: [variant("15 ml", null)],
    });
    expect(Number(plain.price)).toBe(12000);
  });
});
