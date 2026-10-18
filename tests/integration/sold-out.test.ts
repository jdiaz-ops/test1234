import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { importShopifyProducts } from "@/server/services/shopify-csv-import-service";
import { importShopifyCollections } from "@/server/services/shopify-collections-import-service";
import {
  getRelatedProducts,
  listStorefrontProducts,
  searchStorefrontProducts,
} from "@/server/services/store-order-service";
import { getPublicBrandCollection, getPublicBrandCollections } from "@/server/services/brand-collection-service";
import { isSoldOut } from "@/lib/product-stock";
import { createBrand, hasDb } from "./helpers";

function product(handle: string, stock: number | null, variants: { value: string; stock: number | null }[] = []) {
  return {
    handle,
    name: `Producto ${handle}`,
    description: "",
    price: 10000,
    compareAtPrice: null,
    images: [],
    sku: "",
    barcode: "",
    weight: null,
    weightUnit: "KG" as const,
    stock,
    status: "ACTIVE" as const,
    collectionName: null,
    hasVariants: variants.length > 0,
    optionNames: variants.length > 0 ? ["Tono"] : [],
    variants: variants.map((v, i) => ({
      option1Value: v.value,
      option2Value: null,
      option3Value: null,
      price: 10000,
      compareAtPrice: null,
      sku: "",
      barcode: "",
      weight: null,
      weightUnit: "KG" as const,
      stock: v.stock,
      position: i,
      imageUrl: null,
    })),
  };
}

describe("agotado: qué es", () => {
  it("sin variantes es stock 0; con variantes, todas en 0; stock null nunca", () => {
    expect(isSoldOut({ stock: 0, hasVariants: false })).toBe(true);
    expect(isSoldOut({ stock: 3, hasVariants: false })).toBe(false);
    expect(isSoldOut({ stock: null, hasVariants: false })).toBe(false);
    expect(isSoldOut({ stock: 0, hasVariants: true, variants: [{ stock: 0 }, { stock: 0 }] })).toBe(true);
    expect(isSoldOut({ stock: 0, hasVariants: true, variants: [{ stock: 0 }, { stock: 2 }] })).toBe(false);
    expect(isSoldOut({ stock: 0, hasVariants: true, variants: [{ stock: 0 }, { stock: null }] })).toBe(false);
    expect(isSoldOut({ stock: 0, hasVariants: true, variants: [] })).toBe(false);
  });
});

describe.skipIf(!hasDb)("agotados escondidos por defecto en la vitrina", () => {
  it("catálogo, buscador, colecciones y relacionados los saltan; con la opción prendida vuelven", async () => {
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [
      product("agotado", 0),
      product("con-stock", 3),
      product("sin-control", null),
      product("variantes-agotadas", 0, [
        { value: "Rojo", stock: 0 },
        { value: "Nude", stock: 0 },
      ]),
      product("variantes-con-una", 0, [
        { value: "Rojo", stock: 0 },
        { value: "Nude", stock: 2 },
      ]),
    ]);
    await importShopifyCollections(brand.id, {
      collections: [
        { handle: "todos", name: "Todos", productHandles: ["agotado", "con-stock", "sin-control", "variantes-agotadas", "variantes-con-una"] },
        { handle: "solo-agotados", name: "Solo agotados", productHandles: ["agotado", "variantes-agotadas"] },
      ],
    });
    const names = (list: { name: string }[]) => list.map((p) => p.name).sort();
    const visible = ["Producto con-stock", "Producto sin-control", "Producto variantes-con-una"];
    const all = ["Producto agotado", ...visible, "Producto variantes-agotadas"].sort();

    expect(names(await listStorefrontProducts(brand.id))).toEqual(visible);
    expect(names(await listStorefrontProducts(brand.id, { showSoldOut: true }))).toEqual(all);
    expect(names(await searchStorefrontProducts(brand.id, "Producto"))).toEqual(visible);
    expect(names(await searchStorefrontProducts(brand.id, "Producto", { showSoldOut: true }))).toEqual(all);

    const collection = await getPublicBrandCollection(brand.id, "todos");
    expect(names(collection!.products.map((p) => p.product))).toEqual(visible);
    const withSoldOut = await getPublicBrandCollection(brand.id, "todos", { showSoldOut: true });
    expect(names(withSoldOut!.products.map((p) => p.product))).toEqual(all);

    // Una colección donde todo está agotado no se lista entre las categorías.
    expect((await getPublicBrandCollections(brand.id)).map((c) => c.slug)).toEqual(["todos"]);
    expect((await getPublicBrandCollections(brand.id, { showSoldOut: true })).map((c) => c.slug).sort()).toEqual(["solo-agotados", "todos"]);

    const conStock = await prisma.product.findFirstOrThrow({ where: { brandId: brand.id, externalId: "shopify-csv-con-stock" } });
    expect(names(await getRelatedProducts(brand.id, conStock.id, 10))).toEqual(["Producto sin-control", "Producto variantes-con-una"]);
    expect(names(await getRelatedProducts(brand.id, conStock.id, 10, { showSoldOut: true }))).toEqual(all.filter((n) => n !== "Producto con-stock"));
  });
});
