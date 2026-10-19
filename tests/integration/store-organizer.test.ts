import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyStoreOrganizer,
  lastOrganizerRun,
  previewStoreOrganizer,
  reorderStoreByDemand,
  undoStoreOrganizer,
} from "@/server/services/store-organizer-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

/// Sin ANTHROPIC_API_KEY el plan sale por reglas — es lo que se prueba acá
/// (la IA se prueba aparte, contra la tienda real).
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

    const summary = await applyStoreOrganizer(brand.id, plan);
    expect(summary).toMatchObject({ source: "reglas", collections: { created: 2, updated: 1, removed: 3 }, products: { placed: 7 }, menu: 5 });
    expect(summary.products.renamed).toBeGreaterThan(0);
    expect(summary.home).toBeGreaterThanOrEqual(4);

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
    expect(sections.map((s) => s.type)).toEqual(["BANNER", "CATEGORY_GRID", "FEATURED_PRODUCTS", "SHIPPING_INFO_BANNERS", "PRODUCT_CATALOG"]);
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
    expect(undone.restored).toEqual({ collections: 4, menu: 1, sections: 1, products: 7 });
    const restored = await prisma.brandCollection.findMany({ where: { brandId: brand.id }, orderBy: { position: "asc" }, select: { name: true } });
    expect(restored.map((c) => c.name).sort()).toEqual(["Herramientas", "Semi Azules", "Semi Nude", "Semi Rojos"]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: products["PUSHER METALICO"].id } })).name).toBe("PUSHER METALICO");
    expect(await prisma.storefrontRedirect.count({ where: { brandId: brand.id } })).toBe(0);
    expect((await prisma.storefrontSection.findMany({ where: { brandId: brand.id } })).map((s) => s.type)).toEqual(["TEXT"]);
    expect((await lastOrganizerRun(brand.id))?.status).toBe("REVERTED");
  });
});
