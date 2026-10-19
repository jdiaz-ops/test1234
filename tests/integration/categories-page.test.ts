import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  BrandCollectionError,
  createBrandCollection,
  getPublicBrandCollections,
  listBrandCollections,
  reorderBrandCollections,
  setCollectionInCategories,
} from "@/server/services/brand-collection-service";
import { createBrand, createProduct, hasDb } from "./helpers";

describe.skipIf(!hasDb)("la página Todas las categorías", () => {
  it("sale en el orden de Colecciones y sin las que la marca oculta", async () => {
    const brand = await createBrand();
    const product = await createProduct(brand.id, { name: "Gel", price: 15900, stock: 5 });
    const gel = await createBrandCollection(brand.id, { name: "Gel Polish", productIds: [product.id] });
    const builder = await createBrandCollection(brand.id, { name: "Builder Gel", productIds: [product.id] });
    const kits = await createBrandCollection(brand.id, { name: "Kits", productIds: [product.id] });

    await reorderBrandCollections(brand.id, [kits.id, gel.id, builder.id]);
    await setCollectionInCategories(brand.id, builder.id, false);
    expect((await getPublicBrandCollections(brand.id)).map((c) => c.name)).toEqual(["Kits", "Gel Polish"]);
    // En la lista de la marca sigue, marcada como oculta.
    expect((await listBrandCollections(brand.id)).map((c) => [c.name, c.showInCategories])).toEqual([
      ["Kits", true],
      ["Gel Polish", true],
      ["Builder Gel", false],
    ]);

    // No se puede tocar la colección de otra marca.
    const other = await createBrand();
    await expect(setCollectionInCategories(other.id, gel.id, false)).rejects.toBeInstanceOf(BrandCollectionError);
    expect((await prisma.brandCollection.findUniqueOrThrow({ where: { id: gel.id } })).showInCategories).toBe(true);
  });
});
