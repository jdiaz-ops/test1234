import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOrderFromWebhook } from "@/server/services/attribution-service";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { getCreatorDashboardSummary, payoutDateOnOrAfter } from "@/server/services/creator-finance-service";
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

  it("creadora: ve la comisión en espera y en qué pago le llega", async () => {
    const { creator, config } = await saleWithCreatorCode();
    const summary = await getCreatorDashboardSummary(creator.id);
    expect(summary.pendingTotal).toBe(432);
    expect(summary.approvedPendingPayout).toBe(0);
    expect(summary.topBrands).toHaveLength(1);
    expect(summary.pendingConfirmsAt).not.toBeNull();
    // Se confirma a los N días; si eso cae después del próximo pago, va al
    // siguiente, y ese pago todavía no la incluye.
    const confirms = summary.pendingConfirmsAt!;
    if (confirms >= summary.nextPayout) {
      expect(summary.nextPayoutAmount).toBe(0);
      expect(summary.pendingPayoutDate!.getTime()).toBeGreaterThan(confirms.getTime());
      expect(summary.pendingPayoutDate!.getDate()).toBe(config.payoutDayOfMonth);
    } else {
      expect(summary.nextPayoutAmount).toBe(432);
    }
  });
});

describe("fecha de pago", () => {
  it("el mismo día cuenta; si ya pasó, el del mes siguiente", () => {
    expect(payoutDateOnOrAfter(new Date(2026, 9, 4), 15)).toEqual(new Date(2026, 9, 15));
    expect(payoutDateOnOrAfter(new Date(2026, 9, 15, 18), 15)).toEqual(new Date(2026, 9, 15));
    expect(payoutDateOnOrAfter(new Date(2026, 9, 20), 15)).toEqual(new Date(2026, 10, 15));
  });
});
