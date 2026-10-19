import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { brandDeletionPreview, BrandDeleteError, deleteBrandProfile } from "@/server/services/admin-brand-delete-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

/// Borrar una marca desde el admin: sin historial de plata se va todo lo
/// suyo (y solo lo suyo); con historial no se borra nada.
describe.skipIf(!hasDb)("borrar una marca", () => {
  it("borra la marca con su tienda, productos, pedidos sin pagar y cuenta, sin tocar otras marcas", async () => {
    const brand = await createBrand();
    const other = await createBrand();
    const product = await createProduct(brand.id, { name: "Esmalte rojo", price: 20000, stock: 5 });
    const otherProduct = await createProduct(other.id, { name: "Esmalte azul", price: 20000, stock: 5 });
    await prisma.brandCollection.create({
      data: { brandId: brand.id, name: "Esmaltes", slug: "esmaltes", products: { create: [{ productId: product.id, position: 0 }] } },
    });
    await prisma.storePage.create({ data: { brandId: brand.id, title: "Envíos", slug: "envios", body: "Despachamos a todo el país." } });
    await prisma.storefrontMenuItem.create({ data: { brandId: brand.id, label: "Esmaltes", url: "/coleccion/esmaltes", position: 0 } });
    // Un pedido de prueba (modo TEST) y uno que nunca se pagó: no son historial.
    await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 20000 }]);
    const unpaid = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 2, unitPrice: 20000 }]);
    await prisma.storeOrder.update({ where: { id: unpaid.id }, data: { paymentMode: "PRODUCTION", status: "EXPIRED" } });

    const preview = await brandDeletionPreview(brand.id);
    expect(preview.blockers).toEqual([]);
    expect(preview.willDelete).toEqual(
      expect.arrayContaining(["1 producto", "1 colección", "1 página", "2 pedidos sin pagar o de prueba", "la tienda, su diseño, el menú y la cuenta de la marca"]),
    );

    // El nombre tiene que coincidir.
    await expect(deleteBrandProfile(brand.id, "Otra marca")).rejects.toBeInstanceOf(BrandDeleteError);
    expect(await prisma.brandProfile.count({ where: { id: brand.id } })).toBe(1);

    // Mayúsculas y espacios de más no importan.
    const result = await deleteBrandProfile(brand.id, `  ${brand.companyName.toUpperCase()} `);
    expect(result.deleted).toBe(brand.companyName);
    expect(await prisma.brandProfile.count({ where: { id: brand.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: brand.userId } })).toBe(0);
    expect(await prisma.product.count({ where: { brandId: brand.id } })).toBe(0);
    expect(await prisma.storeOrder.count({ where: { brandId: brand.id } })).toBe(0);
    expect(await prisma.brandCollection.count({ where: { brandId: brand.id } })).toBe(0);
    expect(await prisma.storePage.count({ where: { brandId: brand.id } })).toBe(0);
    // La otra marca sigue intacta.
    expect(await prisma.brandProfile.count({ where: { id: other.id } })).toBe(1);
    expect(await prisma.product.count({ where: { id: otherProduct.id } })).toBe(1);
    await expect(brandDeletionPreview(brand.id)).rejects.toBeInstanceOf(BrandDeleteError);
  });

  it("no borra una marca con pedidos pagados", async () => {
    const brand = await createBrand();
    const product = await createProduct(brand.id, { name: "Lima", price: 10000, stock: 5 });
    const order = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 10000 }]);
    await prisma.storeOrder.update({ where: { id: order.id }, data: { paymentMode: "PRODUCTION", status: "PAID", paidAt: new Date() } });

    const preview = await brandDeletionPreview(brand.id);
    expect(preview.blockers).toEqual(["1 pedido pagado"]);
    await expect(deleteBrandProfile(brand.id, brand.companyName)).rejects.toThrow(/No se puede borrar: tiene 1 pedido pagado/);
    expect(await prisma.brandProfile.count({ where: { id: brand.id } })).toBe(1);
    expect(await prisma.storeOrder.count({ where: { id: order.id } })).toBe(1);
  });
});
