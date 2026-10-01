import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { countOpenOrders, reconcilePendingOrders } from "@/server/services/store-order-service";
import { createPendingOrder, createProduct, createSellingBrand, hasDb } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

describe.skipIf(!hasDb)("pedidos pendientes que Wompi ya resolvió", () => {
  it("un pago aprobado queda Pagado sin que el comprador vuelva a la tienda; uno abandonado se vence", async () => {
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const paid = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 15000 }]);
    const abandoned = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 15000 }]);
    await prisma.storeOrder.update({ where: { id: abandoned.id }, data: { createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000) } });

    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        urls.push(url);
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer prv_test_x");
        const ref = new URL(url).searchParams.get("reference");
        const data = ref === paid.reference ? [{ id: "tx-ok", status: "APPROVED", reference: ref }] : [];
        return new Response(JSON.stringify({ data }), { status: 200 });
      }),
    );

    await reconcilePendingOrders(brand.id);
    expect(urls.every((u) => u.startsWith("https://sandbox.wompi.co/v1/transactions?reference="))).toBe(true);

    const nowPaid = await prisma.storeOrder.findUniqueOrThrow({ where: { id: paid.id } });
    expect(nowPaid).toMatchObject({ status: "PAID", wompiTransactionId: "tx-ok" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(4);
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: abandoned.id } })).status).toBe("EXPIRED");

    // La burbuja de Pedidos cuenta el pagado que falta por enviar.
    expect(await countOpenOrders(brand.id)).toBe(1);
    await prisma.storeOrder.update({ where: { id: paid.id }, data: { fulfillmentStatus: "SHIPPED" } });
    expect(await countOpenOrders(brand.id)).toBe(0);
  });

  it("si Wompi no responde, el pedido sigue pendiente (se reintenta después)", async () => {
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const order = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 15000 }]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 500 })));
    await reconcilePendingOrders(brand.id);
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
  });
});
