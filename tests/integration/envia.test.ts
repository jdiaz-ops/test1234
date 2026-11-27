import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La marca que entra al portal (las rutas la piden a la sesión).
const session = vi.hoisted(() => ({ profile: null as null | { id: string; storefrontSlug: string | null } }));
vi.mock("@/lib/current-brand", () => ({ requireBrandProfile: async () => session.profile }));

import { prisma } from "@/lib/prisma";
import {
  EnviaServiceError,
  cancelOrderLabel,
  createOrderLabel,
  quoteOrderShipping,
  refreshShippedEnviaOrders,
  saveEnviaConnection,
  type LabelInput,
} from "@/server/services/envia-service";
import { POST as webhookRoute } from "@/app/api/webhooks/envia/[secret]/route";
import { POST as orderEnviaRoute } from "@/app/api/marca/tienda/pedidos/envia/route";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

const TRACKING = "2300123456";
const LABEL_PDF = "https://s3.envia.com/labels/2300123456.pdf";
const TRACK_URL = "https://envia.com/rastreo?label=2300123456";

type Call = { url: string; method: string; auth: string | null; body: Record<string, unknown> | null };
let calls: Call[];
let deliveredStatus: string;

/// Envia de mentira: dos transportadoras en la cuenta; Coordinadora no
/// cotiza esa ruta.
function fakeEnvia(requested: string, init?: RequestInit): Response {
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
  const headers = (init?.headers ?? {}) as Record<string, string>;
  calls.push({ url: requested, method: init?.method ?? "GET", auth: headers.Authorization ?? null, body });
  // La cuenta de pruebas responde igual, en api-test y queries-test.
  const url = requested.replace("://api-test.", "://api.").replace("://queries-test.", "://queries.");
  if (headers.Authorization === "Bearer llave-vencida") return Response.json({ message: "Unauthorized" }, { status: 401 });

  if (url === "https://queries.envia.com/available-carrier/CO/0") {
    return Response.json({ data: [{ carrier: "servientrega", name: "Servientrega" }, { carrier: "coordinadora", name: "Coordinadora" }] });
  }
  if (url === "https://api.envia.com/ship/rate/") {
    const carrier = (body?.shipment as { carrier: string }).carrier;
    if (carrier === "coordinadora") {
      return Response.json({ meta: "error", error: { code: 1126, description: "Invalid Option" } }, { status: 400 });
    }
    return Response.json({
      meta: "rate",
      data: [
        { carrier, service: "express", serviceDescription: "Express", deliveryEstimate: "1 día", totalPrice: 18000, currency: "COP" },
        { carrier, service: "ground", serviceDescription: "Terrestre", deliveryEstimate: "2-3 días", totalPrice: 12500.5, currency: "COP" },
      ],
    });
  }
  if (url === "https://api.envia.com/ship/generate/") {
    const { carrier, service } = body?.shipment as { carrier: string; service: string };
    return Response.json({
      meta: "generate",
      data: [{ carrier, service, trackingNumber: TRACKING, label: LABEL_PDF, trackUrl: TRACK_URL, totalPrice: 12500.5, currency: "COP" }],
    });
  }
  if (url === "https://api.envia.com/ship/generaltrack/") {
    const numbers = (body?.trackingNumbers as string[]) ?? [];
    return Response.json({ data: numbers.map((n) => ({ trackingNumber: n, status: deliveredStatus })) });
  }
  if (url === "https://api.envia.com/ship/cancel/") {
    return Response.json({ data: { carrier: "servientrega", trackingNumber: TRACKING, balanceReturned: true } });
  }
  return Response.json({ message: "no existe" }, { status: 404 });
}

let emails: string[];

beforeEach(() => {
  calls = [];
  emails = [];
  deliveredStatus = "Delivered";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => fakeEnvia(String(url), init)));
  vi.spyOn(console, "info").mockImplementation(() => {});
  // Los correos simulados (sin llave de Resend) salen por console.log.
  vi.spyOn(console, "log").mockImplementation((text: unknown) => {
    const to = /\[email simulado\] Para: (\S+)/.exec(String(text))?.[1];
    if (to) emails.push(to);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  session.profile = null;
});

const ORIGIN = {
  sandbox: false,
  originName: "H la Cosedora",
  originPhone: "+57 300 123 4567",
  originStreet: "Calle 10 # 43-12",
  originRegion: "Antioquia",
  originCity: "medellin",
  packageLengthCm: 20,
  packageWidthCm: 15,
  packageHeightCm: 10,
  packageWeightGrams: 500,
  packageContent: "Productos para uñas",
};

const LABEL: LabelInput = {
  packageLengthCm: 20,
  packageWidthCm: 15,
  packageHeightCm: 10,
  packageWeightGrams: 500,
  declaredValue: 45000,
  destination: { street: "Carrera 43A # 1-50, apto 301", region: "Antioquia", city: "Envigado", reference: "Portería" },
};

/// Marca con Envia conectado y un pedido pagado para Envigado.
async function paidOrder() {
  const brand = await createBrand();
  await saveEnviaConnection(brand.id, { ...ORIGIN, apiToken: "llave-buena" });
  const product = await createProduct(brand.id, { name: "Esmalte", price: 45000, stock: 5 });
  const pending = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 45000 }]);
  const order = await prisma.storeOrder.update({
    where: { id: pending.id },
    data: { status: "PAID", paidAt: new Date(), buyerName: "Ana Muñoz", shippingCity: "Envigado" },
  });
  calls = [];
  return { brand, order };
}

const orderOf = (id: string) => prisma.storeOrder.findUniqueOrThrow({ where: { id } });

describe.skipIf(!hasDb)("guías con Envia desde el pedido", () => {
  it("conectar prueba la llave y guarda desde dónde se despacha", async () => {
    const brand = await createBrand();
    const result = await saveEnviaConnection(brand.id, { ...ORIGIN, apiToken: "llave-buena" });
    expect(result.carriers).toEqual(["Servientrega", "Coordinadora"]);
    expect(calls[0]).toMatchObject({ url: "https://queries.envia.com/available-carrier/CO/0", auth: "Bearer llave-buena" });
    const conn = await prisma.enviaConnection.findUniqueOrThrow({ where: { brandId: brand.id } });
    expect(conn).toMatchObject({ originCity: "Medellín", sandbox: false });
    expect(conn.webhookSecret).toMatch(/^[a-f0-9]{48}$/);

    // Sin llave nueva conserva la guardada; si Envia no la acepta, no se guarda.
    await saveEnviaConnection(brand.id, { ...ORIGIN, originName: "Bodega" });
    expect(await prisma.enviaConnection.findUniqueOrThrow({ where: { brandId: brand.id } })).toMatchObject({
      apiToken: "llave-buena",
      originName: "Bodega",
    });
    await expect(saveEnviaConnection(brand.id, { ...ORIGIN, apiToken: "llave-vencida" })).rejects.toThrow("Envia no aceptó la llave");
    await expect(saveEnviaConnection(brand.id, { ...ORIGIN, originCity: "Ciudad Inventada" })).rejects.toThrow(EnviaServiceError);
    // Pasar a la cuenta de pruebas pide su propia llave.
    await expect(saveEnviaConnection(brand.id, { ...ORIGIN, sandbox: true })).rejects.toThrow("pega la llave de esa cuenta");
  });

  it("cotiza con cada transportadora y crea la guía: el pedido queda enviado con su guía", async () => {
    const { brand, order } = await paidOrder();

    const quote = await quoteOrderShipping(brand.id, order.id, LABEL);
    expect(quote.quotes.map((q) => [q.carrierName, q.serviceName, q.priceCents])).toEqual([
      ["Servientrega", "Terrestre", 1250050],
      ["Servientrega", "Express", 1800000],
    ]);
    expect(quote.failed).toEqual(["Coordinadora"]);
    const rate = calls.find((c) => c.url === "https://api.envia.com/ship/rate/")!;
    expect(rate.auth).toBe("Bearer llave-buena");
    expect(rate.body).toMatchObject({
      origin: { name: "H la Cosedora", phone: "3001234567", city: "05001000", state: "AN", country: "CO", postalCode: "05001000" },
      destination: {
        name: "Ana Munoz",
        street: "Carrera 43A # 1-50, apto 301",
        city: "05266000",
        state: "AN",
        postalCode: "05266000",
        reference: "Porteria",
      },
      packages: [
        {
          type: "box",
          content: "Productos para unas",
          amount: 1,
          declaredValue: 45000,
          weight: 0.5,
          weightUnit: "KG",
          lengthUnit: "CM",
          dimensions: { length: 20, width: 15, height: 10 },
        },
      ],
      shipment: { type: 1 },
    });

    const label = await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    expect(label).toMatchObject({ carrier: "Servientrega", trackingNumber: TRACKING, labelUrl: LABEL_PDF });
    const generate = calls.find((c) => c.url === "https://api.envia.com/ship/generate/")!;
    expect(generate.body).toMatchObject({ shipment: { type: 1, carrier: "servientrega", service: "ground" } });

    const shipped = await orderOf(order.id);
    expect(shipped).toMatchObject({
      fulfillmentStatus: "SHIPPED",
      carrier: "Servientrega",
      trackingNumber: TRACKING,
      trackingUrl: TRACK_URL,
      enviaCarrier: "servientrega",
      enviaService: "ground",
      enviaLabelUrl: LABEL_PDF,
      enviaCostCents: 1250050,
      enviaStatus: "Created",
    });
    expect(shipped.shippedAt).not.toBeNull();
    expect(emails).toContain(order.buyerEmail);

    // Una sola guía por pedido.
    await expect(createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" })).rejects.toThrow(
      "ya tiene guía",
    );
    expect(calls.filter((c) => c.url.endsWith("/ship/generate/"))).toHaveLength(1);
  });

  it("dos clics seguidos compran una sola guía", async () => {
    const { brand, order } = await paidOrder();
    // Envia se demora creando la guía: el segundo clic llega mientras tanto.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (String(url).endsWith("/ship/generate/")) await new Promise((resolve) => setTimeout(resolve, 150));
        return fakeEnvia(String(url), init);
      }),
    );
    const input = { ...LABEL, carrier: "servientrega", service: "ground" };
    const results = await Promise.allSettled([createOrderLabel(brand.id, order.id, input), createOrderLabel(brand.id, order.id, input)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(String(rejected?.reason)).toContain("ya se está creando");
    expect(calls.filter((c) => c.url.endsWith("/ship/generate/"))).toHaveLength(1);
  });

  it("si Envia falla al crear la guía, el pedido queda como estaba y se puede reintentar", async () => {
    const { brand, order } = await paidOrder();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "Insufficient balance" }, { status: 402 })),
    );
    await expect(createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" })).rejects.toThrow(
      "No tienes saldo suficiente en Envia",
    );
    expect(await orderOf(order.id)).toMatchObject({ fulfillmentStatus: "UNFULFILLED", enviaCarrier: null, enviaLabelAt: null });
  });

  it("el aviso de Envia pasa el pedido a entregado, consultando el estado con la llave de la marca", async () => {
    const { brand, order } = await paidOrder();
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    const conn = await prisma.enviaConnection.findUniqueOrThrow({ where: { brandId: brand.id } });
    calls = [];

    const post = (secret: string, payload: unknown) =>
      webhookRoute(new Request(`https://marcolini.lat/api/webhooks/envia/${secret}`, { method: "POST", body: JSON.stringify(payload) }), {
        params: Promise.resolve({ secret }),
      });

    expect((await post("0".repeat(48), { trackingNumber: TRACKING })).status).toBe(404);
    // Aunque el aviso diga otra cosa, manda lo que responde Envia.
    deliveredStatus = "In Transit";
    expect((await post(conn.webhookSecret, { data: { tracking_number: TRACKING, status: "Delivered" } })).status).toBe(200);
    expect(await orderOf(order.id)).toMatchObject({ fulfillmentStatus: "SHIPPED", enviaStatus: "In Transit" });

    deliveredStatus = "Delivered";
    expect((await post(conn.webhookSecret, { data: { trackingNumber: TRACKING } })).status).toBe(200);
    const delivered = await orderOf(order.id);
    expect(delivered).toMatchObject({ fulfillmentStatus: "DELIVERED", enviaStatus: "Delivered" });
    expect(delivered.deliveredAt).not.toBeNull();
    expect(calls.every((c) => c.auth === "Bearer llave-buena")).toBe(true);
    expect((await prisma.enviaConnection.findUniqueOrThrow({ where: { id: conn.id } })).lastWebhookAt).not.toBeNull();
  });

  it("anular la guía deja el pedido preparado y sin guía, para crear otra", async () => {
    const { brand, order } = await paidOrder();
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    expect(await cancelOrderLabel(brand.id, order.id)).toEqual({ balanceReturned: true });
    expect(calls.find((c) => c.url.endsWith("/ship/cancel/"))?.body).toEqual({ carrier: "servientrega", trackingNumber: TRACKING });
    expect(await orderOf(order.id)).toMatchObject({
      fulfillmentStatus: "PREPARED",
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      enviaCarrier: null,
      enviaLabelUrl: null,
    });
    // Se puede crear otra.
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    expect((await orderOf(order.id)).fulfillmentStatus).toBe("SHIPPED");
  });

  it("el repaso diario pasa a entregado lo que Envia ya entregó", async () => {
    const { brand, order } = await paidOrder();
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    const result = await refreshShippedEnviaOrders();
    expect(result.delivered).toBeGreaterThanOrEqual(1);
    expect((await orderOf(order.id)).fulfillmentStatus).toBe("DELIVERED");
  });

  it("con la cuenta de pruebas de Envia, la compradora no recibe correo de una guía de mentira", async () => {
    const { brand, order } = await paidOrder();
    await saveEnviaConnection(brand.id, { ...ORIGIN, sandbox: true, apiToken: "llave-de-pruebas" });
    calls = [];
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    expect(calls.every((c) => c.url.startsWith("https://api-test.envia.com/") || c.url.startsWith("https://queries-test.envia.com/"))).toBe(
      true,
    );
    expect(calls.map((c) => c.auth)).toContain("Bearer llave-de-pruebas");
    expect((await orderOf(order.id)).fulfillmentStatus).toBe("SHIPPED");
    expect(emails).not.toContain(order.buyerEmail);
  });

  it("si Envia está caído al conectar se guarda igual, y al cotizar usa las transportadoras de siempre", async () => {
    const brand = await createBrand();
    const down = vi.fn(async (url: string, init?: RequestInit) =>
      String(url).includes("available-carrier") ? new Response("Bad gateway", { status: 502 }) : fakeEnvia(String(url), init),
    );
    vi.stubGlobal("fetch", down);
    expect(await saveEnviaConnection(brand.id, { ...ORIGIN, apiToken: "llave-buena" })).toEqual({ carriers: [], verified: false });

    const product = await createProduct(brand.id, { name: "Esmalte", price: 45000, stock: 5 });
    const pending = await createPendingOrder(brand.id, [{ productId: product.id, quantity: 1, unitPrice: 45000 }]);
    await prisma.storeOrder.update({ where: { id: pending.id }, data: { status: "PAID", paidAt: new Date() } });
    calls = [];
    const quote = await quoteOrderShipping(brand.id, pending.id, LABEL);
    expect(quote.quotes.length).toBeGreaterThan(0);
    const rated = calls.filter((c) => c.url.endsWith("/ship/rate/")).map((c) => (c.body?.shipment as { carrier: string }).carrier);
    expect(rated).toEqual(["interrapidisimo", "servientrega", "coordinadora", "envia", "tcc", "deprisa"]);
  });

  it("con una sola transportadora elegida, solo se cotiza y se crea la guía con esa", async () => {
    const { brand, order } = await paidOrder();
    await saveEnviaConnection(brand.id, { ...ORIGIN, carrier: "interrapidisimo" });
    calls = [];
    const quote = await quoteOrderShipping(brand.id, order.id, LABEL);
    expect(quote.quotes.map((q) => q.carrierName)).toEqual(["Interrapidísimo", "Interrapidísimo"]);
    expect(calls.map((c) => c.url)).toEqual(["https://api.envia.com/ship/rate/"]);
    expect(calls[0].body).toMatchObject({ shipment: { carrier: "interrapidisimo" } });

    await expect(createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" })).rejects.toThrow(
      "solo con Interrapidísimo",
    );
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "interRapidisimo", service: "ground" });
    expect(await orderOf(order.id)).toMatchObject({ carrier: "Interrapidísimo", enviaCarrier: "interrapidisimo", fulfillmentStatus: "SHIPPED" });
  });

  it("solo las marcas con Envia habilitado pueden usar la ruta del pedido", async () => {
    const { brand, order } = await paidOrder();
    const send = (body: unknown) =>
      orderEnviaRoute(new Request("https://marcolini.lat/api/marca/tienda/pedidos/envia", { method: "POST", body: JSON.stringify(body) }));

    session.profile = { id: brand.id, storefrontSlug: brand.storefrontSlug };
    expect((await send({ action: "estado", orderId: order.id })).status).toBe(404);

    session.profile = { id: brand.id, storefrontSlug: "hlacosedora" };
    const quote = await send({ action: "cotizar", orderId: order.id, ...LABEL });
    expect(quote.status).toBe(200);
    expect((await quote.json()).quotes).toHaveLength(2);
    // Errores de Envia y del pedido, con un mensaje para la marca.
    const missing = await send({ action: "estado", orderId: order.id });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("Este pedido no tiene guía de Envia.");
  });
});
