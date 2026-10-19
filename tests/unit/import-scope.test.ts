import { describe, expect, it } from "vitest";
import { ALL_STORE, applyImportScope, importStats, vendorsOf } from "@/lib/import-scope";
import type { ShopifyImportProduct } from "@/lib/shopify-csv";
import { convertShopifyProducts, type ShopifyImportCollection } from "@/lib/shopify-products-json";
import { parseProductPage, parseWooProduct, toShopifyImport } from "@/lib/store-scrape";

function product(handle: string, name: string, vendor?: string, extra: Partial<ShopifyImportProduct> = {}): ShopifyImportProduct {
  return {
    handle,
    name,
    description: "",
    price: 1000,
    compareAtPrice: null,
    images: ["https://cdn.example.com/a.jpg"],
    sku: "",
    barcode: "",
    weight: null,
    weightUnit: "KG",
    stock: null,
    status: "ACTIVE",
    collectionName: null,
    vendor,
    hasVariants: false,
    optionNames: [],
    variants: [],
    ...extra,
  };
}

const products = [
  product("shilke-builder-nude", "Builder Gel Nude", "Shilke"),
  product("shilke-top", "Top Coat Shilké", "SHILKE "),
  product("otra-base", "Base Rubber", "Otra Marca"),
  product("lima", "Lima 180/240"),
];
const collections: ShopifyImportCollection[] = [
  { handle: "builder-gel", name: "Builder gel", description: "", imageUrl: null, sortOrder: "MANUAL", productsCount: null, productHandles: ["shilke-builder-nude", "otra-base"] },
  { handle: "accesorios", name: "Accesorios", description: "", imageUrl: null, sortOrder: "MANUAL", productsCount: null, productHandles: ["lima"] },
];

describe("traer solo una parte de la tienda", () => {
  it("toda la tienda deja todo igual", () => {
    expect(applyImportScope(products, collections, ALL_STORE)).toEqual({ products, collections });
  });

  it("una marca: sus productos y las colecciones donde están, solo con ellos", () => {
    expect(vendorsOf(products)).toEqual([
      { name: "Shilke", count: 2 },
      { name: "Otra Marca", count: 1 },
    ]);
    const { products: picked, collections: kept } = applyImportScope(products, collections, { kind: "brand", value: "Shilke" });
    expect(picked.map((p) => p.handle)).toEqual(["shilke-builder-nude", "shilke-top"]);
    expect(kept).toEqual([expect.objectContaining({ handle: "builder-gel", productHandles: ["shilke-builder-nude"] })]);
  });

  it("una colección: solo sus productos y solo esa colección", () => {
    const { products: picked, collections: kept } = applyImportScope(products, collections, { kind: "collection", value: "builder-gel" });
    expect(picked.map((p) => p.handle)).toEqual(["shilke-builder-nude", "otra-base"]);
    expect(kept.map((c) => c.handle)).toEqual(["builder-gel"]);
  });

  it("los que digan una palabra en el nombre o la marca, sin importar tildes ni mayúsculas", () => {
    expect(applyImportScope(products, collections, { kind: "text", value: "shilke" }).products.map((p) => p.handle)).toEqual(["shilke-builder-nude", "shilke-top"]);
    expect(applyImportScope(products, collections, { kind: "text", value: "  " }).products).toEqual([]);
    expect(importStats(applyImportScope(products, collections, { kind: "text", value: "nude" }).products)).toEqual({
      products: 1,
      withVariants: 0,
      images: 1,
      unknownStock: 1,
      draft: 0,
    });
  });
});

describe("la marca de cada producto al leer la tienda", () => {
  it("Shopify: el Vendor", () => {
    const [p] = convertShopifyProducts([{ title: "Builder", handle: "builder", vendor: " Shilke ", variants: [{ option1: "Default Title", price: "1000.00" }] }]).products;
    expect(p.vendor).toBe("Shilke");
  });

  it("WooCommerce: la marca o el atributo Marca", () => {
    const withBrand = parseWooProduct({ name: "Builder", slug: "builder", prices: { price: "1000" }, brands: [{ name: "Shilke" }] }, "https://tienda.co");
    expect(toShopifyImport(withBrand!).vendor).toBe("Shilke");
    const withAttribute = parseWooProduct(
      { name: "Top", slug: "top", prices: { price: "1000" }, attributes: [{ name: "Marca", has_variations: false, terms: [{ name: "Shilke &amp; Co" }] }] },
      "https://tienda.co",
    );
    expect(withAttribute?.brand).toBe("Shilke & Co");
  });

  it("cualquier otra: la marca del JSON-LD del producto", () => {
    const html = `<html><head><script type="application/ld+json">{"@type":"Product","name":"Builder Gel Nude","brand":{"@type":"Brand","name":"Shilke"},"offers":{"price":"25000","priceCurrency":"COP"}}</script></head></html>`;
    expect(parseProductPage(html, "https://tienda.co/producto/builder-gel-nude/")?.brand).toBe("Shilke");
  });
});
