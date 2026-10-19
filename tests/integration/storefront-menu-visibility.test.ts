import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listStorefrontMenuForShoppers, productSlugOf, collectionSlugOf } from "@/server/services/storefront-menu-service";
import { createBrand, createProduct, hasDb } from "./helpers";

describe("menú del comprador sin agotados", () => {
  it("reconoce qué link es un producto y cuál una colección", () => {
    expect(productSlugOf("/gel-polish-rojo")).toBe("gel-polish-rojo");
    expect(productSlugOf("/coleccion")).toBeNull();
    expect(productSlugOf("/coleccion/esmaltes")).toBeNull();
    expect(productSlugOf("/pagina/contacto")).toBeNull();
    expect(productSlugOf("/")).toBeNull();
    expect(productSlugOf("https://instagram.com/x")).toBeNull();
    expect(collectionSlugOf("/coleccion/esmaltes")).toBe("esmaltes");
    expect(collectionSlugOf("/coleccion")).toBeNull();
  });

  it.skipIf(!hasDb)("esconde productos agotados o despublicados y colecciones sin productos disponibles; respeta 'mostrar agotados'", async () => {
    const brand = await createBrand();
    const enStock = await createProduct(brand.id, { name: "Con stock", price: 1, stock: 5 });
    const agotado = await createProduct(brand.id, { name: "Agotado", price: 1, stock: 0 });
    const borrador = await createProduct(brand.id, { name: "Borrador", price: 1, stock: 5 });
    await prisma.product.update({ where: { id: borrador.id }, data: { status: "DRAFT", available: false } });
    const conStock = await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Con stock", slug: "con-stock", products: { create: { productId: enStock.id, position: 0 } } } });
    const agotada = await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Agotada", slug: "agotada", products: { create: { productId: agotado.id, position: 0 } } } });
    await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Vacía", slug: "vacia" } });
    void conStock;
    void agotada;

    const row = (label: string, url: string, position: number, parentId: string | null = null) =>
      prisma.storefrontMenuItem.create({ data: { brandId: brand.id, label, url, position, parentId } });
    await row("Inicio", "/", 0);
    await row("Producto con stock", `/${enStock.slug}`, 1);
    await row("Producto agotado", `/${agotado.slug}`, 2);
    await row("Borrador", `/${borrador.slug}`, 3);
    await row("Colección con stock", "/coleccion/con-stock", 4);
    await row("Colección agotada", "/coleccion/agotada", 5);
    await row("Vacía", "/coleccion/vacia", 6);
    await row("Todas", "/coleccion", 7);
    await row("Slug viejo", "/producto-que-ya-no-existe", 8);
    const soloAgotados = await row("Solo agotados", "#", 9);
    await row("Agotado hijo", `/${agotado.slug}`, 0, soloAgotados.id);
    const mixto = await row("Mixto", "#", 10);
    await row("Hijo con stock", `/${enStock.slug}`, 0, mixto.id);
    await row("Hijo agotado", `/${agotado.slug}`, 1, mixto.id);
    const padreAgotado = await row("Colección agotada con hijos", "/coleccion/agotada", 11);
    await row("Hijo vivo", `/${enStock.slug}`, 0, padreAgotado.id);

    const shape = (nodes: Awaited<ReturnType<typeof listStorefrontMenuForShoppers>>): unknown[] =>
      nodes.map((n) => [n.label, n.url, shape(n.children)]);

    expect(shape(await listStorefrontMenuForShoppers(brand.id, { showSoldOut: false }))).toEqual([
      ["Inicio", "/", []],
      ["Producto con stock", `/${enStock.slug}`, []],
      ["Colección con stock", "/coleccion/con-stock", []],
      ["Todas", "/coleccion", []],
      ["Slug viejo", "/producto-que-ya-no-existe", []],
      ["Mixto", "#", [["Hijo con stock", `/${enStock.slug}`, []]]],
      ["Colección agotada con hijos", "#", [["Hijo vivo", `/${enStock.slug}`, []]]],
    ]);

    // Mostrando agotados: vuelven el producto y la colección agotados; el
    // borrador y la colección vacía siguen escondidos.
    expect(shape(await listStorefrontMenuForShoppers(brand.id, { showSoldOut: true })).map((n) => (n as unknown[])[0])).toEqual([
      "Inicio",
      "Producto con stock",
      "Producto agotado",
      "Colección con stock",
      "Colección agotada",
      "Todas",
      "Slug viejo",
      "Solo agotados",
      "Mixto",
      "Colección agotada con hijos",
    ]);

    // Sin opción, usa lo que diga el tema (por defecto esconde agotados).
    expect((await listStorefrontMenuForShoppers(brand.id)).map((n) => n.label)).not.toContain("Producto agotado");
  });
});
