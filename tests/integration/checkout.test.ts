import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus, createStoreOrder } from "@/server/services/store-order-service";
import { RESERVATION_MINUTES } from "@/lib/order-math";
import { BUYER, createProduct, createSellingBrand, hasDb } from "./helpers";

const email = (n: string) => `${n}-${Math.random().toString(36).slice(2, 8)}@prueba.test`;

describe.skipIf(!hasDb)("checkout: inventario apartado", () => {
  it("la última unidad no se puede pedir dos veces mientras el primero paga", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 1 });
    const items = [{ productId: placa.id, quantity: 1 }];

    const first = await createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("a"), items });
    expect(first.order.dataConsentAt).not.toBeNull();
    await expect(
      createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("b"), items }),
    ).rejects.toThrow(/alguien más lo está pagando/);

    // El inventario guardado no se toca hasta que se paga.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(1);
  });

  it("si el primero no paga a tiempo, la unidad vuelve a estar disponible", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 1 });
    const items = [{ productId: placa.id, quantity: 1 }];
    const first = await createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("a"), items });
    await prisma.storeOrder.update({
      where: { id: first.order.id },
      data: { createdAt: new Date(Date.now() - (RESERVATION_MINUTES + 1) * 60_000) },
    });
    const second = await createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("b"), items });
    expect(second.order.status).toBe("PENDING");
  });

  it("un pago rechazado libera la unidad de inmediato", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 1 });
    const items = [{ productId: placa.id, quantity: 1 }];
    const first = await createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("a"), items });
    await applyWompiTransactionStatus({ reference: first.order.reference, wompiTransactionId: "x", wompiStatus: "DECLINED" });
    await expect(
      createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("b"), items }),
    ).resolves.toBeTruthy();
  });

  it("con pedidos simultáneos por la última unidad, solo uno queda creado", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 1 });
    const items = [{ productId: placa.id, quantity: 1 }];
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email(`c${i}`), items }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("si otro pedido está tomando la última unidad en ese instante, el segundo espera y no la vende dos veces", async () => {
    // Reproduce la carrera real paso a paso: una transacción hace lo mismo
    // que un checkout (bloquea el producto, revisa, crea su pedido) pero se
    // detiene antes de crear el pedido. Mientras tanto llega un segundo
    // checkout. Con el bloqueo, el segundo espera, ve la unidad apartada y
    // falla. Sin el bloqueo, vería la unidad libre y la vendería otra vez.
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 1 });
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    const first = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${placa.id} FOR UPDATE`;
        locked();
        await new Promise((r) => setTimeout(r, 600));
        await tx.storeOrder.create({
          data: {
            brandId: brand.id,
            reference: `mt_carrera_${placa.id}`,
            buyerName: "Primera",
            buyerEmail: email("primera"),
            buyerPhone: "3000000000",
            subtotalCents: 1_500_000,
            totalCents: 1_500_000,
            paymentMode: "TEST",
            items: { create: [{ productId: placa.id, name: "Placa", unitPriceCents: 1_500_000, quantity: 1 }] },
          },
        });
      },
      { timeout: 10_000 },
    );
    await lockTaken;

    const second = createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("segunda"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    await first;
    await expect(second).rejects.toThrow(/alguien más lo está pagando/);
  });

  it("aparta por variante, no por producto completo", async () => {
    const brand = await createSellingBrand();
    const esmalte = await createProduct(brand.id, {
      name: "Esmalte",
      price: 5000,
      stock: null,
      variants: [
        { label: "Plateado", stock: 1 },
        { label: "Dorado", stock: 1 },
      ],
    });
    const [plateado, dorado] = esmalte.variants;
    await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("a"),
      items: [{ productId: esmalte.id, variantId: plateado.id, quantity: 1 }],
    });
    await expect(
      createStoreOrder(brand.storefrontSlug!, {
        ...BUYER,
        buyerEmail: email("b"),
        items: [{ productId: esmalte.id, variantId: dorado.id, quantity: 1 }],
      }),
    ).resolves.toBeTruthy();
    await expect(
      createStoreOrder(brand.storefrontSlug!, {
        ...BUYER,
        buyerEmail: email("c"),
        items: [{ productId: esmalte.id, variantId: plateado.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/alguien más lo está pagando/);
  });

  it("productos sin control de inventario nunca se bloquean", async () => {
    const brand = await createSellingBrand();
    const libre = await createProduct(brand.id, { name: "Libre", price: 9000, stock: null });
    const items = [{ productId: libre.id, quantity: 50 }];
    await createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("a"), items });
    await expect(createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("b"), items })).resolves.toBeTruthy();
  });
});

describe.skipIf(!hasDb)("checkout: autorización de datos personales", () => {
  it("sin la casilla marcada no se crea el pedido", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    await expect(
      createStoreOrder(brand.storefrontSlug!, {
        ...BUYER,
        dataConsent: false,
        buyerEmail: email("a"),
        items: [{ productId: placa.id, quantity: 1 }],
      }),
    ).rejects.toThrow(/autoriza el tratamiento/);
    expect(await prisma.storeOrder.count({ where: { brandId: brand.id } })).toBe(0);
  });
});
