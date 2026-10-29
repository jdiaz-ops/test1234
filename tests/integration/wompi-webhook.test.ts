import { createHash, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStoreOrder } from "@/server/services/store-order-service";
import { POST as wompiWebhook } from "@/app/api/webhooks/wompi/route";
import { GET as orderStatusRoute } from "@/app/api/tienda/pedidos/[orderId]/estado/route";
import { BUYER, createProduct, createSellingBrand, hasDb } from "./helpers";

// Las de createSellingBrand (modo pruebas).
const BRAND_EVENTS_KEY = "test_events_x";
const BRAND_INTEGRITY_KEY = "test_integrity_x";
// La cuenta compartida con Nail Fest y la tienda Shopify.
const SHARED_EVENTS_SECRET = "prod_events_compartido";
const NAILFEST_URL = "https://nailfest.lat/api/wompi/events";
const SHOPIFY_URL = "https://conexa.example/wompi/tienda";
const RELAY_SECRET = "relay-secreto-de-prueba";

const sha256 = (raw: string) => createHash("sha256").update(raw).digest("hex");

/// Un evento como los que manda Wompi (docs.wompi.co → Eventos), firmado
/// con `secret`: sha256(transaction.id + transaction.status +
/// transaction.amount_in_cents + timestamp + secreto), en mayúsculas como
/// en los ejemplos de Wompi.
function wompiEvent(
  t: { id: string; reference: string; status: string; amountInCents: number },
  secret: string,
  environment: "prod" | "test" = "prod",
) {
  const timestamp = 1761750000;
  return {
    event: "transaction.updated",
    data: {
      transaction: {
        id: t.id,
        amount_in_cents: t.amountInCents,
        reference: t.reference,
        customer_email: "compradora@prueba.test",
        currency: "COP",
        payment_method_type: "CARD",
        redirect_url: "https://tienda.marcolini.lat/pedido/x",
        status: t.status,
        shipping_address: null,
        payment_link_id: null,
        payment_source_id: null,
      },
    },
    environment,
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum: sha256(`${t.id}${t.status}${t.amountInCents}${timestamp}${secret}`).toUpperCase(),
    },
    timestamp,
    sent_at: "2026-10-29T15:00:00.000Z",
  };
}

/// El body tal cual lo manda Wompi: con su propio formato, para comprobar
/// que el reenvío lleva los mismos bytes.
const rawOf = (event: unknown) => JSON.stringify(event, null, 2);

const post = (raw: string, headers: Record<string, string> = {}) =>
  wompiWebhook(
    new Request("https://marcolini.lat/api/webhooks/wompi", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: raw,
    }),
  );

/// Espera la respuesta haciendo correr las pausas entre reintentos (1 s,
/// 2 s, 4 s) sin esperarlas de verdad.
async function settle<T>(pending: Promise<T>): Promise<T> {
  let done = false;
  pending.then(
    () => (done = true),
    () => (done = true),
  );
  while (!done) {
    await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(1_000);
  }
  return pending;
}

const env = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;
let info: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.WOMPI_EVENTS_SECRET = SHARED_EVENTS_SECRET;
  process.env.NAILFEST_EVENTS_URL = NAILFEST_URL;
  process.env.RELAY_SHARED_SECRET = RELAY_SECRET;
  delete process.env.WOMPI_SHOPIFY_RELAY_URL;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...env };
});

const logged = (spy: ReturnType<typeof vi.spyOn>, text: string) =>
  spy.mock.calls.some((args: unknown[]) => String(args[0]).includes(text));

describe.skipIf(!hasDb)("webhook de Wompi: pedidos de la tienda (mt_)", () => {
  async function wompiOrder() {
    const brand = await createSellingBrand();
    const product = await createProduct(brand.id, { name: "Esmalte", price: 50000, stock: 5 });
    const { order, payment } = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: `wompi-${randomUUID().slice(0, 8)}@prueba.test`,
      items: [{ productId: product.id, quantity: 1 }],
    });
    if (payment.kind !== "wompi") throw new Error("esperaba Wompi");
    return { brand, product, order, payment };
  }
  const stockOf = async (productId: string) => (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stock;

  it("todo cobro de la tienda usa mt_ y va firmado con la llave de integridad de la marca", async () => {
    const { order, payment } = await wompiOrder();
    expect(order.reference.startsWith("mt_")).toBe(true);
    const { widget } = payment;
    expect(widget.reference).toBe(order.reference);
    expect(widget.signature).toBe(sha256(`${order.reference}${widget.amountInCents}COP${BRAND_INTEGRITY_KEY}`));
    expect(new URL(payment.checkoutUrl).searchParams.get("signature:integrity")).toBe(widget.signature);
  });

  it("con checksum inválido responde 401 y el pedido no cambia", async () => {
    const { product, order, payment } = await wompiOrder();
    const event = wompiEvent({ id: "tx-falsa", reference: order.reference, status: "APPROVED", amountInCents: payment.widget.amountInCents }, "otro_secreto");
    const res = await post(rawOf(event));
    expect(res.status).toBe(401);
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await stockOf(product.id)).toBe(5);
  });

  it("mt_: paga el pedido una sola vez aunque el evento llegue repetido, con las llaves con que se cobró", async () => {
    const { brand, product, order, payment } = await wompiOrder();
    // La marca cambió de modo después de cobrar: el evento de ESTE pedido
    // se verifica con las llaves de pruebas con que se creó.
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { paymentMode: "PRODUCTION" } });
    const raw = rawOf(
      wompiEvent({ id: "tx-mt-1", reference: order.reference, status: "APPROVED", amountInCents: payment.widget.amountInCents }, BRAND_EVENTS_KEY, "test"),
    );

    expect((await post(raw)).status).toBe(200);
    expect((await post(raw)).status).toBe(200);

    const paid = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: "PAID", wompiTransactionId: "tx-mt-1", wompiStatus: "APPROVED" });
    expect(await stockOf(product.id)).toBe(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("al volver de Wompi con ?id= consulta la transacción con la llave pública y paga; el webhook después no duplica", async () => {
    const { product, order, payment } = await wompiOrder();
    const amountInCents = payment.widget.amountInCents;
    fetchMock.mockImplementation(async (url: string) =>
      url === "https://sandbox.wompi.co/v1/transactions/tx-ret-1"
        ? Response.json({ data: { id: "tx-ret-1", status: "APPROVED", reference: order.reference, amount_in_cents: amountInCents } })
        : url === "https://sandbox.wompi.co/v1/transactions/tx-ajena"
          ? Response.json({ data: { id: "tx-ajena", status: "APPROVED", reference: "mt_otro-pedido", amount_in_cents: amountInCents } })
          : new Response("no", { status: 404 }),
    );
    const status = (id: string) =>
      orderStatusRoute(new Request(`https://tienda.marcolini.lat/api/tienda/pedidos/${order.id}/estado?id=${id}`), {
        params: Promise.resolve({ orderId: order.id }),
      });

    // Una transacción aprobada pero de otro pedido no lo paga.
    expect(await (await status("tx-ajena")).json()).toEqual({ status: "PENDING" });
    expect(await (await status("tx-ret-1")).json()).toEqual({ status: "PAID" });
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/tx-ret-1"))!;
    expect((init as RequestInit).headers).toEqual({ Authorization: "Bearer pub_test_x" });

    const raw = rawOf(wompiEvent({ id: "tx-ret-1", reference: order.reference, status: "APPROVED", amountInCents }, BRAND_EVENTS_KEY, "test"));
    expect((await post(raw)).status).toBe(200);
    expect(await stockOf(product.id)).toBe(4);
  });
});

describe("webhook de Wompi: lo que es de otras apps", () => {
  const nfEvent = (secret = SHARED_EVENTS_SECRET) =>
    wompiEvent({ id: "tx-nf-1", reference: "NF-2026-000123", status: "APPROVED", amountInCents: 15000000 }, secret);

  it("NF- con checksum inválido: 401 y no se reenvía nada", async () => {
    const res = await post(rawOf(nfEvent("otro_secreto")));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("NF-: reenvía el body intacto a Nail Fest con x-relay-secret, y reintenta si falla", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    fetchMock.mockResolvedValueOnce(new Response("error", { status: 500 })).mockResolvedValueOnce(new Response("ok"));
    const raw = rawOf(nfEvent());

    const res = await settle(post(raw, { "x-event-checksum": "ABC123" }));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe(NAILFEST_URL);
      expect(init).toMatchObject({
        method: "POST",
        body: raw,
        headers: { "content-type": "application/json", "x-relay-secret": RELAY_SECRET, "x-event-checksum": "ABC123" },
      });
    }
    expect(error).not.toHaveBeenCalled();
  });

  it("NF-: si Nail Fest nunca responde bien, son 4 intentos, igual 200 a Wompi y queda el error", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    const res = await settle(post(rawOf(nfEvent())));

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(logged(error, "No se pudo reenviar a Nail Fest el evento de NF-2026-000123 (transacción tx-nf-1) tras 4 intentos")).toBe(true);
  });

  it("NF-: un 401 de Nail Fest no se reintenta (reintentar no lo arregla)", async () => {
    fetchMock.mockResolvedValue(new Response("x-relay-secret inválido", { status: 401 }));
    expect((await post(rawOf(nfEvent()))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logged(error, "tras 1 intento: respondió 401")).toBe(true);
  });

  it("referencia desconocida sin WOMPI_SHOPIFY_RELAY_URL: 200, solo queda en el log", async () => {
    const event = wompiEvent({ id: "tx-shop-1", reference: "8f3a91c2d4", status: "APPROVED", amountInCents: 9900000 }, "secreto_de_otra_cuenta");
    expect((await post(rawOf(event))).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logged(info, "referencia desconocida, ignorada: 8f3a91c2d4")).toBe(true);

    // Una muestra o caja PR nunca se cobra por Wompi: tampoco se reenvía.
    const sample = wompiEvent({ id: "tx-s", reference: "prbox_123", status: "APPROVED", amountInCents: 0 }, "x");
    expect((await post(rawOf(sample))).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("referencia desconocida con WOMPI_SHOPIFY_RELAY_URL: se reenvía intacta, sin verificar y sin x-relay-secret", async () => {
    process.env.WOMPI_SHOPIFY_RELAY_URL = SHOPIFY_URL;
    fetchMock.mockResolvedValue(new Response("ok"));
    // Firmado con el secreto de otra cuenta: no se verifica.
    const raw = rawOf(wompiEvent({ id: "tx-shop-2", reference: "8f3a91c2d5", status: "APPROVED", amountInCents: 9900000 }, "secreto_de_otra_cuenta"));

    expect((await post(raw)).status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SHOPIFY_URL);
    expect(init).toMatchObject({ method: "POST", body: raw });
    expect((init as RequestInit).headers).toEqual({ "content-type": "application/json" });
  });
});
