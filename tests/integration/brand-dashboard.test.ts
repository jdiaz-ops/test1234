import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOrderFromWebhook } from "@/server/services/attribution-service";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { getCreatorDashboardSummary } from "@/server/services/creator-finance-service";
import { payoutDateForSale } from "@/lib/payout-calendar";
import { createBrand, hasDb } from "./helpers";

/// Una venta de $5.400 con el código de una creadora al 8 % (el caso real
/// de Nail Fest en H la Cosedora, 2026-10-04).
async function saleWithCreatorCode() {
    await prisma.platformConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
    const config = await prisma.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
    const brand = await createBrand();
    const suffix = randomUUID().slice(0, 8);
    const user = await prisma.user.create({ data: { email: `creadora-${suffix}@prueba.test`, role: "CREATOR" } });
    const creator = await prisma.creatorProfile.create({
      data: { userId: user.id, displayName: "Nail Fest", baseCode: `NF${suffix}`, storefrontSlug: `nf-${suffix}` },
    });
    const offer = await prisma.offer.create({
      data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: 8, defaultDiscountPercent: 10 },
    });
    const code = `NAILFEST${suffix}`.toUpperCase();
    await prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId: offer.id, discountCode: code } });

    await recordOrderFromWebhook({
      brandId: brand.id,
      source: "MARCOLINI",
      externalOrderId: `pedido-${suffix}`,
      discountCode: code,
      grossAmount: 6000,
      discountAmount: 600,
      netAmount: 5400,
      occurredAt: new Date(),
      customerEmail: "compradora@prueba.test",
    });
    return { brand, creator, config };
}

describe.skipIf(!hasDb)("dashboards", () => {
  it("marca: cuenta las ventas con creadoras del mes y su costo aunque la comisión siga en espera", async () => {
    const { brand, config } = await saleWithCreatorCode();
    const summary = await getBrandDashboardSummary(brand.id);
    const fee = Math.round(5400 * Number(config.defaultPlatformFeePercent)) / 100;
    expect(summary.monthSales).toBe(5400);
    expect(summary.monthOrders).toBe(1);
    expect(summary.monthCreatorCommissions).toBe(432);
    expect(summary.monthPlatformFee).toBeCloseTo(fee + Math.round(fee * Number(config.vatPercent)) / 100, 2);
  });

  it("creadora: ve lo que lleva este mes, cuándo se le paga y la comisión queda para ese día", async () => {
    const { creator, config } = await saleWithCreatorCode();
    const summary = await getCreatorDashboardSummary(creator.id);
    expect(summary.thisMonthTotal).toBe(432);
    expect(summary.topBrands).toHaveLength(1);
    const payout = payoutDateForSale(new Date(), config.payoutDayOfMonth, config.refundHoldDays);
    expect(summary.thisMonthPayout).toEqual(payout);
    // La venta de hoy se paga el día de pago del mes siguiente, no antes.
    expect(summary.nextPayoutAmount).toBe(0);
    const commission = await prisma.commission.findFirstOrThrow({ where: { creatorProfileId: creator.id } });
    expect(commission.holdUntil).toEqual(payout);
  });
});
