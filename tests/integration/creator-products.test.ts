import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { listProductFiltersForCreator, listProductsForCreator } from "@/server/services/product-service";
import { createBrand, createProduct, hasDb } from "./helpers";

describe.skipIf(!hasDb)("productos para armar colecciones del creador", () => {
  it("filtra por marca y por colección de la marca", async () => {
    const brand = await createBrand();
    const offer = await prisma.offer.create({
      data: { brandId: brand.id, name: "Programa", defaultCommissionPercent: 7, defaultDiscountPercent: 10 },
    });
    const user = await prisma.user.create({ data: { email: `c-${randomUUID().slice(0, 8)}@prueba.test`, role: "CREATOR" } });
    const creator = await prisma.creatorProfile.create({
      data: {
        userId: user.id,
        displayName: "Vale",
        baseCode: `V${randomUUID().slice(0, 6)}`,
        storefrontSlug: `v-${randomUUID().slice(0, 8)}`,
      },
    });
    await prisma.creatorOfferEnrollment.create({ data: { creatorId: creator.id, offerId: offer.id, discountCode: "VALE" } });

    const rojo = await createProduct(brand.id, { name: "Esmalte rojo", price: 10000, stock: null });
    await createProduct(brand.id, { name: "Lámpara", price: 90000, stock: null });
    const esmaltes = await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Esmaltes", slug: "esmaltes" } });
    await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Vacía", slug: "vacia" } });
    await prisma.productBrandCollection.create({ data: { productId: rojo.id, collectionId: esmaltes.id } });

    const filters = await listProductFiltersForCreator(creator.id, brand.id);
    expect(filters.brands.map((b) => b.id)).toEqual([brand.id]);
    expect(filters.collections).toEqual([{ id: esmaltes.id, name: "Esmaltes" }]);
    expect((await listProductFiltersForCreator(creator.id)).collections).toEqual([]);

    const all = await listProductsForCreator(creator.id, { brandId: brand.id });
    expect(all).toHaveLength(2);
    const only = await listProductsForCreator(creator.id, { brandId: brand.id, brandCollectionId: esmaltes.id });
    expect(only.map((p) => p.name)).toEqual(["Esmalte rojo"]);
  });
});
