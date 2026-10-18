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
    expect(result).toEqual({ colors: true, fonts: true, announcements: false, published: true, logo: "subido", favicon: "omitido", profileFields: [] });
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
    expect(second).toEqual({ colors: true, fonts: false, announcements: false, published: false, logo: "ya-tenia", favicon: "omitido", profileFields: [] });
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

describe.skipIf(!hasDb)("fotos alojadas en Marcolini, zonas de envío y datos de la marca", () => {
  it("copia las fotos externas de productos y colecciones y deja las URLs nuestras", async () => {
    const { countExternalImages, rehostImages, isExternalImageUrl } = await import("@/server/services/image-rehost-service");
    expect(isExternalImageUrl("https://cdn.shopify.com/s/files/a.png")).toBe(true);
    expect(isExternalImageUrl("https://abc.public.blob.vercel-storage.com/x.webp")).toBe(false);
    expect(isExternalImageUrl("/uploads/marcas/x/foto.webp")).toBe(false);
    expect(isExternalImageUrl(null)).toBe(false);

    const brand = await createBrand();
    await importShopifyProducts(brand.id, [
      { ...product("foto-01", "Foto 01"), images: ["https://cdn.shopify.com/s/files/a.png", "https://cdn.shopify.com/s/files/b.png"] },
    ]);
    await importShopifyCollections(brand.id, {
      collections: [{ handle: "con-foto", name: "Con foto", imageUrl: "https://cdn.shopify.com/s/files/c.png", productHandles: ["foto-01"] }],
    });
    expect(await countExternalImages(brand.id)).toEqual({ total: 3 });

    const fakeFetch = async (url: string) =>
      url.endsWith("b.png")
        ? new Response("no", { status: 404 })
        : new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
    const result = await rehostImages(brand.id, { limit: 10 }, fakeFetch);
    expect(result.saved.map((s) => s.url)).toEqual(["https://cdn.shopify.com/s/files/a.png", "https://cdn.shopify.com/s/files/c.png"]);
    expect(result.failed).toEqual([{ url: "https://cdn.shopify.com/s/files/b.png", error: "La imagen respondió 404." }]);
    expect(result.remaining).toBe(0);

    const saved = await prisma.product.findFirstOrThrow({
      where: { brandId: brand.id },
      include: { images: { orderBy: { position: "asc" } } },
    });
    expect(saved.imageUrl).toMatch(/^\/uploads\/marcas\/.+\/fotos\/[a-f0-9]+\.webp$/);
    expect(saved.images.map((i) => i.url)).toEqual([saved.imageUrl, "https://cdn.shopify.com/s/files/b.png"]);
    const collection = await prisma.brandCollection.findFirstOrThrow({ where: { brandId: brand.id } });
    expect(collection.imageUrl).toMatch(/^\/uploads\/marcas\//);
    // La que falló sigue contando como externa si no se la salta.
    expect(await countExternalImages(brand.id)).toEqual({ total: 1 });
    expect(await countExternalImages(brand.id, ["https://cdn.shopify.com/s/files/b.png"])).toEqual({ total: 0 });
    for (const url of [saved.imageUrl!, collection.imageUrl!]) await rm(path.join(process.cwd(), "public", url), { force: true });
  });

  it("crea las zonas de envío leídas de Shopify y reemplaza las anteriores", async () => {
    const { importShopifyShippingZones } = await import("@/server/services/shopify-shipping-import-service");
    const { listShippingZones } = await import("@/server/services/shipping-zone-service");
    const brand = await createBrand();
    const zones = [
      {
        name: "Bogotá D.C. y Cundinamarca",
        regions: ["Bogotá D.C.", "Cundinamarca"],
        rates: [
          { name: "Envío Bogotá", price: 8000, condition: "NONE" as const },
          { name: "Envío gratis", price: 0, condition: "MIN_ORDER_AMOUNT" as const, conditionValue: 180000 },
        ],
        otherRates: [],
      },
      { name: "Resto de Colombia", regions: ["*"], rates: [{ name: "Nacional", price: 15000, condition: "NONE" as const }], otherRates: [] },
    ];
    const first = await importShopifyShippingZones(brand.id, zones, { replace: true });
    expect(first).toEqual({ zones: [{ name: "Bogotá D.C. y Cundinamarca", action: "created", regions: 2 }, { name: "Resto de Colombia", action: "created", regions: 1 }], removed: 0 });
    const stored = await listShippingZones(brand.id);
    expect(stored.map((z) => z.name)).toEqual(["Bogotá D.C. y Cundinamarca", "Resto de Colombia"]);
    expect(stored[0].rates.map((r) => [r.name, Number(r.price), r.condition, r.conditionValue ? Number(r.conditionValue) : null])).toEqual([
      ["Envío Bogotá", 8000, "NONE", null],
      ["Envío gratis", 0, "MIN_ORDER_AMOUNT", 180000],
    ]);
    const second = await importShopifyShippingZones(brand.id, zones.slice(1), { replace: true });
    expect(second.removed).toBe(2);
    expect((await listShippingZones(brand.id)).map((z) => z.name)).toEqual(["Resto de Colombia"]);
    await expect(importShopifyShippingZones(brand.id, [{ ...zones[0], regions: ["Marte"] }], { replace: false })).resolves.toMatchObject({
      zones: [{ action: "error" }],
    });
  });

  it("llena píxeles, redes, teléfono y barra de anuncio solo cuando están vacíos", async () => {
    const brand = await createBrand();
    const never = async () => {
      throw new Error("no debería pedir nada");
    };
    const first = await applyShopifyDesign(
      brand.id,
      {
        pixels: { metaPixelId: "222817361457636", tiktokPixelId: "CABC123DEF456" },
        social: { instagram: "@beauty", whatsapp: "573001234567", phone: "601 234 5678" },
        announcements: ["Envío gratis desde $150.000", "   "],
      },
      never,
    );
    expect(first).toMatchObject({ colors: false, fonts: false, announcements: true, published: true, profileFields: ["metaPixelId", "tiktokPixelId", "instagramHandle", "phone"] });
    const profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile).toMatchObject({ metaPixelId: "222817361457636", tiktokPixelId: "CABC123DEF456", instagramHandle: "beauty", tiktokHandle: null, phone: "+573001234567" });
    expect((await getPublishedTheme(brand.id)).announcementBar).toMatchObject({ enabled: true, messages: [{ text: "Envío gratis desde $150.000", link: "" }] });

    const second = await applyShopifyDesign(
      brand.id,
      { pixels: { metaPixelId: "999999999" }, social: { instagram: "otra", tiktok: "tt" }, announcements: ["Otro texto"] },
      never,
    );
    expect(second).toMatchObject({ announcements: false, published: false, profileFields: ["tiktokHandle"] });
    const again = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(again).toMatchObject({ metaPixelId: "222817361457636", instagramHandle: "beauty", tiktokHandle: "tt" });
  });
});
