import { describe, expect, it } from "vitest";
import { importShopifyCollections } from "@/server/services/shopify-collections-import-service";
import { importShopifyProducts } from "@/server/services/shopify-csv-import-service";
import { getDraftTheme, getPublishedTheme } from "@/server/services/brand-theme-store";
import { createBrand, hasDb } from "./helpers";

const product = (handle: string) => ({
  handle,
  name: handle,
  description: "",
  price: 10000,
  compareAtPrice: null,
  images: [] as string[],
  sku: "",
  barcode: "",
  weight: null,
  weightUnit: "KG" as const,
  stock: null,
  status: "ACTIVE" as const,
  collectionName: null,
  hasVariants: false,
  optionNames: [] as string[],
  variants: [],
});

describe.skipIf(!hasDb)("menú importado en celular", () => {
  it("con varias entradas queda en el panel lateral y publicado", async () => {
    const brand = await createBrand();
    const handles = ["a", "b", "c", "d", "e", "f"];
    await importShopifyProducts(brand.id, handles.map(product));
    await importShopifyCollections(brand.id, {
      collections: handles.map((h) => ({ handle: `col-${h}`, name: `Col ${h}`, productHandles: [h] })),
      menu: { links: handles.map((h) => ({ label: h.toUpperCase(), href: `/collections/col-${h}` })), replace: true },
    });
    expect((await getDraftTheme(brand.id)).header.mobile.menuStyle).toBe("hamburger");
    expect((await getPublishedTheme(brand.id)).header.mobile.menuStyle).toBe("hamburger");
  });
});
