import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { deleteTestProfiles, KEPT_TEST_CREATOR_EMAIL } from "@/server/services/admin-cleanup-service";
import { createTestCreators } from "@/server/services/admin-creator-service";
import { hasDb } from "./helpers";

describe.skipIf(!hasDb)("borrar perfiles de prueba", () => {
  it("borra marcas y creadores de prueba con sus ventas y deja al creador de prueba 1", async () => {
    await deleteTestProfiles(); // restos de una corrida anterior
    await createTestCreators();
    const brandUser = await prisma.user.create({
      data: {
        email: "marca-prueba-9@marcolini.test",
        role: "BRAND",
        brandProfile: { create: { companyName: "Marca Nueve Prueba", storefrontSlug: "marca-nueve-prueba" } },
      },
      include: { brandProfile: true },
    });
    const brand = brandUser.brandProfile!;
    const offer = await prisma.offer.create({
      data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: 7, defaultDiscountPercent: 10 },
    });
    const kept = await prisma.creatorProfile.findFirstOrThrow({ where: { user: { email: KEPT_TEST_CREATOR_EMAIL } } });
    const other = await prisma.creatorProfile.findFirstOrThrow({
      where: { user: { email: "creador-prueba-2@marcolini.test" } },
    });
    for (const c of [kept, other]) {
      const enrollment = await prisma.creatorOfferEnrollment.create({
        data: { creatorId: c.id, offerId: offer.id, discountCode: `${c.baseCode}X` },
      });
      const t = await prisma.transaction.create({
        data: {
          brandId: brand.id,
          offerId: offer.id,
          creatorId: c.id,
          enrollmentId: enrollment.id,
          externalOrderId: `o-${enrollment.id}`,
          grossAmount: 100000,
          discountAmount: 10000,
          netAmount: 90000,
          occurredAt: new Date(),
          source: "MANUAL",
        },
      });
      await prisma.commission.create({
        data: {
          transactionId: t.id,
          creatorProfileId: c.id,
          creatorCommissionAmount: 6300,
          platformFeeAmount: 4500,
          platformFeeVatAmount: 855,
          holdUntil: new Date(),
        },
      });
    }

    const { deleted } = await deleteTestProfiles();
    expect(deleted).toEqual(expect.arrayContaining(["Marca Nueve Prueba"]));
    expect(await prisma.user.count({ where: { email: { endsWith: "@marcolini.test" } } })).toBe(1);
    expect(await prisma.creatorProfile.findUnique({ where: { id: kept.id } })).not.toBeNull();
    expect(await prisma.transaction.count({ where: { creatorId: kept.id } })).toBe(0);
  });
});
