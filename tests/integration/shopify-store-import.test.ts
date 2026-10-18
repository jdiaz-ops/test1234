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
    expect(first).toEqual({
      zones: [{ name: "Bogotá D.C. y Cundinamarca", action: "created", regions: 2 }, { name: "Resto de Colombia", action: "created", regions: 1 }],
      removed: 0,
      pendingPrice: 0,
    });
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

describe.skipIf(!hasDb)("páginas, portada, fotos de variante y Google Analytics", () => {
  it("crea las páginas y políticas, deja las que ya existían y prende la columna del pie", async () => {
    const { importShopifyPages } = await import("@/server/services/shopify-pages-import-service");
    const { createStorePage, listStorePages } = await import("@/server/services/store-page-service");
    const brand = await createBrand();
    await createStorePage(brand.id, { title: "Contacto", body: "<p>Escríbenos</p>" });
    const result = await importShopifyPages(brand.id, [
      { handle: "contacto", title: "Contacto", body: "<p>Otro</p>", kind: "page" },
      { handle: "shipping-policy", title: "Política de envío", body: "<p>Enviamos</p><script>x</script>", kind: "policy" },
      { handle: "x", title: "Q", body: "", kind: "page" },
    ]);
    expect(result.pages).toEqual([
      { handle: "contacto", title: "Contacto", slug: "contacto", action: "existing" },
      { handle: "shipping-policy", title: "Política de envío", slug: "politica-de-envio", action: "created" },
      { handle: "x", title: "Q", slug: "", action: "error", error: "Ingresa un título para la página." },
    ]);
    expect(result.footerEnabled).toBe(true);
    const pages = await listStorePages(brand.id);
    expect(pages.map((p) => [p.slug, p.body])).toEqual([
      ["contacto", "<p>Escríbenos</p>"],
      ["politica-de-envio", "<p>Enviamos</p>"],
    ]);
    expect((await getPublishedTheme(brand.id)).footer.menuSecondary).toMatchObject({ show: true, title: "Información" });
    expect((await importShopifyPages(brand.id, [{ handle: "shipping-policy", title: "Política de envío", body: "<p>x</p>", kind: "policy" }])).footerEnabled).toBe(false);
  });

  it("arma la portada con las colecciones y productos importados y salta lo que no encuentra", async () => {
    const { importShopifySections } = await import("@/server/services/shopify-sections-import-service");
    const { listStorefrontSections, createStorefrontSection } = await import("@/server/services/storefront-section-service");
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [product("placa-01", "Placa 01")]);
    await importShopifyCollections(brand.id, { collections: [{ handle: "soft-gel", name: "Soft Gel", productHandles: ["placa-01"] }] });
    await createStorefrontSection(brand.id, { type: "TEXT", config: { heading: "Vieja", body: "" } });

    const result = await importShopifySections(brand.id, {
      sections: [
        { type: "BANNER", images: ["https://cdn.shopify.com/s/files/hero.jpg"], title: "Hola", subtitle: "Sub", buttonText: "Ver", buttonHref: "/collections/soft-gel", links: ["/collections/soft-gel"] },
        { type: "FEATURED_COLLECTION", collectionHandle: "soft-gel", title: "Lo mejor" },
        { type: "FEATURED_COLLECTION", collectionHandle: "no-existe", title: "" },
        { type: "FEATURED_PRODUCTS", productHandles: ["placa-01", "otro"], title: "" },
        { type: "CATEGORY_GRID", title: "Categorías", items: [{ collectionHandle: "soft-gel", imageUrl: null, label: "Soft Gel" }] },
        {
          type: "INFO_COLUMNS",
          items: [
            { title: "Envío gratis", description: "Desde $150.000" },
            { title: "", description: "", imageUrl: "https://rumicol.com/wp-content/uploads/contacto.jpg", link: "https://wa.link/abc" },
          ],
        },
      ],
      replace: true,
      collectionSlugByHandle: { "soft-gel": "soft-gel" },
    });
    expect(result.removed).toBe(1);
    expect(result.sections.map((s) => [s.type, s.action])).toEqual([
      ["BANNER", "created"],
      ["FEATURED_COLLECTION", "created"],
      ["FEATURED_COLLECTION", "skipped"],
      ["FEATURED_PRODUCTS", "created"],
      ["CATEGORY_GRID", "created"],
      ["SHIPPING_INFO_BANNERS", "created"],
    ]);
    const sections = await listStorefrontSections(brand.id);
    const collection = await prisma.brandCollection.findFirstOrThrow({ where: { brandId: brand.id } });
    const placa = await prisma.product.findFirstOrThrow({ where: { brandId: brand.id } });
    expect(sections.map((s) => s.type)).toEqual(["BANNER", "FEATURED_COLLECTION", "FEATURED_PRODUCTS", "CATEGORY_GRID", "SHIPPING_INFO_BANNERS"]);
    expect(sections[0].config).toMatchObject({ slides: [{ imageUrl: "https://cdn.shopify.com/s/files/hero.jpg", link: "/coleccion/soft-gel" }], title: "Hola", buttonLink: "/coleccion/soft-gel" });
    expect((sections[4].config as { items: { show: boolean; imageUrl: string | null; link: string }[] }).items.slice(0, 3)).toMatchObject([
      { show: true, imageUrl: null, link: "" },
      { show: true, imageUrl: "https://rumicol.com/wp-content/uploads/contacto.jpg", link: "https://wa.link/abc" },
      { show: false },
    ]);
    expect(sections[1].config).toMatchObject({ collectionId: collection.id, title: "Lo mejor" });
    expect(sections[2].config).toMatchObject({ productIds: [placa.id], title: "Destacados" });
    expect((sections[3].config as { items: { show: boolean; collectionId: string | null }[] }).items.map((i) => [i.show, i.collectionId])).toEqual([
      [true, collection.id],
      [false, null],
      [false, null],
      [false, null],
      [false, null],
      [false, null],
    ]);
  });

  it("sin secciones reconocidas arma la portada básica, y si ninguna muestra productos agrega el catálogo", async () => {
    const { importShopifySections } = await import("@/server/services/shopify-sections-import-service");
    const { completeHomeSections } = await import("@/server/services/storefront-default-home-service");
    const { listStorefrontSections } = await import("@/server/services/storefront-section-service");
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [product("a", "A"), product("b", "B"), product("c", "C"), product("d", "D")]);
    await importShopifyCollections(brand.id, {
      collections: [
        { handle: "decoracion", name: "Decoración", productHandles: ["d"] },
        { handle: "esmaltes", name: "Esmaltes", productHandles: ["a", "b", "c"] },
        { handle: "vacia", name: "Vacía", productHandles: [] },
      ],
    });
    const esmaltes = await prisma.brandCollection.findFirstOrThrow({ where: { brandId: brand.id, slug: "esmaltes" } });
    const deco = await prisma.brandCollection.findFirstOrThrow({ where: { brandId: brand.id, slug: "decoracion" } });

    // Nada reconocido (una tienda WooCommerce con portada ilegible):
    // categorías con productos (la más grande primero), novedades y catálogo.
    const empty = await importShopifySections(brand.id, { sections: [], replace: true, collectionSlugByHandle: {}, fillGaps: true });
    expect(empty.basic).toBe(3);
    expect(empty.sections.map((s) => [s.type, s.action])).toEqual([
      ["CATEGORY_GRID", "created"],
      ["NEW_PRODUCTS", "created"],
      ["PRODUCT_CATALOG", "created"],
    ]);
    const basic = await listStorefrontSections(brand.id);
    expect(basic.map((s) => s.type)).toEqual(["CATEGORY_GRID", "NEW_PRODUCTS", "PRODUCT_CATALOG"]);
    const grid = basic[0].config as { title: string; items: { show: boolean; collectionId: string | null }[] };
    expect(grid.title).toBe("Compra por categoría");
    expect(grid.items.map((i) => [i.show, i.collectionId])).toEqual([
      [true, esmaltes.id],
      [true, deco.id],
      [false, null],
      [false, null],
      [false, null],
      [false, null],
    ]);
    // Con la portada completa, el botón de Diseño no duplica nada.
    expect(await completeHomeSections(brand.id)).toEqual({ created: [], skipped: "COMPLETE" });

    // Solo un banner reconocido (no muestra productos): categorías,
    // novedades y catálogo van debajo del banner.
    const banner = { type: "BANNER" as const, images: ["https://rumicol.com/wp-content/uploads/hero.jpg"], title: "Hola", subtitle: "", buttonText: "", buttonHref: "" };
    const partial = await importShopifySections(brand.id, { sections: [banner], replace: true, collectionSlugByHandle: {}, fillGaps: true });
    expect(partial.removed).toBe(3);
    expect(partial.basic).toBe(3);
    expect((await listStorefrontSections(brand.id)).map((s) => s.type)).toEqual(["BANNER", "CATEGORY_GRID", "NEW_PRODUCTS", "PRODUCT_CATALOG"]);
    // El botón de Diseño con un banner suelto hace lo mismo.
    await prisma.storefrontSection.deleteMany({ where: { brandId: brand.id, type: { not: "BANNER" } } });
    expect((await completeHomeSections(brand.id)).created).toEqual(["CATEGORY_GRID", "NEW_PRODUCTS", "PRODUCT_CATALOG"]);

    // Una cuadrícula cuyos handles no calzan con nada se resuelve por el
    // nombre que mostraba la tienda vieja; ya muestra productos, así que
    // no se agrega nada más.
    const withGrid = await importShopifySections(brand.id, {
      sections: [
        banner,
        {
          type: "CATEGORY_GRID",
          title: "Categorías",
          items: [
            { collectionHandle: "esmaltes-semipermanentes", imageUrl: null, label: "Esmaltes" },
            { collectionHandle: "otra", imageUrl: null, label: "DECORACIÓN" },
            { collectionHandle: "nada", imageUrl: null, label: "No existe" },
          ],
        },
      ],
      replace: true,
      collectionSlugByHandle: {},
      fillGaps: true,
    });
    expect(withGrid.basic).toBe(0);
    const sections = await listStorefrontSections(brand.id);
    expect(sections.map((s) => s.type)).toEqual(["BANNER", "CATEGORY_GRID"]);
    const items = (sections[1].config as { items: { show: boolean; collectionId: string | null }[] }).items;
    expect(items.slice(0, 3).map((i) => [i.show, i.collectionId])).toEqual([
      [true, esmaltes.id],
      [true, deco.id],
      [false, null],
    ]);
  });

  it("las fotos de la portada y de las páginas también se copian a Marcolini", async () => {
    const { rehostImages, countExternalImages, imageUrlsInConfig } = await import("@/server/services/image-rehost-service");
    const { createStorefrontSection, listStorefrontSections } = await import("@/server/services/storefront-section-service");
    const { createStorePage, listStorePages } = await import("@/server/services/store-page-service");
    expect(imageUrlsInConfig({ slides: [{ imageUrl: "a" }], items: [{ imageUrl: "b", link: "c" }], images: ["d"], buttonLink: "e" })).toEqual(["a", "b", "d"]);
    const brand = await createBrand();
    await createStorefrontSection(brand.id, { type: "BANNER", config: { slides: [{ imageUrl: "https://cdn.shopify.com/s/files/hero.jpg", link: "" }] } });
    await createStorePage(brand.id, { title: "Nosotros", body: `<p>Hola</p><img src="https://cdn.shopify.com/s/files/equipo.jpg" alt="x">` });
    expect(await countExternalImages(brand.id)).toEqual({ total: 2 });
    const fakeFetch = async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
    const result = await rehostImages(brand.id, { limit: 10 }, fakeFetch);
    expect(result.saved).toHaveLength(2);
    expect(result.remaining).toBe(0);
    const [section] = await listStorefrontSections(brand.id);
    const [page] = await listStorePages(brand.id);
    const sectionUrl = (section.config as { slides: { imageUrl: string }[] }).slides[0].imageUrl;
    expect(sectionUrl).toMatch(/^\/uploads\/marcas\//);
    expect(page.body).toMatch(/<img src="\/uploads\/marcas\/[^"]+\.webp"/);
    for (const url of [sectionUrl, page.body.match(/src="([^"]+)"/)![1]]) await rm(path.join(process.cwd(), "public", url), { force: true });
  });

  it("guarda la foto de cada variante y la conserva cuando se vuelve a guardar sin ella", async () => {
    const { updateManualProduct } = await import("@/server/services/brand-store-product-service");
    const brand = await createBrand();
    const variant = (color: string, imageUrl?: string | null) => ({
      option1Value: color,
      option2Value: null,
      option3Value: null,
      price: 5000,
      sku: "",
      barcode: "",
      stock: 0,
      weight: null,
      weightUnit: "G" as const,
      ...(imageUrl === undefined ? {} : { imageUrl }),
    });
    await importShopifyProducts(brand.id, [
      { ...product("esmalte", "Esmalte"), price: 0, hasVariants: true, optionNames: ["Color"], variants: [variant("Rojo", "https://cdn.shopify.com/s/files/rojo.jpg"), variant("Azul", null)] },
    ]);
    const saved = await prisma.product.findFirstOrThrow({ where: { brandId: brand.id }, include: { variants: { orderBy: { position: "asc" } } } });
    expect(saved.variants.map((v) => v.imageUrl)).toEqual(["https://cdn.shopify.com/s/files/rojo.jpg", null]);
    // Editar el producto sin mandar fotos de variante (como hace el formulario) no las borra.
    await updateManualProduct(brand.id, saved.id, {
      name: "Esmalte",
      price: 0,
      slug: saved.slug!,
      hasVariants: true,
      optionNames: ["Color"],
      variants: [variant("Rojo"), variant("Azul")],
    });
    const again = await prisma.product.findFirstOrThrow({ where: { id: saved.id }, include: { variants: { orderBy: { position: "asc" } } } });
    expect(again.variants.map((v) => v.imageUrl)).toEqual(["https://cdn.shopify.com/s/files/rojo.jpg", null]);
  });

  it("guarda el ID de Google Analytics leído de la portada si estaba vacío", async () => {
    const brand = await createBrand();
    const never = async () => {
      throw new Error("no debería pedir nada");
    };
    const result = await applyShopifyDesign(brand.id, { pixels: { googleAnalyticsId: "g-abc123xyz" } }, never);
    expect(result.profileFields).toEqual(["googleAnalyticsId"]);
    expect((await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } })).googleAnalyticsId).toBe("G-ABC123XYZ");
    expect((await applyShopifyDesign(brand.id, { pixels: { googleAnalyticsId: "G-OTRO" } }, never)).profileFields).toEqual([]);
  });
});
