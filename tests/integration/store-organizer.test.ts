import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyBanner } from "@/lib/banner-image";
import { getDraftTheme, getPublishedTheme } from "@/server/services/brand-theme-store";
import {
  applyStoreOrganizer,
  lastOrganizerRun,
  previewStoreOrganizer,
  reorderStoreByDemand,
  undoStoreOrganizer,
} from "@/server/services/store-organizer-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

/// Sin ANTHROPIC_API_KEY el plan sale por reglas — es lo que se prueba acá
/// (la IA se prueba aparte, contra la tienda real). El banner de la
/// portada se firma con AUTH_SECRET.
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "secreto-de-prueba";

describe.skipIf(!hasDb)("organizador automático de tienda", () => {
  it("arma el plan, lo aplica, reordena con las ventas y se puede deshacer", async () => {
    const brand = await createBrand();
    const names = [
      "ESMALTE SEMIPERMANENTE ROJO",
      "ESMALTE SEMIPERMANENTE AZUL",
      "ESMALTE SEMIPERMANENTE NUDE",
      "LIMA 180/240",
      "PUSHER METALICO",
      "PINCEL DE PELO FINO",
      "KIT DE INICIO",
    ];
    const products: Record<string, Awaited<ReturnType<typeof createProduct>>> = {};
    for (const name of names) products[name] = await createProduct(brand.id, { name, price: 20000, stock: 5 });
    // Fotos en algunos (la colección toma la de su mejor producto).
    for (const name of ["ESMALTE SEMIPERMANENTE ROJO", "ESMALTE SEMIPERMANENTE AZUL", "LIMA 180/240"]) {
      await prisma.product.update({ where: { id: products[name].id }, data: { imageUrl: `https://fotos.test/${products[name].id}.jpg` } });
    }
    // Uno agotado y uno en borrador.
    await prisma.product.update({ where: { id: products["ESMALTE SEMIPERMANENTE NUDE"].id }, data: { stock: 0 } });
    await prisma.product.update({ where: { id: products["KIT DE INICIO"].id }, data: { status: "DRAFT", available: false } });

    // Colecciones a lo Rumi: una por tono, con un producto cada una, y una repetida.
    const mk = (name: string, slug: string, ids: string[]) =>
      prisma.brandCollection.create({
        data: { brandId: brand.id, name, slug, products: { create: ids.map((productId, position) => ({ productId, position })) } },
      });
    await mk("Semi Rojos", "semi-rojos", [products["ESMALTE SEMIPERMANENTE ROJO"].id]);
    await mk("Semi Azules", "semi-azules", [products["ESMALTE SEMIPERMANENTE AZUL"].id]);
    await mk("Semi Nude", "semi-nude", [products["ESMALTE SEMIPERMANENTE NUDE"].id]);
    await mk("Herramientas", "herramientas", [products["LIMA 180/240"].id, products["PUSHER METALICO"].id]);
    await prisma.storefrontMenuItem.create({ data: { brandId: brand.id, label: "Semi Rojos", url: "/coleccion/semi-rojos", position: 0 } });
    await prisma.storefrontSection.create({ data: { brandId: brand.id, type: "TEXT", config: { heading: "Hola", body: "x" }, position: 0 } });
    // Banners promocionales importados con foto: se conservan.
    const promo = await prisma.storefrontSection.create({
      data: {
        brandId: brand.id,
        type: "PROMO_BANNERS",
        position: 1,
        config: { extendFullWidth: false, items: [{ show: true, imageUrl: "https://fotos.test/promo.jpg", link: "" }, { show: false, imageUrl: null, link: "" }, { show: false, imageUrl: null, link: "" }] },
      },
    });

    // Ventas: el azul vende más que el rojo.
    const order = await createPendingOrder(brand.id, [
      { productId: products["ESMALTE SEMIPERMANENTE AZUL"].id, quantity: 5, unitPrice: 20000 },
      { productId: products["ESMALTE SEMIPERMANENTE ROJO"].id, quantity: 1, unitPrice: 20000 },
    ]);
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });

    const plan = await previewStoreOrganizer(brand.id);
    expect(plan.source).toBe("reglas");
    // Sin IA, las tres colecciones de un tono se disuelven y los esmaltes
    // se agrupan por las palabras del nicho.
    expect(plan.collections.map((c) => c.name)).toEqual(["Esmaltes", "Herramientas", "Otros productos"]);
    const semi = plan.collections[0];
    expect(semi.productIds).toEqual([
      products["ESMALTE SEMIPERMANENTE AZUL"].id,
      products["ESMALTE SEMIPERMANENTE ROJO"].id,
      products["ESMALTE SEMIPERMANENTE NUDE"].id,
    ]);
    expect(plan.collections[1].existingId).not.toBeNull();
    expect(plan.removedCollections.map((r) => [r.name, r.movedTo]).sort()).toEqual([
      ["Semi Azules", "Esmaltes"],
      ["Semi Nude", "Esmaltes"],
      ["Semi Rojos", "Esmaltes"],
    ]);
    expect(plan.productNames.find((n) => n.from === "PUSHER METALICO")?.to).toBe("Pusher metalico");
    expect(plan.menu.map((m) => m.label)).toEqual(["Inicio", "Esmaltes", "Herramientas", "Otros productos", "Todos los productos"]);
    expect(plan.stats).toMatchObject({ products: 7, active: 6, soldOut: 1, withSales: 2, collectionsBefore: 4, collectionsAfter: 3 });
    // Ajustes por reglas: la tienda lleva inventario y no tiene páginas ni
    // sellos propios.
    expect(plan.settings).toEqual({ purchaseInfo: true, lowStock: true, cartSuggestions: true, footerContact: true, footerPages: false, about: null });
    expect(plan.productDescriptions).toEqual([]);
    expect(plan.collectionBanners).toBe(true);
    expect(plan.home.map((s) => (s.type === "KEEP" ? `KEEP:${s.sectionId === promo.id ? "promo" : s.sectionId}` : s.type))).toEqual([
      "BANNER",
      "CATEGORY_GRID",
      "FEATURED_PRODUCTS",
      "KEEP:promo",
      "SHIPPING_INFO_BANNERS",
      "PRODUCT_CATALOG",
    ]);

    // La frase de la barra, el "Nosotros" y las fichas los escribe la IA;
    // acá se simulan.
    const azul = products["ESMALTE SEMIPERMANENTE AZUL"].id;
    const summary = await applyStoreOrganizer(brand.id, {
      ...plan,
      announcement: "Asesoría por WhatsApp antes de comprar",
      settings: { ...plan.settings, about: { title: "Nosotros", description: "Tienda de esmaltes y herramientas para manicuristas." } },
      productDescriptions: [{ id: azul, html: "<p>Color intenso que dura semanas.</p><ul><li>Cubre en dos capas</li></ul><script>alert(1)</script>", summary: "Color intenso que dura semanas." }],
    });
    expect(summary).toMatchObject({
      source: "reglas",
      collections: { created: 2, updated: 1, removed: 3 },
      products: { placed: 7 },
      menu: 5,
      home: 6,
      kept: 1,
      banners: 1,
      announcement: true,
      descriptions: 1,
      collectionBanners: 2,
    });
    expect(summary.settings).toEqual(
      expect.arrayContaining(["sellos de confianza en la ficha", "aviso de últimas unidades", "sugerencias en el carrito", "\"Nosotros\" en el pie de página"]),
    );
    expect(summary.products.renamed).toBeGreaterThan(0);

    // La ficha entra saneada; las colecciones principales con foto reciben
    // su banner en los dos formatos; el tema queda con los ajustes.
    const azulAfter = await prisma.product.findUniqueOrThrow({ where: { id: azul }, select: { description: true } });
    expect(azulAfter.description).toContain("<li>Cubre en dos capas</li>");
    expect(azulAfter.description).not.toContain("script");
    const esmaltes = await prisma.brandCollection.findFirstOrThrow({ where: { brandId: brand.id, slug: "esmaltes" } });
    const collectionWide = new URL(esmaltes.bannerUrl!, "https://tienda.test").searchParams;
    expect(verifyBanner(collectionWide.get("s")!, collectionWide.get("sig")!)).toMatchObject({ layout: "wide", title: "Esmaltes", cta: "", image: `https://fotos.test/${azul}.jpg` });
    const collectionMobile = new URL(esmaltes.bannerMobileUrl!, "https://tienda.test").searchParams;
    expect(verifyBanner(collectionMobile.get("s")!, collectionMobile.get("sig")!)).toMatchObject({ layout: "mobile", title: "Esmaltes" });
    expect((await prisma.brandCollection.findFirstOrThrow({ where: { brandId: brand.id, slug: "otros-productos" } })).bannerUrl).toBeNull();
    const themeAfter = await getPublishedTheme(brand.id);
    expect(themeAfter.productDetail.purchaseInfo[0]).toMatchObject({ show: true, icon: "SHIPPING", title: "Envíos a todo el país" });
    expect(themeAfter.productDetail.lowStock).toMatchObject({ enabled: true, threshold: 3 });
    expect(themeAfter.cart.suggestComplementary).toBe(true);
    expect(themeAfter.footer.contact.show).toBe(true);
    expect(themeAfter.footer.aboutUs).toMatchObject({ show: true, title: "Nosotros" });

    const collections = await prisma.brandCollection.findMany({
      where: { brandId: brand.id },
      orderBy: { position: "asc" },
      include: { products: { orderBy: { position: "asc" }, include: { product: { select: { name: true } } } } },
    });
    expect(collections.map((c) => [c.name, c.slug, c.products.length])).toEqual([
      ["Esmaltes", "esmaltes", 3],
      ["Herramientas", "herramientas", 3],
      ["Otros productos", "otros-productos", 1],
    ]);
    expect(collections[0].products.map((p) => p.product.name)).toEqual([
      "Esmalte semipermanente azul",
      "Esmalte semipermanente rojo",
      "Esmalte semipermanente nude",
    ]);
    const redirect = await prisma.storefrontRedirect.findFirst({ where: { brandId: brand.id, fromPath: "/coleccion/semi-rojos" } });
    expect(redirect?.toPath).toBe("/coleccion/esmaltes");
    const menu = await prisma.storefrontMenuItem.findMany({ where: { brandId: brand.id, parentId: null }, orderBy: { position: "asc" } });
    expect(menu.map((m) => m.url)).toEqual(["/", "/coleccion/esmaltes", "/coleccion/herramientas", "/coleccion/otros-productos", "/coleccion"]);
    const sections = await prisma.storefrontSection.findMany({ where: { brandId: brand.id }, orderBy: { position: "asc" } });
    expect(sections.map((s) => s.type)).toEqual(["BANNER", "CATEGORY_GRID", "FEATURED_PRODUCTS", "PROMO_BANNERS", "SHIPPING_INFO_BANNERS", "PRODUCT_CATALOG"]);
    // Los promocionales son la misma sección de antes (conservada, no copiada).
    expect(sections[3].id).toBe(promo.id);
    // El banner lo pinta /api/banner con el estilo de la tienda: la receta
    // va firmada en la URL y los textos dentro de la imagen.
    const banner = sections[0].config as { aspectRatio: string; slides: { imageUrl: string; mobileImageUrl: string; link: string }[]; title: string };
    expect(banner.aspectRatio).toBe("original");
    expect(banner.title).toBe("");
    expect(banner.slides[0].link).toBe("/coleccion/esmaltes");
    const bannerParams = new URL(banner.slides[0].imageUrl, "https://tienda.test").searchParams;
    expect(banner.slides[0].imageUrl.startsWith("/api/banner?s=")).toBe(true);
    expect(verifyBanner(bannerParams.get("s")!, bannerParams.get("sig")!)).toMatchObject({
      layout: "wide",
      title: "Esmaltes",
      cta: "Ver esmaltes",
      image: `https://fotos.test/${products["ESMALTE SEMIPERMANENTE AZUL"].id}.jpg`,
      bg: "#ffffff",
      font: "Instrument Sans",
    });
    // Y la versión para celular, con la misma receta en formato cuadrado.
    const mobileParams = new URL(banner.slides[0].mobileImageUrl, "https://tienda.test").searchParams;
    expect(verifyBanner(mobileParams.get("s")!, mobileParams.get("sig")!)).toMatchObject({ layout: "mobile", title: "Esmaltes" });
    expect((await getPublishedTheme(brand.id)).announcementBar).toMatchObject({ enabled: true, messages: [{ text: "Asesoría por WhatsApp antes de comprar", link: "" }] });
    expect((await getDraftTheme(brand.id)).announcementBar.enabled).toBe(true);
    const featured = sections.find((s) => s.type === "FEATURED_PRODUCTS")!.config as { title: string; productIds: string[] };
    expect(featured.title).toBe("Los más vendidos");
    expect(featured.productIds[0]).toBe(products["ESMALTE SEMIPERMANENTE AZUL"].id);
    expect((await lastOrganizerRun(brand.id))?.status).toBe("APPLIED");

    // Más ventas del rojo: el reorden nocturno lo sube.
    const order2 = await createPendingOrder(brand.id, [{ productId: products["ESMALTE SEMIPERMANENTE ROJO"].id, quantity: 20, unitPrice: 20000 }]);
    await prisma.storeOrder.update({ where: { id: order2.id }, data: { status: "PAID", paidAt: new Date() } });
    const reorder = await reorderStoreByDemand(brand.id);
    expect(reorder.collections).toBe(1);
    expect(reorder.bestSellers).toBe(true);
    const semiAfter = await prisma.productBrandCollection.findMany({ where: { collectionId: collections[0].id }, orderBy: { position: "asc" } });
    expect(semiAfter[0].productId).toBe(products["ESMALTE SEMIPERMANENTE ROJO"].id);

    // Deshacer: vuelve todo como estaba.
    const undone = await undoStoreOrganizer(brand.id);
    expect(undone.restored).toEqual({ collections: 4, menu: 1, sections: 2, products: 7, descriptions: 1 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: azul }, select: { description: true } })).description).toBeNull();
    const themeBack = await getPublishedTheme(brand.id);
    expect(themeBack.productDetail.purchaseInfo.every((i) => !i.show)).toBe(true);
    expect(themeBack.productDetail.lowStock.enabled).toBe(false);
    expect(themeBack.cart.suggestComplementary).toBe(false);
    expect(themeBack.footer.aboutUs.show).toBe(false);
    const restored = await prisma.brandCollection.findMany({ where: { brandId: brand.id }, orderBy: { position: "asc" }, select: { name: true } });
    expect(restored.map((c) => c.name).sort()).toEqual(["Herramientas", "Semi Azules", "Semi Nude", "Semi Rojos"]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: products["PUSHER METALICO"].id } })).name).toBe("PUSHER METALICO");
    expect(await prisma.storefrontRedirect.count({ where: { brandId: brand.id } })).toBe(0);
    expect((await prisma.storefrontSection.findMany({ where: { brandId: brand.id }, orderBy: { position: "asc" } })).map((s) => s.type)).toEqual(["TEXT", "PROMO_BANNERS"]);
    expect((await getPublishedTheme(brand.id)).announcementBar).toMatchObject({ enabled: false, messages: [] });
    expect((await getDraftTheme(brand.id)).announcementBar).toMatchObject({ enabled: false, messages: [] });
    expect((await lastOrganizerRun(brand.id))?.status).toBe("REVERTED");
  });
});
