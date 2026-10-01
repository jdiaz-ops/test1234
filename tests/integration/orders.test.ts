import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus, refundStoreOrder } from "@/server/services/store-order-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

describe.skipIf(!hasDb)("pago aprobado e inventario", () => {
  it("descuenta el inventario una sola vez aunque el webhook y la consulta lleguen a la vez", async () => {
    const brand = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 10 });
    const esmalte = await createProduct(brand.id, {
      name: "Esmalte",
      price: 5000,
      stock: null,
      variants: [
        { label: "Plateado", stock: 4 },
        { label: "Dorado", stock: 2 },
      ],
    });
    const plateado = esmalte.variants.find((v) => v.option1Value === "Plateado")!;
    const order = await createPendingOrder(brand.id, [
      { productId: placa.id, quantity: 3, unitPrice: 15000 },
      { productId: esmalte.id, variantId: plateado.id, quantity: 1, unitPrice: 5000 },
    ]);

    await Promise.all([
      applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w1", wompiStatus: "APPROVED" }),
      applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w1", wompiStatus: "APPROVED" }),
      applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w1", wompiStatus: "APPROVED" }),
    ]);

    const after = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(7);
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: plateado.id } })).stock).toBe(3);
  });

  it("nunca deja el inventario en negativo", async () => {
    const brand = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 1 });
    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 3, unitPrice: 15000 }]);
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w2", wompiStatus: "APPROVED" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(0);
  });

  it("no toca productos sin control de inventario", async () => {
    const brand = await createBrand();
    const libre = await createProduct(brand.id, { name: "Sin control", price: 9000, stock: null });
    const order = await createPendingOrder(brand.id, [{ productId: libre.id, quantity: 2, unitPrice: 9000 }]);
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w3", wompiStatus: "APPROVED" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: libre.id } })).stock).toBeNull();
  });

  it("un pago rechazado no descuenta nada", async () => {
    const brand = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 2, unitPrice: 15000 }]);
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w4", wompiStatus: "DECLINED" });
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("FAILED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(5);
  });
});

describe.skipIf(!hasDb)("devoluciones", () => {
  it("repone el inventario y marca el pedido como devuelto una sola vez", async () => {
    const brand = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 10 });
    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 2, unitPrice: 15000 }]);
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w5", wompiStatus: "APPROVED" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(8);

    const refunded = await refundStoreOrder(brand.id, { orderId: order.id, reason: "Llegó roto", restock: true });
    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.refundReason).toBe("Llegó roto");
    expect(refunded.restocked).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(10);

    await expect(refundStoreOrder(brand.id, { orderId: order.id, restock: true })).rejects.toThrow(/ya tiene la devolución/);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(10);
  });

  it("sin reponer, el inventario queda igual", async () => {
    const brand = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 10 });
    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 2, unitPrice: 15000 }]);
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "w6", wompiStatus: "APPROVED" });
    await refundStoreOrder(brand.id, { orderId: order.id, restock: false });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(8);
  });

  it("no deja devolver un pedido sin pagar ni uno de otra marca", async () => {
    const brand = await createBrand();
    const other = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 10 });
    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 1, unitPrice: 15000 }]);
    await expect(refundStoreOrder(brand.id, { orderId: order.id, restock: true })).rejects.toThrow(/pagado/);
    await expect(refundStoreOrder(other.id, { orderId: order.id, restock: true })).rejects.toThrow(/no encontrado/);
  });
});

describe.skipIf(!hasDb)("archivar y eliminar pedidos", () => {
  it("archivar oculta sin tocar nada; eliminar solo borra lo que nunca fue una venta real", async () => {
    const { archiveStoreOrders, deleteStoreOrders, countOpenOrders } = await import("@/server/services/store-order-service");
    const brand = await createBrand();
    const product = await createProduct(brand.id, { name: "Placa", price: 10000, stock: 10 });
    const real = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 10000 }]);
    await prisma.storeOrder.update({ where: { id: real.id }, data: { status: "PAID", paymentMode: "PRODUCTION", paidAt: new Date() } });
    const testPaid = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 2, unitPrice: 10000 }]);
    await prisma.storeOrder.update({ where: { id: testPaid.id }, data: { status: "PAID", paidAt: new Date() } });
    await prisma.product.update({ where: { id: product.id }, data: { stock: 8 } }); // el pago de prueba descontó 2
    const abandoned = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 10000 }]);

    expect(await countOpenOrders(brand.id)).toBe(2);
    await archiveStoreOrders(brand.id, [real.id], true);
    expect(await countOpenOrders(brand.id)).toBe(1);
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: real.id } })).status).toBe("PAID");

    const result = await deleteStoreOrders(brand.id, [real.id, testPaid.id, abandoned.id]);
    expect(result).toEqual({ deleted: 2, skipped: 1 });
    expect(await prisma.storeOrder.findUnique({ where: { id: real.id } })).not.toBeNull();
    expect(await prisma.storeOrder.findUnique({ where: { id: testPaid.id } })).toBeNull();
    expect(await prisma.storeOrder.findUnique({ where: { id: abandoned.id } })).toBeNull();
    // La compra de prueba pagada devuelve su inventario.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10);
  });
});
