import { rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getDraftTheme, getPublishedTheme } from "@/server/services/brand-theme-store";
import { importShopifyProducts } from "@/server/services/shopify-csv-import-service";
import { importShopifyCollections } from "@/server/services/shopify-collections-import-service";
import { applyShopifyDesign } from "@/server/services/shopify-design-import-service";
import { createBrand, hasDb } from "./helpers";

function product(handle: string, name: string) {
  return {
    handle,
    name,
    description: "",
    price: 10000,
    compareAtPrice: null,
    images: [],
    sku: "",
    barcode: "",
    weight: null,
    weightUnit: "KG" as const,
    stock: null,
    status: "ACTIVE" as const,
    collectionName: null,
    hasVariants: false,
    optionNames: [],
    variants: [],
  };
}

/// Un PNG de 1×1 para el logo de mentira.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe.skipIf(!hasDb)("importar colecciones, menú y diseño desde Shopify", () => {
  it("crea las colecciones con sus productos en orden, y el menú traducido a la vitrina", async () => {
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [
      product("placa-01", "Placa 01"),
      product("placa-02", "Placa 02"),
      product("esmalte-01", "Esmalte 01"),
    ]);

    const result = await importShopifyCollections(brand.id, {
      collections: [
        {
          handle: "placas",
          name: "Placas",
          description: "Placas de stamping",
          imageUrl: "https://cdn.shopify.com/c.jpg",
          sortOrder: "PRICE_ASC",
          productHandles: ["placa-02", "placa-01", "no-existe"],
        },
        { handle: "esmaltes", name: "Esmaltes", productHandles: ["esmalte-01"] },
      ],
      menu: {
        links: [
          { label: "Inicio", href: "/" },
          { label: "Placas", href: "/collections/placas" },
          { label: "Contacto", href: "/pages/contacto" },
          { label: "Placa 1", href: "/products/placa-01" },
          { label: "Placas otra vez", href: "/collections/placas" },
        ],
        replace: true,
      },
    });

    expect(result.collections).toEqual([
      { handle: "placas", name: "Placas", slug: "placas", action: "created", linked: 2, missing: 1 },
      { handle: "esmaltes", name: "Esmaltes", slug: "esmaltes", action: "created", linked: 1, missing: 0 },
    ]);
    const placas = await prisma.brandCollection.findUniqueOrThrow({
      where: { brandId_slug: { brandId: brand.id, slug: "placas" } },
      include: { products: { orderBy: { position: "asc" }, include: { product: { select: { externalId: true } } } } },
    });
    expect(placas.description).toBe("Placas de stamping");
    expect(placas.imageUrl).toBe("https://cdn.shopify.com/c.jpg");
    expect(placas.sortOrder).toBe("PRICE_ASC");
    expect(placas.products.map((p) => p.product.externalId)).toEqual(["shopify-csv-placa-02", "shopify-csv-placa-01"]);

    expect(result.menu).toEqual({ items: 3, replaced: false });
    const menu = await prisma.storefrontMenuItem.findMany({ where: { brandId: brand.id }, orderBy: { position: "asc" } });
    expect(menu.map((m) => [m.label, m.url])).toEqual([
      ["Inicio", "/"],
      ["Placas", "/coleccion/placas"],
      ["Placa 1", "/placa-01"],
    ]);

    // Repetir no duplica: completa la colección, suma el producto nuevo al
    // final y reemplaza el menú.
    await importShopifyProducts(brand.id, [product("placa-03", "Placa 03")]);
    const again = await importShopifyCollections(brand.id, {
      collections: [{ handle: "placas", name: "Placas", productHandles: ["placa-02", "placa-01", "placa-03"] }],
      menu: { links: [{ label: "Solo placas", href: "/collections/placas" }], replace: true },
    });
    expect(again.collections[0]).toMatchObject({ action: "updated", slug: "placas", linked: 3, missing: 0 });
    expect(again.menu).toEqual({ items: 1, replaced: true });
    const placasAgain = await prisma.brandCollection.findUniqueOrThrow({
      where: { id: placas.id },
      include: { products: { orderBy: { position: "asc" }, include: { product: { select: { externalId: true } } } } },
    });
    expect(placasAgain.products.map((p) => p.product.externalId)).toEqual([
      "shopify-csv-placa-02",
      "shopify-csv-placa-01",
      "shopify-csv-placa-03",
    ]);
    expect(await prisma.brandCollection.count({ where: { brandId: brand.id } })).toBe(2);
    expect(await prisma.storefrontMenuItem.count({ where: { brandId: brand.id } })).toBe(1);
  });

  it("sin menú legible arma uno con las colecciones, y reconoce una colección creada por Tipo de producto", async () => {
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [{ ...product("placa-01", "Placa 01"), collectionName: "Placas Stamping" }]);
    const result = await importShopifyCollections(brand.id, {
      collections: [{ handle: "placas-stamping", name: "Placas Stamping", productHandles: ["placa-01"] }],
      menu: { links: [{ label: "Contacto", href: "/pages/contacto" }], replace: true },
    });
    expect(result.collections[0]).toMatchObject({ action: "updated", linked: 1 });
    expect(await prisma.brandCollection.count({ where: { brandId: brand.id } })).toBe(1);
    const menu = await prisma.storefrontMenuItem.findMany({ where: { brandId: brand.id } });
    expect(menu.map((m) => [m.label, m.url])).toEqual([["Placas Stamping", "/coleccion/placas-stamping"]]);
  });

  it("aplica colores y letra al tema (publicados) y sube el logo una sola vez", async () => {
    const brand = await createBrand();
    const calls: string[] = [];
    const fakeFetch = async (url: string) => {
      calls.push(url);
      return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
    };
    const colors = { fondo: "#faf6f3", texto: "#222222", botones: "#d1477b", principal: "#d1477b", secundario: "#f3ebe6" };

    const result = await applyShopifyDesign(
      brand.id,
      { colors, fonts: { headingFont: "Playfair Display", bodyFont: "Karla" }, logoUrl: "https://cdn.shopify.com/logo.png", faviconUrl: null },
      fakeFetch,
    );
    expect(result).toEqual({ colors: true, fonts: true, published: true, logo: "subido", favicon: "omitido" });
    const published = await getPublishedTheme(brand.id);
    expect(published.colors).toMatchObject({ ...colors, usarAcento: false });
    expect(published.typography).toEqual({ headingFont: "Playfair Display", bodyFont: "Karla" });
    const profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.logoUrl).toMatch(/^\/uploads\/marcas\/.+\/[a-f0-9]+\.png$/);
    expect(calls).toEqual(["https://cdn.shopify.com/logo.png"]);
    await rm(path.join(process.cwd(), "public", profile.logoUrl!), { force: true });

    // Segunda vez: el logo ya existe y no se toca; una letra desconocida
    // no se aplica; sin publicar solo cambia el borrador.
    const second = await applyShopifyDesign(
      brand.id,
      { colors: { ...colors, botones: "#000000" }, fonts: { headingFont: "Comic Sans", bodyFont: "Karla" }, logoUrl: "https://cdn.shopify.com/logo.png", publish: false },
      fakeFetch,
    );
    expect(second).toEqual({ colors: true, fonts: false, published: false, logo: "ya-tenia", favicon: "omitido" });
    expect((await getPublishedTheme(brand.id)).colors.botones).toBe("#d1477b");
    expect((await getDraftTheme(brand.id)).colors.botones).toBe("#000000");
    expect(calls).toHaveLength(1);
  });

  it("una imagen que no es imagen o apunta adentro de la red no se sube", async () => {
    const brand = await createBrand();
    const html = async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } });
    expect((await applyShopifyDesign(brand.id, { logoUrl: "https://cdn.shopify.com/logo.png" }, html)).logo).toBe("error");
    const never = async () => {
      throw new Error("no debería pedir nada");
    };
    expect((await applyShopifyDesign(brand.id, { logoUrl: "https://10.0.0.5/logo.png" }, never)).logo).toBe("error");
    expect((await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } })).logoUrl).toBeNull();
  });
});
