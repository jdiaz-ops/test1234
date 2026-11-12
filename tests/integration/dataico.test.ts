import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyWompiTransactionStatus } from "@/server/services/store-order-service";
import { dataicoDate, describeDataicoError, issueOrderInvoice, saveDataicoConnection } from "@/server/services/dataico-service";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

type Call = { url: string; headers: Record<string, string>; body: { actions: Record<string, unknown>; invoice: Record<string, unknown> } | null };
let calls: Call[] = [];
let responder: (call: Call) => Response;
/// GET /invoices?number=: los números consultados y qué contesta Dataico
/// (por defecto, que no existe).
let lookups: string[] = [];
let lookup: (number: string) => Response;

/// Una factura nueva de Dataico, con su propio uuid y CUFE: la base de
/// pruebas guarda las de corridas anteriores, y una repetida sería "de
/// otra compra".
const newInvoice = (number: string) => {
  const id = randomUUID();
  return Response.json(
    { uuid: `uuid-${id}`, number, cufe: `cufe-${id}`, pdf_url: "https://dataico.com/x.pdf", dian_status: "DIAN_ACEPTADO" },
    { status: 201 },
  );
};
const notFound = () => Response.json({ errors: [{ error: "Factura no encontrada" }] }, { status: 404 });

beforeEach(() => {
  calls = [];
  lookups = [];
  responder = () => newInvoice("FE10001");
  lookup = notFound;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      // La consulta del medio de pago a Wompi no hace falta en la prueba.
      if (url.includes("wompi.co")) return new Response("{}", { status: 404 });
      if ((init.method ?? "GET") === "GET" && url.includes("/invoices?number=")) {
        const number = new URL(url).searchParams.get("number")!;
        lookups.push(number);
        return lookup(number);
      }
      const call = { url, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : null };
      calls.push(call);
      return responder(call);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

/// Dataico solo existe para la tienda de H la Cosedora (DATAICO_STORE_SLUGS):
/// la marca de prueba toma ese link (y se lo quita a la de la prueba
/// anterior, porque el link es único).
async function cosedoraBrand() {
  const brand = await createBrand();
  await prisma.brandProfile.updateMany({
    where: { storefrontSlug: "hlacosedora" },
    data: { storefrontSlug: `antes-hlacosedora-${brand.id}` },
  });
  return prisma.brandProfile.update({ where: { id: brand.id }, data: { storefrontSlug: "hlacosedora" } });
}

async function paidOrder(opts: { billing?: { type: string; number: string; name?: string }; otherStore?: boolean } = {}) {
  const brand = opts.otherStore ? await createBrand() : await cosedoraBrand();
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
    expect(saved).toMatchObject({ einvoiceStatus: "ISSUED", einvoiceNumber: "FE10001", einvoiceUuid: expect.stringMatching(/^uuid-/), einvoicePdfUrl: "https://dataico.com/x.pdf" });
    // Antes de facturar se confirmó en Dataico que el número estaba libre.
    expect(lookups).toEqual(["FE10001"]);

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

  it("manda el departamento y la ciudad en código DANE junto con la dirección", async () => {
    const { order } = await paidOrder({ billing: { type: "CE", number: "454003" } });
    await prisma.storeOrder.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), shippingAddress: "Calle 10 # 43-12", shippingCity: "Medellin", shippingRegion: "Antioquia" },
    });
    await issueOrderInvoice(order.id);
    expect(calls[0].body!.invoice.customer).toMatchObject({ address_line: "Calle 10 # 43-12", department: "05", city: "001" });
    expect(calls[0].body!.invoice.notes).toEqual([expect.stringMatching(/^Pedido #\w+$/)]);
  });

  it("si la ciudad no se reconoce factura sin dirección en vez de fallar", async () => {
    const { order } = await paidOrder({ billing: { type: "CC", number: "1020304050" } });
    await prisma.storeOrder.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: new Date(), shippingAddress: "Calle 1", shippingCity: "Ciudad Inventada", shippingRegion: "Antioquia" },
    });
    await issueOrderInvoice(order.id);
    const customer = calls[0].body!.invoice.customer as Record<string, unknown>;
    expect(customer).not.toHaveProperty("address_line");
    expect(customer).not.toHaveProperty("department");
  });

  it("en las demás tiendas no factura nada (módulo solo de H la Cosedora)", async () => {
    const { order } = await paidOrder({ otherStore: true });
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    expect((await issueOrderInvoice(order.id)).status).toBe("SKIPPED");
    expect(calls).toHaveLength(0);
  });

  it("si Dataico lo rechaza queda el error y se puede reintentar con el mismo número", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    responder = () => new Response(JSON.stringify({ errors: { customer: ["inválido"] } }), { status: 500 });
    const first = await issueOrderInvoice(order.id);
    expect(first.status).toBe("FAILED");
    let saved = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.einvoiceError).toContain("customer");

    responder = () => newInvoice("FE10001");
    expect((await issueOrderInvoice(order.id)).status).toBe("ISSUED");
    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10001", "10001"]);
    // El reintento manda el mismo número sin volver a consultarlo: si la
    // primera vez se alcanzó a crear, Dataico devuelve esa misma factura.
    expect(lookups).toEqual(["FE10001"]);
    saved = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.einvoiceStatus).toBe("ISSUED");
  });

  it("la factura lleva la fecha en que se emite, no la del pago (la DIAN lo exige: regla FAD09e)", async () => {
    const { order } = await paidOrder();
    const paidAt = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt } });

    await issueOrderInvoice(order.id);

    const invoice = calls[0].body!.invoice as { issue_date: string; payment_date: string };
    expect(invoice.issue_date.slice(0, 10)).toBe(dataicoDate(new Date()).slice(0, 10));
    expect(invoice.issue_date.slice(0, 10)).not.toBe(dataicoDate(paidAt).slice(0, 10));
    expect(invoice.payment_date).toBe(invoice.issue_date);
  });

  it("una rechazada por la DIAN se reenvía con el mismo número al reintentar, sin crear otra", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    const uuid = `uuid-${randomUUID()}`;
    responder = () => Response.json({ uuid, number: "FE10001", cufe: `cufe-${uuid}`, dian_status: "DIAN_RECHAZADO" }, { status: 201 });
    expect((await issueOrderInvoice(order.id)).status).toBe("FAILED");
    expect(await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      einvoiceStatus: "FAILED",
      einvoiceNumber: "FE10001",
      einvoiceUuid: uuid,
    });

    // Corregida en Dataico: el reintento manda el mismo número y Dataico
    // devuelve esa misma factura, ya aceptada.
    responder = () =>
      Response.json({ uuid, number: "FE10001", cufe: `cufe2-${uuid}`, pdf_url: "https://dataico.com/y.pdf", dian_status: "DIAN_ACEPTADO" }, { status: 201 });
    expect((await issueOrderInvoice(order.id)).status).toBe("ISSUED");

    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10001", "10001"]);
    expect(lookups).toEqual(["FE10001"]);
    expect(await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      einvoiceStatus: "ISSUED",
      einvoiceNumber: "FE10001",
      einvoiceUuid: uuid,
      einvoicePdfUrl: "https://dataico.com/y.pdf",
      einvoiceError: null,
    });
  });

  it("al reenviar un número que ya había mandado, si Dataico dice que existe no salta a otro (sería otra factura)", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    responder = () => new Response(JSON.stringify({ errors: { customer: ["inválido"] } }), { status: 500 });
    expect((await issueOrderInvoice(order.id)).status).toBe("FAILED");

    responder = () => new Response(JSON.stringify({ errors: { number: ["El número ya existe (duplicado)"] } }), { status: 500 });
    const again = await issueOrderInvoice(order.id);

    expect(again).toMatchObject({ status: "FAILED", error: expect.stringContaining("FE10001 ya existe") });
    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10001", "10001"]);
  });

  it("si el número ya existe en Dataico usa el siguiente", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    responder = (call) =>
      call.body!.invoice.number === "10001"
        ? new Response(JSON.stringify({ errors: { number: ["El número ya existe (duplicado)"] } }), { status: 500 })
        : newInvoice("FE10002");
    expect((await issueOrderInvoice(order.id)).status).toBe("ISSUED");
    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10001", "10002"]);
  });

  it("salta los números que ya se usaron en Dataico (facturas hechas a mano) y pone al día el contador", async () => {
    const { brand, order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    // En Dataico ya van hasta la FE10013, hechas a mano; Marcolini iba en la 10001.
    lookup = (number) => (Number(number.replace("FE", "")) <= 10013 ? Response.json({ invoice: { number, uuid: `manual-${number}` } }) : notFound());
    responder = () => newInvoice("FE10014");

    expect((await issueOrderInvoice(order.id)).status).toBe("ISSUED");

    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10014"]);
    expect(lookups.length).toBeLessThan(12);
    expect((await prisma.dataicoConnection.findUniqueOrThrow({ where: { brandId: brand.id } })).nextNumber).toBe(10015);
    expect(await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ einvoiceStatus: "ISSUED", einvoiceNumber: "FE10014" });
  });

  it("si Dataico devuelve la factura de otra compra, no la guarda y usa el siguiente número", async () => {
    const { brand, order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    // Otro pedido ya tiene la FE10001.
    const product = await createProduct(brand.id, { name: "Otra", price: 5000, stock: 5 });
    const other = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 5000 }]);
    const theirs = `uuid-${randomUUID()}`;
    await prisma.storeOrder.update({
      where: { id: other.id },
      data: { status: "PAID", einvoiceStatus: "ISSUED", einvoiceUuid: theirs, einvoiceNumber: "FE10001" },
    });
    responder = (call) =>
      call.body!.invoice.number === "10001"
        ? Response.json({ uuid: theirs, number: "FE10001", cufe: "cufe-de-la-otra" }, { status: 201 })
        : call.body!.invoice.number === "10002"
          ? // Hecha a mano en Dataico: trae otra referencia de pedido.
            Response.json({ invoice: { uuid: `uuid-${randomUUID()}`, number: "FE10002", order_reference: "#OTRA0002" } }, { status: 201 })
          : newInvoice("FE10003");

    expect((await issueOrderInvoice(order.id)).status).toBe("ISSUED");

    expect(calls.map((c) => c.body!.invoice.number)).toEqual(["10001", "10002", "10003"]);
    const saved = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved.einvoiceNumber).toBe("FE10003");
    expect(saved.einvoiceUuid).not.toBe(theirs);
  });

  it("si no se puede confirmar en Dataico que el número esté libre, no factura y queda para reintentar", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date() } });
    lookup = () => new Response("Service Unavailable", { status: 503 });

    expect((await issueOrderInvoice(order.id)).status).toBe("FAILED");

    expect(calls).toHaveLength(0);
    const saved = await prisma.storeOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({ einvoiceStatus: "FAILED", einvoiceUuid: null });
    expect(saved.einvoiceError).toContain("No pudimos confirmar en Dataico que el número FE10001 esté libre");
  });

  it("no factura en producción un pedido hecho en modo de prueba de Wompi", async () => {
    const { order } = await paidOrder();
    await prisma.storeOrder.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), paymentMode: "TEST" } });
    expect((await issueOrderInvoice(order.id)).status).toBe("SKIPPED");
    expect(calls).toHaveLength(0);
  });
});
