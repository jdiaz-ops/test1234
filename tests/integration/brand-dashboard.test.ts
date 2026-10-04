import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordOrderFromWebhook } from "@/server/services/attribution-service";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { createBrand, hasDb } from "./helpers";

describe.skipIf(!hasDb)("dashboard de la marca", () => {
  it("cuenta las ventas con creadoras del mes y su costo aunque la comisión siga en espera", async () => {
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

    const summary = await getBrandDashboardSummary(brand.id);
    const fee = Math.round(5400 * Number(config.defaultPlatformFeePercent)) / 100;
    expect(summary.monthSales).toBe(5400);
    expect(summary.monthOrders).toBe(1);
    expect(summary.monthCreatorCommissions).toBe(432);
    expect(summary.monthPlatformFee).toBeCloseTo(fee + Math.round(fee * Number(config.vatPercent)) / 100, 2);
  });
});
