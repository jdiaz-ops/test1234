import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  applyPaymentResult,
  createStoreOrder,
  reconcilePendingOrders,
} from "@/server/services/store-order-service";
import { BrandPaymentError, removeGatewayCredentials, saveGatewayCredentials } from "@/server/services/brand-payment-service";
import { gatewayStatus, getActivePaymentGateway, storedCredentials } from "@/server/payments/credentials";
import { payuConfirmationSignature } from "@/server/payments/providers/payu";
import { epaycoSignature } from "@/server/payments/providers/epayco";
import { POST as createOrderRoute } from "@/app/api/tienda/[slug]/ordenes/route";
import { GET as orderStatusRoute } from "@/app/api/tienda/pedidos/[orderId]/estado/route";
import { POST as payuWebhook } from "@/app/api/webhooks/payu/route";
import { POST as epaycoWebhook } from "@/app/api/webhooks/epayco/route";
import { POST as mercadoPagoWebhook } from "@/app/api/webhooks/mercadopago/[brandId]/route";
import { POST as boldWebhook } from "@/app/api/webhooks/bold/[brandId]/route";
import { BUYER, createBrand, createPendingOrder, createProduct, createSellingBrand, hasDb } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

const email = (n: string) => `${n}-${Math.random().toString(36).slice(2, 8)}@prueba.test`;

type Provider = "MERCADO_PAGO" | "PAYU" | "EPAYCO" | "BOLD";

/// Marca lista para vender con otra pasarela (su zona de envío la pone
/// createSellingBrand).
async function brandWith(provider: Provider, credentials: Record<string, Record<string, Record<string, string>>>) {
  const brand = await createSellingBrand();
  return prisma.brandProfile.update({
    where: { id: brand.id },
    data: { paymentProvider: provider, paymentMode: "TEST", gatewayCredentials: credentials },
  });
}

const post = (slug: string, body: unknown) =>
  createOrderRoute(
    new Request(`http://localhost/api/tienda/${slug}/ordenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": `10.8.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );

function formRequest(url: string, fields: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

/// /users/me de Mercado Pago: una cuenta de verdad o una de prueba.
function stubMercadoPagoUser(kind: "live" | "test" | "invalid") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toBe("https://api.mercadopago.com/users/me");
      if (kind === "invalid") return new Response(JSON.stringify({ message: "invalid access token" }), { status: 401 });
      const me = kind === "test" ? { id: 1, nickname: "TESTUSER123", tags: ["test_user", "normal"] } : { id: 2, nickname: "MARCA", tags: ["normal"] };
      return new Response(JSON.stringify(me), { status: 200 });
    }),
  );
}

describe.skipIf(!hasDb)("llaves por pasarela", () => {
  it("se guardan por entorno, se conservan al cambiar de pasarela y no dejan cobrar de verdad sin producción", async () => {
    stubMercadoPagoUser("live");
    const brand = await createBrand();
    await saveGatewayCredentials(brand.userId, {
      provider: "MERCADO_PAGO",
      paymentMode: "TEST",
      credentials: { TEST: { accessToken: "TEST-abc123" } },
    });
    let profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.paymentProvider).toBe("MERCADO_PAGO");
    expect(gatewayStatus(profile, "MERCADO_PAGO")).toBe("TEST");
    expect(getActivePaymentGateway(profile)).toEqual({ provider: "MERCADO_PAGO", mode: "TEST", values: { accessToken: "TEST-abc123" } });

    await expect(
      saveGatewayCredentials(brand.userId, { provider: "MERCADO_PAGO", paymentMode: "PRODUCTION", credentials: {} }),
    ).rejects.toBeInstanceOf(BrandPaymentError);
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.paymentMode).toBe("TEST");

    await saveGatewayCredentials(brand.userId, {
      provider: "MERCADO_PAGO",
      paymentMode: "PRODUCTION",
      credentials: { PRODUCTION: { accessToken: "APP_USR-xyz", webhookSecret: "sec" } },
    });
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(gatewayStatus(profile, "MERCADO_PAGO")).toBe("ACTIVE");
    expect(storedCredentials(profile, "MERCADO_PAGO", "TEST")).toEqual({ accessToken: "TEST-abc123" });

    // "" borra una llave, lo que no viene se conserva.
    await saveGatewayCredentials(brand.userId, {
      provider: "MERCADO_PAGO",
      paymentMode: "PRODUCTION",
      credentials: { PRODUCTION: { webhookSecret: "" } },
    });
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(storedCredentials(profile, "MERCADO_PAGO", "PRODUCTION")).toEqual({ accessToken: "APP_USR-xyz" });

    // ePayco usa las mismas llaves para probar y para cobrar; al pasar a
    // ella, las de Mercado Pago siguen guardadas.
    await saveGatewayCredentials(brand.userId, {
      provider: "EPAYCO",
      paymentMode: "TEST",
      credentials: { SHARED: { publicKey: "pk", custId: "123", pKey: "pkey" } },
    });
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.paymentProvider).toBe("EPAYCO");
    expect(gatewayStatus(profile, "EPAYCO")).toBe("TEST");
    expect(getActivePaymentGateway(profile)).toMatchObject({ provider: "EPAYCO", values: { publicKey: "pk", custId: "123", pKey: "pkey" } });
    expect(storedCredentials(profile, "MERCADO_PAGO", "PRODUCTION")).toEqual({ accessToken: "APP_USR-xyz" });

    // Wompi por la misma puerta, a sus columnas de siempre.
    await saveGatewayCredentials(brand.userId, {
      provider: "WOMPI",
      paymentMode: "TEST",
      credentials: { TEST: { publicKey: "pub_test_1", privateKey: "prv_test_1", eventsKey: "test_events_1", integrityKey: "test_integrity_1" } },
    });
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.paymentProvider).toBe("WOMPI");
    expect(profile.wompiPublicKeyTest).toBe("pub_test_1");
    expect(gatewayStatus(profile, "WOMPI")).toBe("TEST");
  });
});

describe.skipIf(!hasDb)("Mercado Pago: llave de prueba o de verdad", () => {
  // Las de prueba nuevas también empiezan por APP_USR-: se le pregunta a
  // Mercado Pago de qué cuenta es antes de guardar.
  it("no deja una llave de verdad en prueba ni una de prueba en producción", async () => {
    const brand = await createBrand();
    const save = (scope: "TEST" | "PRODUCTION") =>
      saveGatewayCredentials(brand.userId, {
        provider: "MERCADO_PAGO",
        paymentMode: scope,
        credentials: { [scope]: { accessToken: "APP_USR-1234" } },
      });

    stubMercadoPagoUser("live");
    await expect(save("TEST")).rejects.toThrow(/es de producción/);
    stubMercadoPagoUser("test");
    await expect(save("PRODUCTION")).rejects.toThrow(/es de prueba/);
    stubMercadoPagoUser("invalid");
    await expect(save("TEST")).rejects.toThrow(/no reconoce/);
    let profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(storedCredentials(profile, "MERCADO_PAGO", "TEST")).toBeNull();

    stubMercadoPagoUser("test");
    await save("TEST");
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(getActivePaymentGateway(profile)).toEqual({ provider: "MERCADO_PAGO", mode: "TEST", values: { accessToken: "APP_USR-1234" } });

    // Si Mercado Pago no contesta, no se frena el guardado.
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("sin red"); }));
    await save("PRODUCTION");
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.paymentMode).toBe("PRODUCTION");
  });
});

describe.skipIf(!hasDb)("quitar llaves", () => {
  // "¿Cómo hago para quitar mi cuenta de prueba?" (2026-10-19).
  it("sin llaves completas la tienda vuelve a sin pasarela; sin las de producción deja de cobrar de verdad", async () => {
    stubMercadoPagoUser("live");
    const brand = await createBrand();
    await saveGatewayCredentials(brand.userId, {
      provider: "MERCADO_PAGO",
      paymentMode: "PRODUCTION",
      credentials: { TEST: { accessToken: "TEST-1" }, PRODUCTION: { accessToken: "APP_USR-2" } },
    });

    let profile = await removeGatewayCredentials(brand.userId, "MERCADO_PAGO", "PRODUCTION");
    expect(profile).toMatchObject({ paymentProvider: "MERCADO_PAGO", paymentMode: "TEST" });
    expect(storedCredentials(profile, "MERCADO_PAGO", "PRODUCTION")).toBeNull();
    expect(storedCredentials(profile, "MERCADO_PAGO", "TEST")).toEqual({ accessToken: "TEST-1" });

    profile = await removeGatewayCredentials(brand.userId, "MERCADO_PAGO", "TEST");
    expect(profile).toMatchObject({ paymentProvider: "NONE", paymentMode: "TEST" });
    expect(storedCredentials(profile, "MERCADO_PAGO", "TEST")).toBeNull();

    // Wompi va en sus columnas.
    await saveGatewayCredentials(brand.userId, {
      provider: "WOMPI",
      paymentMode: "TEST",
      credentials: { TEST: { publicKey: "pub_test_1", privateKey: "prv_test_1", eventsKey: "test_events_1", integrityKey: "test_integrity_1" } },
    });
    profile = await removeGatewayCredentials(brand.userId, "WOMPI", "TEST");
    expect(profile).toMatchObject({ paymentProvider: "NONE", wompiPublicKeyTest: null, wompiPrivateKeyTest: null });
  });
});

describe.skipIf(!hasDb)("Mercado Pago", () => {
  it("crea la preferencia con el token de la marca, manda al comprador y el aviso confirma el pago consultándolo", async () => {
    const brand = await brandWith("MERCADO_PAGO", { MERCADO_PAGO: { TEST: { accessToken: "TEST-token" } } });
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: "pref-1", init_point: "https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=pref-1" }), { status: 201 });
      }),
    );
    const res = await post(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("mp"), items: [{ productId: placa.id, quantity: 1 }] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payment).toEqual({ kind: "redirect", provider: "MERCADO_PAGO", url: "https://www.mercadopago.com.co/checkout/v1/redirect?pref_id=pref-1" });
    const order = await prisma.storeOrder.findUniqueOrThrow({ where: { id: body.orderId } });
    expect(order).toMatchObject({ paymentProvider: "MERCADO_PAGO", paymentMode: "TEST", gatewayReference: "pref-1", status: "PENDING" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer TEST-token");
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.external_reference).toBe(order.reference);
    expect(sent.items[0].unit_price).toBe(order.totalCents / 100);
    expect(sent.back_urls.success).toBe(`https://${brand.storefrontSlug}.marcolini.lat/pedido/${order.id}`);
    expect(sent.notification_url.endsWith(`/api/webhooks/mercadopago/${brand.id}`)).toBe(true);
    // En prueba no va el comprador: con un correo de una cuenta real,
    // Mercado Pago cortaba con "una de las partes es de prueba".
    expect(sent.payer).toBeUndefined();

    // El aviso solo trae el id del pago: se consulta en Mercado Pago.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toBe("https://api.mercadopago.com/v1/payments/987");
        return new Response(JSON.stringify({ id: 987, status: "approved", external_reference: order.reference, live_mode: false }), { status: 200 });
      }),
    );
    const hook = await mercadoPagoWebhook(
      new Request(`http://localhost/api/webhooks/mercadopago/${brand.id}?data.id=987&type=payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payment.updated", type: "payment", data: { id: "987" }, live_mode: false }),
      }),
      { params: Promise.resolve({ brandId: brand.id }) },
    );
    expect(hook.status).toBe(200);
    const paid = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: "PAID", gatewayTransactionId: "987", gatewayStatus: "approved" });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(4);
  });

  it("con clave secreta guardada, un aviso sin firma válida se rechaza", async () => {
    const brand = await brandWith("MERCADO_PAGO", { MERCADO_PAGO: { TEST: { accessToken: "TEST-token", webhookSecret: "s3cr3t" } } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no debería llamar", { status: 500 })));
    const hook = await mercadoPagoWebhook(
      new Request(`http://localhost/api/webhooks/mercadopago/${brand.id}?data.id=1&type=payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-signature": "ts=1,v1=mala", "x-request-id": "r" },
        body: JSON.stringify({ type: "payment", data: { id: "1" }, live_mode: false }),
      }),
      { params: Promise.resolve({ brandId: brand.id }) },
    );
    expect(hook.status).toBe(401);
  });

  it("si Mercado Pago no responde al crear el cobro, el pedido queda fallido y el comprador puede reintentar", async () => {
    const brand = await brandWith("MERCADO_PAGO", { MERCADO_PAGO: { TEST: { accessToken: "TEST-token" } } });
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 1 });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 500 })));
    const items = [{ productId: placa.id, quantity: 1 }];
    await expect(createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("mp"), items })).rejects.toThrow(/Mercado Pago/);
    const failed = await prisma.storeOrder.findFirst({ where: { brandId: brand.id }, orderBy: { createdAt: "desc" } });
    expect(failed).toMatchObject({ status: "FAILED", gatewayStatus: "START_ERROR" });
    // La unidad no quedó apartada por el pedido fallido.
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "pref-2", init_point: "https://mp/pref-2" }), { status: 201 })));
    const again = await createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("mp2"), items });
    expect(again.order.status).toBe("PENDING");
  });
});

describe.skipIf(!hasDb)("PayU", () => {
  it("manda un formulario firmado al sandbox y la confirmación exige la firma de la marca", async () => {
    const apiKey = "4Vj8eK4rloUd272L48hsrarnUA";
    const brand = await brandWith("PAYU", { PAYU: { TEST: { merchantId: "508029", accountId: "512321", apiKey } } });
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const { order, payment } = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("payu"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    if (payment.kind !== "form") throw new Error("esperaba un formulario");
    expect(payment.url).toBe("https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/");
    const amount = String(order.totalCents / 100);
    expect(payment.fields).toMatchObject({
      merchantId: "508029",
      accountId: "512321",
      referenceCode: order.reference,
      amount,
      currency: "COP",
      test: "1",
      extra1: order.id,
    });
    expect(payment.fields.confirmationUrl.endsWith("/api/webhooks/payu")).toBe(true);
    expect(payment.fields.responseUrl).toBe(`https://${brand.storefrontSlug}.marcolini.lat/pedido/${order.id}`);

    const confirmation = (sign: string) => ({
      merchant_id: "508029",
      state_pol: "4",
      reference_sale: order.reference,
      value: `${amount}.00`,
      currency: "COP",
      sign,
      transaction_id: "tx-payu",
      response_message_pol: "APPROVED",
    });
    let res = await payuWebhook(formRequest("http://localhost/api/webhooks/payu", confirmation("mala")));
    expect(res.status).toBe(401);
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");

    const sign = payuConfirmationSignature({
      apiKey,
      merchantId: "508029",
      referenceSale: order.reference,
      value: `${amount}.00`,
      currency: "COP",
      statePol: "4",
    });
    res = await payuWebhook(formRequest("http://localhost/api/webhooks/payu", confirmation(sign)));
    expect(res.status).toBe(200);
    const paid = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: "PAID", gatewayTransactionId: "tx-payu", gatewayStatus: "4:APPROVED" });
  });
});

describe.skipIf(!hasDb)("ePayco", () => {
  it("abre su ventana con la referencia y la confirmación exige firma y monto", async () => {
    const brand = await brandWith("EPAYCO", { EPAYCO: { SHARED: { publicKey: "pub", custId: "9999", pKey: "secreta" } } });
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const { order, payment } = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("ep"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    if (payment.kind !== "epayco") throw new Error("esperaba la ventana de ePayco");
    expect(payment).toMatchObject({ publicKey: "pub", test: true });
    expect(payment.data.invoice).toBe(order.reference);
    expect(payment.data.amount).toBe(String(order.totalCents / 100));
    expect(payment.data.confirmation.endsWith("/api/webhooks/epayco")).toBe(true);

    const amount = String(order.totalCents / 100);
    const confirmation = (x_amount: string, x_signature?: string) => ({
      x_ref_payco: "ref1",
      x_transaction_id: "tx-ep",
      x_amount,
      x_currency_code: "COP",
      x_cod_response: "1",
      x_response: "Aceptada",
      x_id_invoice: order.reference,
      x_signature:
        x_signature ??
        epaycoSignature({ custId: "9999", pKey: "secreta", refPayco: "ref1", transactionId: "tx-ep", amount: x_amount, currency: "COP" }),
    });
    let res = await epaycoWebhook(formRequest("http://localhost/api/webhooks/epayco", confirmation("1")));
    expect(res.status).toBe(400);
    res = await epaycoWebhook(formRequest("http://localhost/api/webhooks/epayco", confirmation(amount, "0".repeat(64))));
    expect(res.status).toBe(401);
    res = await epaycoWebhook(formRequest("http://localhost/api/webhooks/epayco", confirmation(amount)));
    expect(res.status).toBe(200);
    const paid = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: "PAID", gatewayReference: "ref1", gatewayTransactionId: "tx-ep" });
  });
});

describe.skipIf(!hasDb)("Bold", () => {
  it("crea el link con la llave de la marca; el aviso y la conciliación confirman consultando el link", async () => {
    const brand = await brandWith("BOLD", { BOLD: { TEST: { apiKey: "ident", secretKey: "bold-secret" } } });
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const calls: { url: string; init?: RequestInit }[] = [];
    let linkStatus = "ACTIVE";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ payload: { payment_link: "LNK_1", url: "https://checkout.bold.co/payment/LNK_1" }, errors: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ payload: { status: linkStatus, transaction_id: "tx-bold", payment_method: "CARD" }, errors: [] }), { status: 200 });
      }),
    );
    const { order, payment } = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("bold"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    expect(payment).toEqual({ kind: "redirect", provider: "BOLD", url: "https://checkout.bold.co/payment/LNK_1" });
    expect(order.gatewayReference).toBe("LNK_1");
    expect(calls[0].url).toBe("https://integrations.api.bold.co/online/link/v1");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("x-api-key ident");
    const sent = JSON.parse(calls[0].init?.body as string);
    expect(sent.amount).toEqual({ currency: "COP", tip_amount: 0, total_amount: order.totalCents / 100 });
    expect(sent.callback_url).toBe(`https://${brand.storefrontSlug}.marcolini.lat/pedido/${order.id}`);

    // Mientras el link sigue activo, la conciliación no cambia nada.
    await reconcilePendingOrders(brand.id);
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");

    // Aviso con firma inválida: rechazado.
    const rawBody = JSON.stringify({ type: "SALE_APPROVED", data: { payment_id: "p1", metadata: { reference: "LNK_1" } } });
    const hookUrl = `http://localhost/api/webhooks/bold/${brand.id}`;
    let res = await boldWebhook(
      new Request(hookUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-bold-signature": "mala" }, body: rawBody }),
      { params: Promise.resolve({ brandId: brand.id }) },
    );
    expect(res.status).toBe(401);

    // Aviso firmado: se consulta el link y queda pagado.
    linkStatus = "PAID";
    const signature = createHmac("sha256", "bold-secret").update(Buffer.from(rawBody).toString("base64")).digest("hex");
    res = await boldWebhook(
      new Request(hookUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-bold-signature": signature }, body: rawBody }),
      { params: Promise.resolve({ brandId: brand.id }) },
    );
    expect(res.status).toBe(200);
    const paid = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid).toMatchObject({ status: "PAID", gatewayTransactionId: "tx-bold", gatewayStatus: "PAID" });
    expect(calls.some((c) => c.url === "https://integrations.api.bold.co/online/link/v1/LNK_1")).toBe(true);

    // Otro pedido que el comprador abandonó en la página de Bold: la
    // conciliación lo recoge cuando el link aparece pagado.
    const second = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("bold2"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    await reconcilePendingOrders(brand.id);
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: second.order.id } })).status).toBe("PAID");

    // Y la vuelta del comprador a la página del pedido también lo confirma.
    const third = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("bold3"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    const status = await orderStatusRoute(
      new Request(`http://localhost/api/tienda/pedidos/${third.order.id}/estado?bold-tx-status=approved&bold-order-id=LNK_1`),
      { params: Promise.resolve({ orderId: third.order.id }) },
    );
    expect(await status.json()).toEqual({ status: "PAID" });
  });
});

describe.skipIf(!hasDb)("resultado de la pasarela", () => {
  it("un pago pendiente no tumba el pedido y uno vencido que se confirma después pasa a Pagado", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 3 });
    const order = await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 1, unitPrice: 15000 }]);

    await applyPaymentResult({ reference: order.reference, transactionId: "t1", rawStatus: "PENDING", outcome: "PENDING" });
    let fresh = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh).toMatchObject({ status: "PENDING", gatewayTransactionId: "t1", gatewayStatus: "PENDING", wompiStatus: "PENDING" });

    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "EXPIRED" } });
    await applyPaymentResult({ reference: order.reference, transactionId: "t1", rawStatus: "APPROVED", outcome: "APPROVED" });
    fresh = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.status).toBe("PAID");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: placa.id } })).stock).toBe(2);

    // Un pedido ya pagado no se vuelve a procesar.
    await applyPaymentResult({ reference: order.reference, transactionId: "t1", rawStatus: "DECLINED", outcome: "DECLINED" });
    expect((await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PAID");
  });
});
