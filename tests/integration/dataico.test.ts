import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";
import { dataicoDate, describeDataicoError, issueOrderInvoice, saveDataicoConnection } from "@/server/services/dataico-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

type Call = { url: string; headers: Record<string, string>; body: { actions: Record<string, unknown>; invoice: Record<string, unknown> } | null };
let calls: Call[] = [];
let responder: (call: Call) => Response;

beforeEach(() => {
  calls = [];
  responder = () =>
    new Response(JSON.stringify({ uuid: "uuid-1", number: "FE10001", cufe: "cufe-1", pdf_url: "https://dataico.com/x.pdf", dian_status: "DIAN_ACEPTADO" }), {
      status: 201,
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      // La consulta del medio de pago a Wompi no hace falta en la prueba.
      if (url.includes("wompi.co")) return new Response("{}", { status: 404 });
      const call = { url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : null };
      calls.push(call);
      return responder(call);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function paidOrder(opts: { billing?: { type: string; number: string; name?: string } } = {}) {
  const brand = await createBrand();
  await saveDataicoConnection(brand.id, {
    accountId: "acct-1",
    authToken: "tok-1",
    env: "PRODUCCION",
    prefix: "FE",
    resolutionNumber: "18760000001",
    nextNumber: 10001,
    sendEmail: true,
    enabled: true,
  });
  const product = await createProduct(brand.id, { name: "Placa", price: 11900, stock: 5 });
  const order = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 2, unitPrice: 11900 }]);
  await prisma.storeOrder.update({
    where: { id: order.id },
    data: {
      paymentMode: "PRODUCTION",
      shippingCents: 1_000_000,
      totalCents: 2_380_000 + 1_000_000,
      ...(opts.billing
        ? { billingIdType: opts.billing.type, billingIdNumber: opts.billing.number, billingName: opts.billing.name ?? null }
        : {}),
    },
  });
  return { brand, order };
}

describe("formato Dataico", () => {
  it("fechas en hora de Colombia", () => {
    expect(dataicoDate(new Date("2026-10-01T03:04:05Z"))).toBe("30/09/2026 22:04:05");
  });
  it("explica los errores en español", () => {
    expect(describeDataicoError(500, { errors: { customer: { party_type: ["PERSONA_NATURAL requiere nombre y apellido"] } } })).toContain(
      "customer.party_type: PERSONA_NATURAL requiere nombre y apellido",
    );
    expect(describeDataicoError(401, null)).toContain("token");
  });
});

describe.skipIf(!hasDb)("factura electrónica con Dataico", () => {
  it("al pagarse un pedido emite la factura a consumidor final, sin IVA en el precio", async () => {
    const { order } = await paidOrder();
    await applyWompiTransactionStatus({ reference: order.reference, wompiTransactionId: "tx-1", wompiStatus: "APPROVED" });

    expect(calls).toHaveLength(1);
    const { url, headers, body } = calls[0];
    expect(url).toBe("https://api.dataico.com/dataico_api/v2/invoices");
    expect(headers["auth-token"]).toBe("tok-1");
    expect(body!.actions).toMatchObject({ send_dian: true, send_email: true, email: order.buyerEmail });
    expect(body!.invoice).toMatchObject({
      env: "PRODUCCION",
      dataico_account_id: "acct-1",
      number: "10001",
      numbering: { prefix: "FE", resolution_number: "18760000001", flexible: true },
      invoice_type_code: "FACTURA_VENTA",
      payment_means_type: "DEBITO",
      customer: { party_identification: "222222222222", party_type: "PERSONA_NATURAL" },
      charges: [{ "base-amount": 10000, reason: "Envío", discount: false }],
    });
    // 11.900 con IVA 19 % incluido → 10.000 sin IVA.
    expect((body!.invoice.items as Record<string, unknown>[])[0]).toMatchObject({
      quantity: 2,
      price: 10000,
      taxes: [{ "tax-category": "IVA", "tax-rate": 19 }],
    });

    const saved = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({ einvoiceStatus: "ISSUED", einvoiceNumber: "FE10001", einvoiceUuid: "uuid-1", einvoicePdfUrl: "https://dataico.com/x.pdf" });

    // Ya facturado: otro intento no crea otra factura.
    await issueOrderInvoice(order.id);
    expect(calls).toHaveLength(1);
  });

  it("con NIT factura a la empresa, sin dígito de verificación", async () => {
    const { order } = await paidOrder({ billing: { type: "NIT", number: "900123456-7", name: "Salón Uñas SAS" } });
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    await issueOrderInvoice(order.id);
    expect(calls[0].body!.invoice.customer).toMatchObject({
      party_identification: "900123456",
      party_identification_type: "NIT",
      party_type: "PERSONA_JURIDICA",
      company_name: "Salón Uñas SAS",
    });
  });

  it("si Dataico lo rechaza queda el error y se puede reintentar con el mismo número", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    responder = () => new Response(JSON.stringify({ errors: { customer: ["inválido"] } }), { status: 500 });
    const first = await issueOrderInvoice(order.id);
    expect(first.status).toBe("FAILED");
    let saved = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.einvoiceError).toContain("customer");

    responder = () => new Response(JSON.stringify({ uuid: "uuid-2", number: "FE10001" }), { status: 201 });
    expect((await issueOrderInvoice(order.id)).status).toBe("ISSUED");
    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10001", "10001"]);
    saved = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.einvoiceStatus).toBe("ISSUED");
  });

  it("si el número ya existe en Dataico usa el siguiente", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    responder = (call) =>
      call.body!.invoice.number === "10001"
        ? new Response(JSON.stringify({ errors: { number: ["El número ya existe (duplicado)"] } }), { status: 500 })
        : new Response(JSON.stringify({ uuid: "uuid-3", number: "FE10002" }), { status: 201 });
    expect((await issueOrderInvoice(order.id)).status).toBe("ISSUED");
    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10001", "10002"]);
  });

  it("no factura en producción un pedido hecho en modo de prueba de Wompi", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), paymentMode: "TEST" } });
    expect((await issueOrderInvoice(order.id)).status).toBe("SKIPPED");
    expect(calls).toHaveLength(0);
  });
});
