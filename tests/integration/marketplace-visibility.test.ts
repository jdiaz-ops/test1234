import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listActiveOffers } from "@/server/services/marketplace-service";
import { getBrandOnboardingStatus } from "@/server/services/onboarding-service";
import { createBrand, hasDb } from "./helpers";

describe.skipIf(!hasDb)("marketplace de marcas", () => {
  it("una marca con su tienda en Marcolini sale sin tener Shopify conectado", async () => {
    const brand = await createBrand();
    const ready = await prisma.brandProfile.update({
      where: { id: brand.id },
      data: {
        status: "APPROVED",
        logoUrl: "/logo.png",
        description: "Marca de prueba",
        websiteUrl: null,
        storeConnectionStatus: "NOT_CONNECTED",
        billingAcknowledgedAt: new Date(),
      },
    });
    const offer = await prisma.offer.create({
      data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: 7, defaultDiscountPercent: 10 },
    });

    expect((await getBrandOnboardingStatus(ready)).steps.find((s) => s.key === "tienda")?.done).toBe(true);
    expect((await listActiveOffers({})).map((o) => o.id)).toContain(offer.id);

    // Sin tienda en Marcolini ni conectada, no sale.
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { storefrontSlug: null } });
    expect((await listActiveOffers({})).map((o) => o.id)).not.toContain(offer.id);
  });
});
