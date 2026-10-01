import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Las URLs de prueba resuelven a una IP pública ficticia; nada sale a internet.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) =>
    host === "interno.example.com" ? [{ address: "10.0.0.5", family: 4 }] : [{ address: "93.184.216.34", family: 4 }],
  ),
}));

import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus, updateOrderFulfillment } from "@/server/services/store-order-service";
import {
  assertPublicHttpsUrl,
  createBrandWebhook,
  getWebhookSigningSecret,
  sendTestWebhook,
  WebhookError,
} from "@/server/services/webhook-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

type Captured = { url: string; headers: Record<string, string>; body: string };
let captured: Captured[] = [];

beforeEach(() => {
  captured = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      captured.push({ url, headers: init.headers as Record<string, string>, body: init.body as string });
      return new Response("ok", { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("URL de un webhook", () => {
  it("solo acepta https a direcciones públicas", async () => {
    await expect(assertPublicHttpsUrl("http://hooks.example.com/x")).rejects.toBeInstanceOf(WebhookError);
    await expect(assertPublicHttpsUrl("https://localhost/x")).rejects.toBeInstanceOf(WebhookError);
    await expect(assertPublicHttpsUrl("https://127.0.0.1/x")).rejects.toBeInstanceOf(WebhookError);
    await expect(assertPublicHttpsUrl("https://169.254.169.254/latest")).rejects.toBeInstanceOf(WebhookError);
    await expect(assertPublicHttpsUrl("https://interno.example.com/x")).rejects.toBeInstanceOf(WebhookError);
    await expect(assertPublicHttpsUrl("https://app.example.com/rest-api/shopify?c=1")).resolves.toContain("https://");
  });
});

describe.skipIf(!hasDb)("webhooks de pedidos", () => {
  it("al pagarse un pedido manda orders/updated firmado, con formato Shopify y financial_status paid", async () => {
    const brand = await createBrand();
    await createBrandWebhook(brand.id, { topic: "orders/updated", url: "https://hooks.example.com/dataico" });
    await createBrandWebhook(brand.id, { topic: "customers/create", url: "https://hooks.example.com/clientes" });
    const product = await createProduct(brand.id, { name: "Placa", price: 20000, stock: 5 });
    const order = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 2, unitPrice: 20000 }]);
    await prisma.storeOrder.update({ where: { id: order.id }, data: { paymentMode: "PRODUCTION" } });

    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-1", wompiStatus: "APPROVED" });

    const orderHook = captured.find((c) => c.url.endsWith("/dataico"))!;
    expect(orderHook).toBeDefined();
    expect(orderHook.headers["X-Shopify-Topic"]).toBe("orders/updated");
    const secret = await getWebhookSigningSecret(brand.id);
    expect(orderHook.headers["X-Shopify-Hmac-Sha256"]).toBe(
      createHmac("sha256", secret).update(orderHook.body, "utf8").digest("base64"),
    );
    const payload = JSON.parse(orderHook.body);
    expect(typeof payload.id).toBe("number");
    expect(payload.financial_status).toBe("paid");
    expect(payload.test).toBe(false);
    expect(payload.total_price).toBe("40000.00");
    expect(payload.line_items[0]).toMatchObject({ quantity: 2, price: "20000.00" });

    const customerHook = captured.find((c) => c.url.endsWith("/clientes"))!;
    expect(customerHook.headers["X-Shopify-Topic"]).toBe("customers/create");

    const deliveries = await prisma.webhookDelivery.findMany({ where: { webhook: { brandId: brand.id } } });
    expect(deliveries.every((d) => d.status === "SUCCEEDED")).toBe(true);

    // Al enviarlo, otro orders/updated con el pedido despachado.
    captured = [];
    await updateOrderFulfillment(brand.id, { orderId: order.id, fulfillmentStatus: "SHIPPED", carrier: "Servientrega", trackingNumber: "123" });
    expect(JSON.parse(captured[0].body).fulfillment_status).toBe("fulfilled");
  });

  it("no manda pedidos hechos en modo de prueba y la prueba llega anulada", async () => {
    const brand = await createBrand();
    const webhook = await createBrandWebhook(brand.id, { topic: "orders/updated", url: "https://hooks.example.com/dataico" });
    const product = await createProduct(brand.id, { name: "Placa", price: 20000, stock: 5 });
    const order = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 20000 }]);

    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-2", wompiStatus: "APPROVED" });
    expect(captured).toHaveLength(0);

    const delivery = await sendTestWebhook(brand.id, webhook.id);
    expect(delivery.status).toBe("SUCCEEDED");
    expect(JSON.parse(captured[0].body)).toMatchObject({ financial_status: "voided", test: true });
  });

  it("registra cuando la URL responde con error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    const brand = await createBrand();
    const webhook = await createBrandWebhook(brand.id, { topic: "orders/updated", url: "https://hooks.example.com/caido" });
    const delivery = await sendTestWebhook(brand.id, webhook.id);
    expect(delivery.status).toBe("FAILED");
    expect(delivery.lastStatusCode).toBe(500);
  });
});
