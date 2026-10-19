import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getComplementaryProducts } from "@/server/services/store-order-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

/// Un pedido ya pagado con estos productos, de verdad o de prueba.
async function paidOrder(brandId: string, productIds: string[], paymentMode: "PRODUCTION" | "TEST" = "PRODUCTION") {
  const order = await createPendingOrder(
    brandId,
    productIds.map((productId) => ({ productId, unitPrice: 10000, quantity: 1 })),
  );
  await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paymentMode } });
}

describe.skipIf(!hasDb)("sugerencias del carrito", () => {
  it("'Otros clientes también compraron' sale solo de pedidos pagados de verdad, los más repetidos primero", async () => {
    const brand = await createBrand();
    const [a, b, c, d, e] = await Promise.all(
      ["A", "B", "C", "D", "E"].map((name) => createProduct(brand.id, { name, price: 10000, stock: 5 })),
    );
    await paidOrder(brand.id, [a.id, c.id]);
    await paidOrder(brand.id, [a.id, b.id]);
    await paidOrder(brand.id, [b.id, a.id]);
    // De prueba y sin pagar: no son clientes de verdad.
    await paidOrder(brand.id, [a.id, d.id], "TEST");
    await createPendingOrder(brand.id, [a, e].map((p) => ({ productId: p.id, unitPrice: 10000, quantity: 1 })));

    const result = await getComplementaryProducts(brand.id, [a.id]);
    expect(result.alsoBought).toBe(true);
    expect(result.products.map((p) => p.name)).toEqual(["B", "C"]);
  });

  it("sin ventas juntas cae a 'También te puede gustar' con otros de la tienda", async () => {
    const brand = await createBrand();
    const a = await createProduct(brand.id, { name: "A", price: 10000, stock: 5 });
    const b = await createProduct(brand.id, { name: "B", price: 10000, stock: 5 });
    await createPendingOrder(brand.id, [a, b].map((p) => ({ productId: p.id, unitPrice: 10000, quantity: 1 })));

    const result = await getComplementaryProducts(brand.id, [a.id]);
    expect(result.alsoBought).toBe(false);
    expect(result.products.map((p) => p.id)).toEqual([b.id]);
  });
});
