import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus, createStoreOrder } from "@/server/services/store-order-service";
import { RESERVATION_MINUTES } from "@/lib/order-math";
import { POST as createOrderRoute } from "@/app/api/tienda/[slug]/ordenes/route";
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

/// Por la ruta completa, como lo hace el navegador: antes la ruta no le
/// pasaba la autorización a createStoreOrder y toda compra se rechazaba
/// con "autoriza el tratamiento de tus datos" aunque la casilla estuviera
/// marcada (las pruebas de arriba llaman a la función directo y no lo
/// vieron). Ver conversación del 2026-10-01.
describe.skipIf(!hasDb)("checkout: la ruta que usa el navegador", () => {
  const post = (slug: string, body: unknown) =>
    createOrderRoute(
      new Request(`http://localhost/api/tienda/${slug}/ordenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ slug }) },
    );

  it("con la casilla marcada crea el pedido y guarda los datos de factura", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const res = await post(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("ruta"),
      items: [{ productId: placa.id, quantity: 1 }],
      billingIdType: "CC",
      billingIdNumber: "1020304050",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const order = await prisma.storeOrder.findUniqueOrThrow({ where: { id: body.orderId } });
    expect(order.dataConsentAt).not.toBeNull();
    expect(order).toMatchObject({ billingIdType: "CC", billingIdNumber: "1020304050" });
  });

  it("devuelve el link directo a Wompi con los datos del comprador y guarda los campos nuevos", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const buyerEmail = email("onepage");
    const res = await post(brand.storefrontSlug!, {
      ...BUYER,
      buyerName: "Ana María Pérez Gómez",
      buyerFirstName: "Ana María",
      buyerLastName: "Pérez Gómez",
      buyerEmail,
      buyerPhone: "313 405 8607",
      shippingPostalCode: "050021",
      acceptsMarketing: true,
      billingIdType: "CC",
      billingIdNumber: "1020304050",
      billingAddress: "Carrera 7 # 8-9",
      billingCity: "Bogotá",
      billingRegion: "Bogotá D.C.",
      items: [{ productId: placa.id, quantity: 1 }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const url = new URL(body.checkoutUrl);
    expect(url.origin + url.pathname).toBe("https://checkout.wompi.co/p/");
    expect(url.searchParams.get("public-key")).toBe("pub_test_x");
    expect(url.searchParams.get("amount-in-cents")).toBe(String(body.wompi.amountInCents));
    expect(url.searchParams.get("signature:integrity")).toBe(body.wompi.signature);
    expect(url.searchParams.get("customer-data:email")).toBe(buyerEmail);
    expect(url.searchParams.get("customer-data:phone-number")).toBe("3134058607");
    expect(url.searchParams.get("customer-data:legal-id")).toBe("1020304050");

    const order = await prisma.storeOrder.findUniqueOrThrow({ where: { id: body.orderId } });
    expect(order).toMatchObject({
      buyerFirstName: "Ana María",
      buyerLastName: "Pérez Gómez",
      shippingPostalCode: "050021",
      acceptsMarketing: true,
      billingAddress: "Carrera 7 # 8-9",
      billingRegion: "Bogotá D.C.",
    });
    expect(order.shippingMethod).toBeTruthy();

    // Al pagarse, quien pidió novedades queda suscrito en Clientes.
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-op", wompiStatus: "APPROVED" });
    const customer = await prisma.storeCustomer.findUniqueOrThrow({
      where: { brandId_email: { brandId: brand.id, email: buyerEmail } },
    });
    expect(customer.emailSubscribed).toBe(true);
  });

  it("con facturación de Dataico activa, la cédula o NIT es obligatoria", async () => {
    const brand = await createSellingBrand();
    await prisma.dataicoConnection.create({
      data: { brandId: brand.id, accountId: "a", authToken: "t", prefix: "FE", nextNumber: 1, enabled: true },
    });
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const res = await post(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("sinid"), items: [{ productId: placa.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cédula o NIT/);
  });

  it("sin la casilla responde el mensaje de autorización", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const res = await post(brand.storefrontSlug!, {
      ...BUYER,
      dataConsent: false,
      buyerEmail: email("ruta"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/autoriza el tratamiento/);
  });
});
