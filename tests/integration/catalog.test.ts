import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";
import { getProductReviews, moderateReview, submitProductReview } from "@/server/services/product-review-service";
import { bulkProductAction } from "@/server/services/brand-store-product-service";
import {
  createBrandCollection,
  getPublicBrandCollection,
  setProductCollections,
  updateBrandCollection,
} from "@/server/services/brand-collection-service";
import { rateLimit } from "@/lib/rate-limit";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

describe.skipIf(!hasDb)("reseñas", () => {
  it("solo opina quien compró, una vez, y no se publica sin aprobación", async () => {
    const brand = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 10 });
    const buyer = "laura@prueba.test";
    const review = { productId: placa.id, name: "Laura", email: buyer, rating: 5, body: "Me encantó la placa" };

    await expect(submitProductReview(brand.storefrontSlug!, review)).rejects.toThrow(/compraron este producto/);

    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 1, unitPrice: 15000 }], buyer);
    // Pedido sin pagar todavía: tampoco cuenta.
    await expect(submitProductReview(brand.storefrontSlug!, review)).rejects.toThrow(/compraron este producto/);
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "r1", wompiStatus: "APPROVED" });

    const created = await submitProductReview(brand.storefrontSlug!, { ...review, email: "LAURA@prueba.test " });
    expect(created.status).toBe("PENDING");
    expect((await getProductReviews(placa.id)).count).toBe(0);

    await expect(submitProductReview(brand.storefrontSlug!, review)).rejects.toThrow(/Ya dejaste/);

    await moderateReview(brand.id, { reviewId: created.id, action: "approve" });
    const published = await getProductReviews(placa.id);
    expect(published.count).toBe(1);
    expect(published.average).toBe(5);
  });

  it("una marca no puede moderar reseñas de otra", async () => {
    const brand = await createBrand();
    const other = await createBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 10 });
    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 1, unitPrice: 15000 }], "ana@prueba.test");
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "r2", wompiStatus: "APPROVED" });
    const created = await submitProductReview(brand.storefrontSlug!, {
      productId: placa.id,
      name: "Ana",
      email: "ana@prueba.test",
      rating: 3,
      body: "Normal, cumple",
    });
    await expect(moderateReview(other.id, { reviewId: created.id, action: "approve" })).rejects.toThrow(/no encontrada/);
  });
});

describe.skipIf(!hasDb)("colecciones y edición en grupo", () => {
  it("guardar un producto no lo mueve al final de su colección", async () => {
    const brand = await createBrand();
    const collection = await createBrandCollection(brand.id, { name: "Placas" });
    const a = await createProduct(brand.id, { name: "A", price: 1000, stock: 1 });
    const b = await createProduct(brand.id, { name: "B", price: 1000, stock: 1 });
    await setProductCollections(brand.id, a.id, [collection.id]);
    await setProductCollections(brand.id, b.id, [collection.id]);
    const before = await prisma.productBrandCollection.findFirstOrThrow({ where: { productId: a.id } });

    // Editar A (se vuelve a guardar con la misma colección).
    await setProductCollections(brand.id, a.id, [collection.id]);
    const after = await prisma.productBrandCollection.findFirstOrThrow({ where: { productId: a.id } });
    expect(after.id).toBe(before.id);
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());
  });

  it("activar en grupo se salta los productos sin precio", async () => {
    const brand = await createBrand();
    const conPrecio = await createProduct(brand.id, { name: "Con precio", price: 5000, stock: 1 });
    const sinPrecio = await createProduct(brand.id, { name: "Sin precio", price: 0, stock: 1 });
    await prisma.product.updateMany({ where: { id: { in: [conPrecio.id, sinPrecio.id] } }, data: { status: "DRAFT" } });

    const result = await bulkProductAction(brand.id, { productIds: [conPrecio.id, sinPrecio.id], action: "activate" });
    expect(result).toEqual({ changed: 1, skipped: 1 });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: conPrecio.id } })).status).toBe("ACTIVE");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: sinPrecio.id } })).status).toBe("DRAFT");
  });

  it("agregar a una colección en grupo no duplica y no toca productos de otra marca", async () => {
    const brand = await createBrand();
    const other = await createBrand();
    const collection = await createBrandCollection(brand.id, { name: "Ofertas" });
    const mine = await createProduct(brand.id, { name: "Mío", price: 5000, stock: 1 });
    const theirs = await createProduct(other.id, { name: "Ajeno", price: 5000, stock: 1 });
    await setProductCollections(brand.id, mine.id, [collection.id]);

    const result = await bulkProductAction(brand.id, {
      productIds: [mine.id, theirs.id],
      action: "addCollection",
      collectionId: collection.id,
    });
    expect(result.changed).toBe(0);
    expect(await prisma.productBrandCollection.count({ where: { collectionId: collection.id } })).toBe(1);
  });
});

describe.skipIf(!hasDb)("orden de productos en una colección", () => {
  it("respeta el orden manual, el automático y agrega al final", async () => {
    const brand = await createBrand();
    const caro = await createProduct(brand.id, { name: "Bravo", price: 30000, stock: 1 });
    const barato = await createProduct(brand.id, { name: "Charlie", price: 10000, stock: 1 });
    const medio = await createProduct(brand.id, { name: "alfa", price: 20000, stock: 1 });
    const collection = await createBrandCollection(brand.id, {
      name: "Placas",
      productIds: [barato.id, caro.id, medio.id],
    });
    const names = async () =>
      (await getPublicBrandCollection(brand.id, collection.slug))!.products.map((p) => p.product.name);

    expect(await names()).toEqual(["Charlie", "Bravo", "alfa"]);

    // La marca arrastra: alfa primero.
    await updateBrandCollection(brand.id, collection.id, {
      name: "Placas",
      productIds: [medio.id, barato.id, caro.id],
    });
    expect(await names()).toEqual(["alfa", "Charlie", "Bravo"]);

    // Desde la ficha del producto y en grupo: entran al final.
    const nuevo = await createProduct(brand.id, { name: "Delta", price: 5000, stock: 1 });
    await setProductCollections(brand.id, nuevo.id, [collection.id]);
    const otro = await createProduct(brand.id, { name: "Eco", price: 5000, stock: 1 });
    await bulkProductAction(brand.id, { productIds: [otro.id], action: "addCollection", collectionId: collection.id });
    expect(await names()).toEqual(["alfa", "Charlie", "Bravo", "Delta", "Eco"]);

    // Automático: A–Z sin importar mayúsculas, y por precio.
    const ids = [medio.id, barato.id, caro.id, nuevo.id, otro.id];
    await updateBrandCollection(brand.id, collection.id, { name: "Placas", productIds: ids, sortOrder: "ALPHA_ASC" });
    expect(await names()).toEqual(["alfa", "Bravo", "Charlie", "Delta", "Eco"]);
    await updateBrandCollection(brand.id, collection.id, { name: "Placas", productIds: ids, sortOrder: "PRICE_DESC" });
    expect(await names()).toEqual(["Bravo", "alfa", "Charlie", "Delta", "Eco"]);
  });
});

describe.skipIf(!hasDb)("límite de intentos", () => {
  it("bloquea al pasar el límite y cuenta bien peticiones simultáneas", async () => {
    const key = `prueba:${Date.now()}`;
    const results = await Promise.all(Array.from({ length: 8 }, () => rateLimit(key, 5, 60)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.find((r) => !r.ok)!.retryAfterSeconds).toBeGreaterThan(0);
  });
});
