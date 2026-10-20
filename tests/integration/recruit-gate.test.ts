import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getRecruitGate } from "@/server/services/go-live-service";
import { inviteCreatorToOffer, RecruitError } from "@/server/services/recruit-service";
import { createProduct, createSellingBrand, hasDb } from "./helpers";

async function discoverableCreator() {
  const suffix = randomUUID().slice(0, 6);
  const user = await prisma.user.create({ data: { email: `creadora-${suffix}@prueba.test`, role: "CREATOR" } });
  return prisma.creatorProfile.create({
    data: { userId: user.id, displayName: `Creadora ${suffix}`, baseCode: `CR${suffix}`.toUpperCase(), storefrontSlug: `cr-${suffix}`, discoverable: true },
  });
}

describe.skipIf(!hasDb)("invitar creadoras solo con el registro terminado", () => {
  it("ve la red, pero no invita hasta terminar los pasos y estar aprobada", async () => {
    const brand = await createSellingBrand();
    await createProduct(brand.id, { name: "Placa", price: 15000, stock: 3 });
    const offer = await prisma.offer.create({ data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: 8, defaultDiscountPercent: 10 } });
    const creator = await discoverableCreator();
    const invite = () => inviteCreatorToOffer(brand.id, { offerId: offer.id, creatorId: creator.id });

    // Le faltan la razón social y los pagos: ni la pantalla ni la API dejan invitar.
    const gate = await getRecruitGate(brand.id);
    expect(gate.allowed).toBe(false);
    expect(gate.missing).toBe(2);
    await expect(invite()).rejects.toBeInstanceOf(RecruitError);
    await expect(invite()).rejects.toThrow("Termina el proceso de registro para empezar a invitar creadoras a tu programa.");

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
        status: "PENDING",
      },
    });
    // Pasos listos, pero todavía sin aprobar.
    expect(await getRecruitGate(brand.id)).toEqual({ allowed: false, approved: false, missing: 0 });
    await expect(invite()).rejects.toThrow("Apenas aprobemos tu marca podrás invitar creadoras a tu programa.");

    await prisma.brandProfile.update({ where: { id: brand.id }, data: { status: "APPROVED" } });
    expect((await getRecruitGate(brand.id)).allowed).toBe(true);
    const invitation = await invite();
    expect(invitation.creatorId).toBe(creator.id);
  });

  it("el admin puede abrirla a la fuerza para probar", async () => {
    const brand = await createSellingBrand();
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { marketplaceVisibilityOverride: "FORCE_VISIBLE" } });
    expect(await getRecruitGate(brand.id)).toEqual({ allowed: true, approved: true, missing: 0 });
  });

  it("sin tienda todavía, le falta armarla", async () => {
    const user = await prisma.user.create({ data: { email: `sin-tienda-${randomUUID().slice(0, 6)}@prueba.test`, role: "BRAND" } });
    const brand = await prisma.brandProfile.create({ data: { userId: user.id, companyName: "Sin tienda" } });
    expect(await getRecruitGate(brand.id)).toEqual({ allowed: false, approved: false, missing: 1 });
  });
});
