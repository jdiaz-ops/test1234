import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus, refundStoreOrder } from "@/server/services/store-order-service";
import { chargeBrandForPeriod } from "@/server/services/payment-service";
import { createPendingOrder, createProduct, createSellingBrand, hasDb } from "./helpers";

/// Pedido real (no de prueba de Wompi) de un producto de $20.000, con
/// envío de $8.000: la tarifa se calcula sobre los $20.000.
async function realOrder(brandId: string, productId: string, extra: Record<string, unknown> = {}) {
  const order = await createPendingOrder(brandId, [{ productId, quantity: 1, unitPrice: 20000 }]);
  return prisma.storeOrder.update({
    where: { id: order.id },
    data: { paymentMode: "PRODUCTION", shippingCents: 800_000, totalCents: 2_800_000, ...extra },
  });
}

async function config() {
  await prisma.platformConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  return prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
}

describe.skipIf(!hasDb)("tarifa de Marcolini sobre todas las ventas de la tienda", () => {
  it("una venta sin código paga la tarifa: el % sobre los productos (sin envío) más IVA", async () => {
    const cfg = await config();
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Placa", price: 20000, stock: 5 });
    const order = await realOrder(brand.id, product.id);

    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-fee", wompiStatus: "APPROVED" });

    const fee = await prisma.storeSaleFee.findUniqueOrThrow({ where: { orderId: order.id } });
    const pct = Number(cfg.defaultPlatformFeePercent);
    expect(Number(fee.baseAmount)).toBe(20000);
    expect(Number(fee.feePercent)).toBe(pct);
    expect(Number(fee.feeAmount)).toBe(Math.round(20000 * pct) / 100);
    expect(Number(fee.vatAmount)).toBeCloseTo((Number(fee.feeAmount) * Number(cfg.vatPercent)) / 100, 2);
    expect(fee.status).toBe("PENDING");
    expect(fee.brandChargeId).toBeNull();

    // Si Wompi avisa dos veces, sigue habiendo una sola tarifa.
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-fee", wompiStatus: "APPROVED" });
    expect(await prisma.storeSaleFee.count({ where: { orderId: order.id } })).toBe(1);
  });

  it("con código de creadora la tarifa va en la comisión: no se cobra dos veces", async () => {
    await config();
    const brand = await createSellingBrand();
    const suffix = randomUUID().slice(0, 8);
    const user = await prisma.user.create({ data: { email: `creadora-${suffix}@prueba.test`, role: "CREATOR" } });
    const creator = await prisma.creatorProfile.create({
      data: { userId: user.id, displayName: "Creadora", baseCode: `CR${suffix}`, storefrontSlug: `cr-${suffix}` },
    });
    const offer = await prisma.offer.create({
      data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: 8, defaultDiscountPercent: 10 },
    });
    const code = `CODIGO${suffix}`.toUpperCase();
    await prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId: offer.id, discountCode: code } });

    const product = await createProduct(brand.id, { name: "Placa", price: 20000, stock: 5 });
    const order = await realOrder(brand.id, product.id, { discountCode: code, discountCents: 200_000, totalCents: 2_600_000 });
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-code", wompiStatus: "APPROVED" });

    const paid = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id }, include: { saleFee: true } });
    expect(paid.transactionId).not.toBeNull();
    expect(paid.saleFee).toBeNull();
    const commission = await prisma.commission.findUniqueOrThrow({ where: { transactionId: paid.transactionId! } });
    expect(Number(commission.platformFeeAmount)).toBeGreaterThan(0);
  });

  it("una compra de prueba de Wompi no paga tarifa", async () => {
    await config();
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Placa", price: 20000, stock: 5 });
    // createPendingOrder deja el pedido en modo de prueba.
    const order = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 20000 }]);
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-test", wompiStatus: "APPROVED" });
    expect(await prisma.storeSaleFee.findUnique({ where: { orderId: order.id } })).toBeNull();
  });

  it("si la venta se devuelve antes del corte la tarifa se anula, y el corte del día 1 cobra la que sigue en pie", async () => {
    await config();
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Placa", price: 20000, stock: 5 });
    const kept = await realOrder(brand.id, product.id);
    const returned = await realOrder(brand.id, product.id);
    for (const o of [kept, returned]) {
      await applyWompiTransactionStatus({ reference: o.reference, wompiTransactionId: `tx-${o.id}`, wompiStatus: "APPROVED" });
    }

    await refundStoreOrder(brand.id, { orderId: returned.id, restock: false });
    expect((await prisma.storeSaleFee.findUniqueOrThrow({ where: { orderId: returned.id } })).status).toBe("REVERSED");

    const result = await chargeBrandForPeriod(brand.id);
    expect(result).not.toBeNull();
    const fee = await prisma.storeSaleFee.findUniqueOrThrow({ where: { orderId: kept.id } });
    expect(fee.brandChargeId).toBe(result!.charge.id);
    expect(result!.totalAmount).toBeCloseTo(Number(fee.feeAmount) + Number(fee.vatAmount), 2);
    // La anulada no entró al corte.
    expect((await prisma.storeSaleFee.findUniqueOrThrow({ where: { orderId: returned.id } })).brandChargeId).toBeNull();
  });
});
