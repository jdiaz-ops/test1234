import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { CreatorCatalogError, getCreatorCatalog } from "@/server/services/creator-catalog-api-service";
import { createBrand, createProduct, hasDb } from "./helpers";

async function createCreator(data: { suspended?: boolean } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const user = await prisma.user.create({ data: { email: `cr-${suffix}@prueba.test`, role: "CREATOR" } });
  return prisma.creatorProfile.create({
    data: {
      userId: user.id,
      displayName: `Creadora ${suffix}`,
      baseCode: `C${suffix}`.toUpperCase(),
      storefrontSlug: `cr-${suffix}`,
      suspended: data.suspended ?? false,
    },
  });
}

async function approvedBrandWithOffer(discount = 10, commission = 8) {
  const brand = await prisma.brandProfile.update({ where: { id: (await createBrand()).id }, data: { status: "APPROVED" } });
  const offer = await prisma.offer.create({
    data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: commission, defaultDiscountPercent: discount },
  });
  return { brand, offer };
}

describe.skipIf(!hasDb)("API de catálogo para creadoras", () => {
  it("solo trae las marcas que tienen a la creadora ACTIVE y que Marcolini promueve", async () => {
    const creator = await createCreator();
    const active = await approvedBrandWithOffer(15, 10);
    const pending = await approvedBrandWithOffer();
    const removed = await approvedBrandWithOffer();
    const deactivated = await approvedBrandWithOffer();
    const paused = await approvedBrandWithOffer();
    const testBrand = await approvedBrandWithOffer(5, 5);
    await prisma.brandProfile.update({ where: { id: paused.brand.id }, data: { status: "PAUSED" } });
    await prisma.brandProfile.update({
      where: { id: testBrand.brand.id },
      data: { status: "PENDING", marketplaceVisibilityOverride: "FORCE_VISIBLE" },
    });
    await prisma.brandCharge.create({
      data: { brandId: deactivated.brand.id, periodStart: new Date(), periodEnd: new Date(), totalAmount: 1000, status: "DEACTIVATED", dueAt: new Date() },
    });

    const enroll = (offerId: string, status: "ACTIVE" | "PENDING_APPROVAL" | "REMOVED", code = "NAILFEST") =>
      prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId, status, discountCode: code } });
    await enroll(active.offer.id, "ACTIVE");
    await enroll(pending.offer.id, "PENDING_APPROVAL");
    await enroll(removed.offer.id, "REMOVED");
    await enroll(deactivated.offer.id, "ACTIVE");
    await enroll(paused.offer.id, "ACTIVE");
    await enroll(testBrand.offer.id, "ACTIVE");

    const catalog = await getCreatorCatalog(creator.storefrontSlug);
    expect(catalog.creator.storefrontSlug).toBe(creator.storefrontSlug);
    expect(catalog.brands.map((b) => b.id).sort()).toEqual([active.brand.id, testBrand.brand.id].sort());

    const brand = catalog.brands.find((b) => b.id === active.brand.id)!;
    expect(brand).toMatchObject({
      discountCode: "NAILFEST",
      discountPercent: 15,
      commissionPercent: 10,
      storeKind: "MARCOLINI",
      codeAppliedByLink: true,
      campaign: null,
    });
    expect(brand.storeUrl).toMatch(/^https:\/\/prueba-[^/]+\/\?ref=NAILFEST$/);
  });

  it("trae lo que está a la venta, con precios y el link que atribuye la venta", async () => {
    const creator = await createCreator();
    const { brand, offer } = await approvedBrandWithOffer(20);
    await prisma.creatorOfferEnrollment.create({
      data: { creatorId: creator.id, offerId: offer.id, discountCode: "NAILFEST", discountPercentOverride: 25 },
    });

    const gel = await createProduct(brand.id, { name: "Gel rojo", price: 40000, stock: 5 });
    await prisma.product.update({ where: { id: gel.id }, data: { compareAtPrice: 50000 } });
    const lamp = await createProduct(brand.id, {
      name: "Lámpara",
      price: 90000,
      stock: null,
      variants: [
        { label: "Blanca", stock: 3 },
        { label: "Rosa", stock: 0 },
      ],
    });
    await prisma.productVariant.update({ where: { id: lamp.variants[0]!.id }, data: { price: 95000 } });
    await prisma.productVariant.update({ where: { id: lamp.variants[1]!.id }, data: { price: 80000 } });
    await createProduct(brand.id, { name: "Agotado", price: 10000, stock: 0 });
    const draft = await createProduct(brand.id, { name: "Borrador", price: 10000, stock: 2 });
    await prisma.product.update({ where: { id: draft.id }, data: { status: "DRAFT", available: false } });
    const unlisted = await createProduct(brand.id, { name: "Solo con link", price: 10000, stock: 2 });
    await prisma.product.update({ where: { id: unlisted.id }, data: { status: "UNLISTED" } });
    const collection = await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Geles", slug: "geles" } });
    await prisma.productBrandCollection.create({ data: { productId: gel.id, collectionId: collection.id } });

    const catalog = await getCreatorCatalog(creator.storefrontSlug);
    expect(catalog.brands[0]).toMatchObject({ discountPercent: 25, productCount: 2 });
    expect(catalog.products.map((p) => p.name).sort()).toEqual(["Gel rojo", "Lámpara"]);

    const gelOut = catalog.products.find((p) => p.id === gel.id)!;
    expect(gelOut).toMatchObject({ price: 40000, priceMax: null, compareAtPrice: 50000, collections: ["Geles"], type: "PHYSICAL" });
    expect(gelOut.url).toBe(`https://${brand.storefrontSlug}.marcolini.lat/${gel.slug}?ref=NAILFEST`);

    // Solo cuenta la variante con stock (la rosa, más barata, está agotada).
    const lampOut = catalog.products.find((p) => p.id === lamp.id)!;
    expect(lampOut).toMatchObject({ price: 95000, priceMax: null, compareAtPrice: null });
  });

  it("usa el descuento de la campaña solo cuando ya se subió en la tienda", async () => {
    const creator = await createCreator();
    const { offer } = await approvedBrandWithOffer(10, 8);
    await prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId: offer.id, discountCode: "NAILFEST" } });
    const start = new Date(Date.now() - 3600_000);
    const end = new Date(Date.now() + 86400_000);
    const flash = await prisma.challenge.create({
      data: {
        offerId: offer.id,
        type: "FLASH_SALE",
        name: "Nail Fest Week",
        startDate: start,
        endDate: end,
        config: { newDiscountPercent: 30, newCommissionPercent: 12 },
      },
    });

    let brand = (await getCreatorCatalog(creator.storefrontSlug)).brands[0]!;
    expect(brand.discountPercent).toBe(10);
    expect(brand.commissionPercent).toBe(12);
    expect(brand.campaign).toMatchObject({ name: "Nail Fest Week", discountPercent: null, commissionPercent: 12 });

    await prisma.challenge.update({ where: { id: flash.id }, data: { discountBoostActive: true } });
    brand = (await getCreatorCatalog(creator.storefrontSlug)).brands[0]!;
    expect(brand.discountPercent).toBe(30);
    expect(brand.campaign).toMatchObject({ discountPercent: 30, endsAt: end.toISOString() });
  });

  it("pagina los productos con el cursor", async () => {
    const creator = await createCreator();
    const { brand, offer } = await approvedBrandWithOffer();
    await prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId: offer.id, discountCode: "NAILFEST" } });
    for (const name of ["Uno", "Dos", "Tres"]) await createProduct(brand.id, { name, price: 1000, stock: null });

    const first = await getCreatorCatalog(creator.storefrontSlug, { limit: 2 });
    expect(first.products).toHaveLength(2);
    expect(first.nextCursor).toBe(first.products[1]!.id);
    const second = await getCreatorCatalog(creator.storefrontSlug, { limit: 2, cursor: first.nextCursor });
    expect(second.products).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(second.brands).toHaveLength(1);
    expect(new Set([...first.products, ...second.products].map((p) => p.name))).toEqual(new Set(["Uno", "Dos", "Tres"]));
  });

  it("rechaza una creadora suspendida o inexistente", async () => {
    const suspended = await createCreator({ suspended: true });
    await expect(getCreatorCatalog(suspended.storefrontSlug)).rejects.toMatchObject({ status: 403 });
    await expect(getCreatorCatalog("no-existe-nunca")).rejects.toBeInstanceOf(CreatorCatalogError);
  });
});
