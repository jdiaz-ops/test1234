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

  it("enriquece cada producto: atributos, línea, reseñas, inventario, ventas con el código y envío", async () => {
    const creator = await createCreator();
    const { brand, offer } = await approvedBrandWithOffer(10);
    await prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId: offer.id, discountCode: "NAILFEST" } });

    const princesa = await createProduct(brand.id, { name: "Gel Polish Rosados – Princesa", price: 30000, stock: 3 });
    await prisma.product.update({
      where: { id: princesa.id },
      data: {
        attributes: { "Familia de color": "Rosados", Grupo: "Gel Polish Rosados", Tono: "Princesa", Tamaño: "15 ml" },
        description: "<p>Libre de <b>HEMA</b>, vegano.</p>",
      },
    });
    const chicle = await createProduct(brand.id, { name: "Gel Polish Rosados – Chicle", price: 30000, stock: null });
    const coco = await createProduct(brand.id, { name: "Aceite de cutícula Coco 30ml", price: 18000, stock: null });
    await createProduct(brand.id, { name: "Aceite de cutícula Uva 30ml", price: 18000, stock: null });
    const lamp = await createProduct(brand.id, {
      name: "Lámpara",
      price: 90000,
      stock: null,
      variants: [
        { label: "Blanca", stock: 2 },
        { label: "Rosa", stock: 1 },
      ],
    });

    const review = (rating: number, status: "APPROVED" | "PENDING", email: string) =>
      prisma.productReview.create({ data: { brandId: brand.id, productId: princesa.id, authorName: "A", authorEmail: email, rating, body: "x", status } });
    await review(5, "APPROVED", "a@x.test");
    await review(4, "APPROVED", "b@x.test");
    await review(1, "PENDING", "c@x.test");

    const order = (code: string | null, status: "PAID" | "PENDING", paidAt: Date | null, quantity: number) =>
      prisma.storeOrder.create({
        data: {
          brandId: brand.id,
          reference: `mt_${randomUUID()}`,
          buyerName: "C",
          buyerEmail: `c-${randomUUID().slice(0, 6)}@x.test`,
          buyerPhone: "3000000000",
          shippingAddress: "Calle 1",
          shippingCity: "Bogotá",
          shippingRegion: "Bogotá",
          subtotalCents: 3000000 * quantity,
          totalCents: 3000000 * quantity,
          paymentMode: "TEST",
          discountCode: code,
          status,
          paidAt,
          items: { create: [{ productId: princesa.id, name: "Princesa", unitPriceCents: 3000000, quantity }] },
        },
      });
    await order("nailfest", "PAID", new Date(), 2);
    await order("OTRA", "PAID", new Date(), 5);
    await order("NAILFEST", "PENDING", null, 7);
    await order("NAILFEST", "PAID", new Date(Date.now() - 100 * 86_400_000), 9);

    await prisma.shippingZone.create({
      data: {
        brandId: brand.id,
        name: "Bogotá",
        regions: ["Bogotá"],
        rates: {
          create: [
            { name: "Normal", price: 12000 },
            { name: "Gratis", price: 0, condition: "MIN_ORDER_AMOUNT", conditionValue: 150000 },
          ],
        },
      },
    });
    await prisma.shippingZone.create({ data: { brandId: brand.id, name: "Resto", regions: ["Antioquia"], rates: { create: [{ name: "Normal", price: 15000 }] } } });

    const catalog = await getCreatorCatalog(creator.storefrontSlug);
    expect(catalog.brands[0]).toMatchObject({ freeShippingFrom: 150000, freeShippingAllZones: false });
    const byId = new Map(catalog.products.map((p) => [p.id, p]));

    expect(byId.get(princesa.id)).toMatchObject({
      colorFamily: "Rosados",
      line: "Gel Polish Rosados",
      variant: "Princesa",
      size: "15 ml",
      nicheCategory: "Esmaltes",
      description: "Libre de HEMA, vegano.",
      rating: { average: 4.5, count: 2 },
      unitsLeft: 3,
      soldWithCode: 2,
    });
    expect(byId.get(chicle.id)).toMatchObject({ line: "Gel Polish Rosados", variant: "Chicle", unitsLeft: null, rating: null, soldWithCode: 0 });
    expect(byId.get(coco.id)!.line).not.toBeNull();
    expect(byId.get(lamp.id)).toMatchObject({ variantCount: 2, optionNames: ["Color"], unitsLeft: 3, nicheCategory: "Herramientas y equipos" });
  });

  it("rechaza una creadora suspendida o inexistente", async () => {
    const suspended = await createCreator({ suspended: true });
    await expect(getCreatorCatalog(suspended.storefrontSlug)).rejects.toMatchObject({ status: 403 });
    await expect(getCreatorCatalog("no-existe-nunca")).rejects.toBeInstanceOf(CreatorCatalogError);
  });
});
