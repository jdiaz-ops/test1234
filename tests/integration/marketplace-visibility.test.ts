import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listActiveOffers } from "@/server/services/marketplace-service";
import { createSellingBrand, hasDb } from "./helpers";

describe.skipIf(!hasDb)("marketplace de marcas", () => {
  it("sale cuando está aprobada y su lista del Dashboard está lista, sin los 4 pasos de antes", async () => {
    const brand = await createSellingBrand();
    // Sin logo, sin descripción y sin aceptar "Cómo te cobramos": ya no importa.
    await prisma.brandProfile.update({
      where: { id: brand.id },
      data: { status: "APPROVED", logoUrl: null, description: null, billingAcknowledgedAt: null },
    });
    const offer = await prisma.offer.create({
      data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: 7, defaultDiscountPercent: 10 },
    });
    // Le faltan los datos legales y los pagos de verdad: no sale.
    expect((await listActiveOffers({})).map((o) => o.id)).not.toContain(offer.id);

    await prisma.brandProfile.update({
      where: { id: brand.id },
      data: {
        legalName: "Marca S.A.S.",
        taxId: "900111222-3",
        wompiPublicKeyProd: "pub_prod_x",
        wompiPrivateKeyProd: "prv_prod_x",
        wompiEventsKeyProd: "prod_events_x",
        wompiIntegrityKeyProd: "prod_integrity_x",
        paymentMode: "PRODUCTION",
      },
    });
    expect((await listActiveOffers({})).map((o) => o.id)).toContain(offer.id);

    // Sin aprobar, o forzada a oculta, no sale; forzada a visible sí, aunque le falte algo.
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { status: "PENDING" } });
    expect((await listActiveOffers({})).map((o) => o.id)).not.toContain(offer.id);
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { marketplaceVisibilityOverride: "FORCE_VISIBLE", legalName: null } });
    expect((await listActiveOffers({})).map((o) => o.id)).toContain(offer.id);
  });
});
