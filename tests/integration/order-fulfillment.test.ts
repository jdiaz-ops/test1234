import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateOrderFulfillment } from "@/server/services/store-order-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

describe.skipIf(!hasDb)("estado de preparación", () => {
  // El cambio rápido desde la lista de Pedidos no manda transportadora ni
  // guía: no puede borrar las que ya tenía (2026-10-19).
  it("sin transportadora ni guía se conservan; vacías se borran", async () => {
    const brand = await createBrand();
    const product = await createProduct(brand.id, { name: "Placa", price: 20000, stock: 5 });
    const order = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 20000 }]);
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID" } });

    await updateOrderFulfillment(brand.id, { orderId: order.id, fulfillmentStatus: "SHIPPED", carrier: "Servientrega", trackingNumber: "123" });
    let saved = await updateOrderFulfillment(brand.id, { orderId: order.id, fulfillmentStatus: "DELIVERED" });
    expect(saved).toMatchObject({ fulfillmentStatus: "DELIVERED", carrier: "Servientrega", trackingNumber: "123" });
    expect(saved.deliveredAt).not.toBeNull();

    saved = await updateOrderFulfillment(brand.id, { orderId: order.id, fulfillmentStatus: "DELIVERED", carrier: "", trackingNumber: "" });
    expect(saved).toMatchObject({ carrier: null, trackingNumber: null });
  });
});
