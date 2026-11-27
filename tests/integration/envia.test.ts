import { PDFDocument } from "pdf-lib";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// La marca que entra al portal (las rutas la piden a la sesión).
const session = vi.hoisted(() => ({ profile: null as null | { id: string; storefrontSlug: string | null } }));
vi.mock("@/lib/current-brand", () => ({ requireBrandProfile: async () => session.profile }));

import { prisma } from "@/lib/prisma";
import { orderNumber } from "@/lib/order-math";
import {
  EnviaServiceError,
  cancelOrderLabel,
  createOrderLabel,
  packageWeightGrams,
  quickCreateOrderLabel,
  quickQuoteOrder,
  quoteOrderShipping,
  refreshShippedEnviaOrders,
  saveEnviaConnection,
  type LabelInput,
} from "@/server/services/envia-service";
import { POST as webhookRoute } from "@/app/api/webhooks/envia/[secret]/route";
import { POST as orderEnviaRoute } from "@/app/api/marca/tienda/pedidos/envia/route";
import { POST as guidesPdfRoute } from "@/app/api/marca/tienda/pedidos/envia/guias/route";
import { POST as packingRoute } from "@/app/api/marca/tienda/pedidos/empaque/route";
import { createBrand, createPendingOrder, createProduct, hasDb } from "./helpers";

const TRACKING = "2300123456";
const LABEL_PDF = "https://s3.envia.com/labels/2300123456.pdf";
const TRACK_URL = "https://envia.com/rastreo?label=2300123456";

/// PDFs de guías de mentira, de distinto tamaño para comprobar el orden.
const labelPdfs: Record<string, Uint8Array<ArrayBuffer>> = {};
beforeAll(async () => {
  for (const [name, size] of [["a", 100], ["b", 200]] as const) {
    const doc = await PDFDocument.create();
    doc.addPage([size, size]);
    labelPdfs[`https://s3.envia.com/labels/${name}.pdf`] = new Uint8Array(await doc.save());
  }
});

type Call = { url: string; method: string; auth: string | null; body: Record<string, unknown> | null };
let calls: Call[];
/// El estado que responde Envia al rastrear.
let trackStatus: string;
/// Tamaños de guía que acepta la transportadora en el Envia de mentira.
let labelSizes: string[];
/// Una transportadora que no acepta el número de la dirección vacío.
let rejectsEmptyNumber: boolean;

/// Envia de mentira: dos transportadoras en la cuenta; Coordinadora no
/// cotiza esa ruta.
function fakeEnvia(requested: string, init?: RequestInit): Response {
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
  const headers = (init?.headers ?? {}) as Record<string, string>;
  calls.push({ url: requested, method: init?.method ?? "GET", auth: headers.Authorization ?? null, body });
  // La cuenta de pruebas responde igual, en api-test y queries-test.
  const url = requested.replace("://api-test.", "://api.").replace("://queries-test.", "://queries.");
  if (url.startsWith("https://s3.envia.com/labels/")) {
    const pdf = labelPdfs[url];
    return pdf ? new Response(pdf, { headers: { "content-type": "application/pdf" } }) : new Response("no", { status: 404 });
  }
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
        { carrier, service: "express", serviceDescription: "Express", deliveryEstimate: "1 día", totalPrice: 18000, currency: "COP", dropOff: 0 },
        { carrier, service: "ground", serviceDescription: "Terrestre", deliveryEstimate: "2-3 días", totalPrice: 12500.5, currency: "COP", dropOff: 0 },
      ],
    });
  }
  if (url === "https://api.envia.com/ship/generate/") {
    // Como Envia: para crear la guía exige los datos de impresión, y no
    // todas las transportadoras dan la guía en cualquier tamaño.
    const settings = body?.settings as { printFormat?: string; printSize?: string } | undefined;
    if (!settings) {
      return Response.json(
        { meta: "error", error: { code: 400, message: `Required property missing: settings, data: ${JSON.stringify(body)}` } },
        { status: 400 },
      );
    }
    // Interrapidísimo y las demás de Colombia exigen el NIT o la cédula de quien envía.
    if (!(body?.origin as Record<string, string> | undefined)?.identificationNumber) {
      return Response.json({ meta: "error", error: { code: 400, message: "Origin identification number is required." } }, { status: 400 });
    }
    // Como Envia: `number` tiene que venir (aunque sea vacío, como en su
    // ejemplo de Colombia).
    for (const side of ["origin", "destination"] as const) {
      const address = (body?.[side] ?? {}) as Record<string, string>;
      for (const field of ["number", "district"]) {
        if (!(field in address)) {
          return Response.json({ meta: "error", error: { code: 400, message: `Required property missing: ${field}` } }, { status: 400 });
        }
      }
      if (rejectsEmptyNumber && !address.number) {
        return Response.json({ meta: "error", error: { code: 400, message: "The street number is required for this carrier." } }, { status: 400 });
      }
    }
    if (!labelSizes.includes(settings.printSize ?? "")) {
      return Response.json({ meta: "error", error: { code: 400, message: "Invalid printSize for this carrier" } }, { status: 400 });
    }
    const { carrier, service } = body?.shipment as { carrier: string; service: string };
    return Response.json({
      meta: "generate",
      data: [{ carrier, service, trackingNumber: TRACKING, label: LABEL_PDF, trackUrl: TRACK_URL, totalPrice: 12500.5, currency: "COP" }],
    });
  }
  if (url === "https://api.envia.com/ship/generaltrack/") {
    const numbers = (body?.trackingNumbers as string[]) ?? [];
    return Response.json({ data: numbers.map((n) => ({ trackingNumber: n, status: trackStatus })) });
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
  trackStatus = "Delivered";
  labelSizes = ["PAPER_LETTER", "PAPER_4X6", "STOCK_4X6"];
  rejectsEmptyNumber = false;
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
  originIdNumber: "900.123.456-7",
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

/// Un pedido pagado para Envigado, en una marca.
async function paidOrderIn(brandId: string) {
  const product = await createProduct(brandId, { name: "Esmalte", price: 45000, stock: 50 });
  const pending = await createPendingOrder(brandId, [{ productId: product.id, quantity: 1, unitPrice: 45000 }]);
  const order = await prisma.storeOrder.update({
    where: { id: pending.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      buyerName: "Ana Muñoz",
      shippingCity: "Envigado",
      billingIdType: "CC",
      billingIdNumber: "1.020.304.050",
    },
  });
  return { product, order };
}

/// Marca con Envia conectado y un pedido pagado para Envigado.
async function paidOrder() {
  const brand = await createBrand();
  await saveEnviaConnection(brand.id, { ...ORIGIN, apiToken: "llave-buena" });
  const { product, order } = await paidOrderIn(brand.id);
  calls = [];
  return { brand, product, order };
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
    // Como el ejemplo de Envia para Colombia: la dirección completa en
    // `street`, número y barrio vacíos, la ciudad con el código DANE.
    expect(rate.body).toMatchObject({
      origin: {
        name: "H la Cosedora",
        phone_code: "CO",
        phone: "3001234567",
        street: "Calle 10 # 43-12",
        number: "",
        district: "",
        city: "05001000",
        state: "AN",
        country: "CO",
        postalCode: "05001000",
      },
      destination: {
        name: "Ana Munoz",
        phone_code: "CO",
        street: "Carrera 43A # 1-50, apto 301",
        number: "",
        district: "",
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
      settings: { currency: "COP" },
    });

    const label = await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    expect(label).toMatchObject({ carrier: "Servientrega", trackingNumber: TRACKING, labelUrl: LABEL_PDF });
    const generate = calls.find((c) => c.url === "https://api.envia.com/ship/generate/")!;
    expect(generate.body).toMatchObject({
      // El número del pedido, para reconocer la guía en el panel de Envia.
      shipment: { type: 1, carrier: "servientrega", service: "ground", reverse_pickup: 0, import: 0, orderReference: orderNumber(order.reference) },
      // En hoja carta, como imprime H la Cosedora.
      settings: { printFormat: "PDF", printSize: "PAPER_LETTER", currency: "COP" },
      // NIT sin dígito de verificación, y la cédula de la compradora.
      origin: { street: "Calle 10 # 43-12", number: "", district: "", identificationNumber: "900123456" },
      destination: { identificationNumber: "1020304050" },
    });

    // Queda preparado con su guía, sin correo: la transportadora todavía
    // no tiene el paquete (puede recogerlo días después).
    const labeled = await orderOf(order.id);
    expect(labeled).toMatchObject({
      fulfillmentStatus: "PREPARED",
      carrier: "Servientrega",
      trackingNumber: TRACKING,
      trackingUrl: TRACK_URL,
      enviaCarrier: "servientrega",
      enviaService: "ground",
      enviaLabelUrl: LABEL_PDF,
      enviaCostCents: 1250050,
      enviaStatus: "Created",
    });
    expect(labeled.shippedAt).toBeNull();
    expect(labeled.preparedAt).not.toBeNull();
    expect(emails).not.toContain(order.buyerEmail);

    // Una sola guía por pedido.
    await expect(createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" })).rejects.toThrow(
      "ya tiene guía",
    );
    expect(calls.filter((c) => c.url.endsWith("/ship/generate/"))).toHaveLength(1);
  });

  it("sin NIT o cédula de quien envía no se intenta la guía; con el NIT de la marca, sí", async () => {
    const { brand, order } = await paidOrder();
    await prisma.enviaConnection.update({ where: { brandId: brand.id }, data: { originIdNumber: null } });
    await expect(createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" })).rejects.toThrow(
      "Falta el NIT o la cédula de quien envía",
    );
    expect(calls.some((c) => c.url.endsWith("/ship/generate/"))).toBe(false);

    // El NIT que la marca ya tiene en Configuración sirve.
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { taxId: "901.555.444-2" } });
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    expect(calls.find((c) => c.url.endsWith("/ship/generate/"))?.body).toMatchObject({ origin: { identificationNumber: "901555444" } });
  });

  it("si la transportadora no da la guía en hoja carta, se crea en 4x6", async () => {
    const { brand, order } = await paidOrder();
    labelSizes = ["PAPER_4X6"];
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "interrapidisimo", service: "mensajeria" });
    const sizes = calls
      .filter((c) => c.url.endsWith("/ship/generate/"))
      .map((c) => (c.body?.settings as { printSize: string }).printSize);
    expect(sizes).toEqual(["PAPER_LETTER", "PAPER_4X6"]);
    expect(await orderOf(order.id)).toMatchObject({ fulfillmentStatus: "PREPARED", trackingNumber: TRACKING });
  });

  it("si la transportadora no acepta el número de la dirección vacío, se llena y se crea la guía", async () => {
    const { brand, order } = await paidOrder();
    rejectsEmptyNumber = true;
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    const tries = calls.filter((c) => c.url.endsWith("/ship/generate/")).map((c) => c.body);
    expect(tries).toHaveLength(2);
    expect(tries[1]).toMatchObject({
      origin: { street: "Calle 10 # 43-12", number: "S/N", district: "Medellin" },
      destination: { street: "Carrera 43A # 1-50, apto 301", number: "S/N", district: "Envigado" },
    });
    expect((await orderOf(order.id)).trackingNumber).toBe(TRACKING);
  });

  it("un error de Envia se muestra sin el volcado de datos que Envia le pega", async () => {
    const { brand, order } = await paidOrder();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { meta: "error", error: { message: 'Required property missing: settings, data: {"origin":{"name":"Audaz Lab SAS"}}' } },
          { status: 400 },
        ),
      ),
    );
    await expect(createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" })).rejects.toThrow(
      /^Envia: Required property missing: settings$/,
    );
  });

  it("solo se ofrecen servicios a domicilio, primero los de puerta a puerta", async () => {
    const { brand, order } = await paidOrder();
    await prisma.enviaConnection.update({ where: { brandId: brand.id }, data: { carrier: "tcc" } });
    const rates = (data: unknown[]) =>
      vi.fn(async (url: string, init?: RequestInit) =>
        String(url).endsWith("/ship/rate/") ? Response.json({ meta: "rate", data }) : fakeEnvia(String(url), init),
      );
    // El dropOff de Envia dice dónde entrega, aunque el nombre no lo diga.
    vi.stubGlobal(
      "fetch",
      rates([
        { carrier: "tcc", service: "a_oficina", serviceDescription: "Economico", totalPrice: 5000, dropOff: 1 },
        { carrier: "tcc", service: "oficina_casa", serviceDescription: "Oficina - Domicilio", totalPrice: 6000, dropOff: 2 },
        { carrier: "tcc", service: "puerta", serviceDescription: "Estandar", totalPrice: 9000, dropOffDescription: "Door - Door" },
      ]),
    );
    const detail = await quoteOrderShipping(brand.id, order.id, LABEL);
    expect(detail.quotes.map((q) => q.service)).toEqual(["puerta", "oficina_casa"]);

    // Si solo hay entrega en oficina, no se ofrece nada y se explica.
    vi.stubGlobal("fetch", rates([{ carrier: "tcc", service: "a_oficina", serviceDescription: "Economico", totalPrice: 5000, dropOff: 3 }]));
    await expect(quoteOrderShipping(brand.id, order.id, LABEL)).rejects.toThrow("solo entrega en su oficina");
  });

  it("solo se ofrece el servicio a domicilio, no el que deja el paquete en una oficina", async () => {
    const { brand, order } = await paidOrder();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) =>
        String(url).endsWith("/ship/rate/")
          ? Response.json({
              data: [
                { carrier: "interrapidisimo", service: "mensajeria_oficina", serviceDescription: "Interrapidisimo Mensajería Domicilio - Oficina", totalPrice: 7190 },
                { carrier: "interrapidisimo", service: "mensajeria", serviceDescription: "Interrapidisimo Mensajeria", totalPrice: 7410 },
              ],
            })
          : fakeEnvia(String(url), init),
      ),
    );
    await saveEnviaConnection(brand.id, { ...ORIGIN, carrier: "interrapidisimo" });
    const { quote } = await quickQuoteOrder(brand.id, order.id);
    expect(quote).toMatchObject({ service: "mensajeria", priceCents: 741000 });
    // Dentro del pedido tampoco se ofrece el de oficina.
    const detail = await quoteOrderShipping(brand.id, order.id, LABEL);
    expect(detail.quotes.map((q) => q.service)).toEqual(["mensajeria"]);
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
    // Guía creada, la transportadora no la ha recogido: nada cambia.
    trackStatus = "Created";
    expect((await post(conn.webhookSecret, { data: { tracking_number: TRACKING, status: "created" } })).status).toBe(200);
    expect(await orderOf(order.id)).toMatchObject({ fulfillmentStatus: "PREPARED", shippedAt: null });
    expect(emails).not.toContain(order.buyerEmail);

    // La recogió (aviso tracking.simple de Envia): pasa a enviado y ahora sí
    // le llega el correo con el seguimiento. Aunque el aviso diga otra cosa,
    // manda lo que responde Envia.
    trackStatus = "Picked Up";
    const notice = { type: "tracking.simple", data: { shipment_id: 98765, tracking_number: TRACKING, status: "delivered" } };
    expect((await post(conn.webhookSecret, notice)).status).toBe(200);
    expect(await orderOf(order.id)).toMatchObject({ fulfillmentStatus: "SHIPPED", enviaStatus: "Picked Up" });
    expect(emails.filter((e) => e === order.buyerEmail)).toHaveLength(1);

    // Avisos repetidos no repiten el correo.
    trackStatus = "Out for Delivery";
    await post(conn.webhookSecret, notice);
    expect(emails.filter((e) => e === order.buyerEmail)).toHaveLength(1);

    // Un aviso con otro formato (sin número de guía reconocible): se revisan
    // las guías sin entregar de la marca.
    trackStatus = "Delivered";
    expect((await post(conn.webhookSecret, { evento: "cambio" })).status).toBe(200);
    const delivered = await orderOf(order.id);
    expect(delivered).toMatchObject({ fulfillmentStatus: "DELIVERED", enviaStatus: "Delivered" });
    expect(delivered.deliveredAt).not.toBeNull();
    expect(emails.filter((e) => e === order.buyerEmail)).toHaveLength(1);
    expect(calls.every((c) => c.auth === "Bearer llave-buena")).toBe(true);
    expect((await prisma.enviaConnection.findUniqueOrThrow({ where: { id: conn.id } })).lastWebhookAt).not.toBeNull();
  });

  it("si la guía se anula en el panel de Envia, el pedido queda sin guía para crear otra", async () => {
    const { brand, order } = await paidOrder();
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    trackStatus = "Canceled";
    await refreshShippedEnviaOrders();
    expect(await orderOf(order.id)).toMatchObject({
      fulfillmentStatus: "PREPARED",
      trackingNumber: null,
      enviaCarrier: null,
      enviaLabelUrl: null,
    });
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    expect((await orderOf(order.id)).trackingNumber).toBe(TRACKING);
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
    expect(await orderOf(order.id)).toMatchObject({ fulfillmentStatus: "PREPARED", trackingNumber: TRACKING });
  });

  it("el repaso diario pasa a enviado lo que la transportadora recogió y a entregado lo entregado", async () => {
    const { brand, order } = await paidOrder();
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    trackStatus = "Shipped";
    expect((await refreshShippedEnviaOrders()).shipped).toBeGreaterThanOrEqual(1);
    expect((await orderOf(order.id)).fulfillmentStatus).toBe("SHIPPED");
    expect(emails).toContain(order.buyerEmail);

    trackStatus = "Delivered";
    expect((await refreshShippedEnviaOrders()).delivered).toBeGreaterThanOrEqual(1);
    expect((await orderOf(order.id)).fulfillmentStatus).toBe("DELIVERED");
  });

  it("si ya llegó cuando Marcolini se entera, pasa a entregado sin el correo de «va en camino»", async () => {
    const { brand, order } = await paidOrder();
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "servientrega", service: "ground" });
    trackStatus = "Delivered";
    await refreshShippedEnviaOrders();
    const delivered = await orderOf(order.id);
    expect(delivered).toMatchObject({ fulfillmentStatus: "DELIVERED" });
    expect(delivered.shippedAt).not.toBeNull();
    expect(emails).not.toContain(order.buyerEmail);
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
    expect((await orderOf(order.id)).fulfillmentStatus).toBe("PREPARED");
    // Aunque Envia diga que la recogieron, una guía de prueba no le escribe a la compradora.
    trackStatus = "Picked Up";
    await refreshShippedEnviaOrders();
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
    // La transportadora va tal cual la devolvió la cotización.
    calls = [];
    await createOrderLabel(brand.id, order.id, { ...LABEL, carrier: "interRapidisimo", service: "ground" });
    expect(calls.find((c) => c.url.endsWith("/ship/generate/"))?.body).toMatchObject({ shipment: { carrier: "interRapidisimo" } });
    expect(await orderOf(order.id)).toMatchObject({ carrier: "Interrapidísimo", enviaCarrier: "interRapidisimo", fulfillmentStatus: "PREPARED" });
  });

  it("el peso del paquete es el de los productos, y nunca menos que el de siempre", () => {
    expect(packageWeightGrams(500, [{ quantity: 2, weightKg: 0.06 }])).toBe(500);
    expect(packageWeightGrams(500, [{ quantity: 20, weightKg: 0.06 }, { quantity: 1, weightKg: null }])).toBe(1200);
    expect(packageWeightGrams(500, [])).toBe(500);
  });

  it("desde la lista: cotiza con el paquete de siempre y el peso de los productos, y crea la guía", async () => {
    const { brand, product, order } = await paidOrder();
    const light = await quickQuoteOrder(brand.id, order.id);
    expect(light.weightGrams).toBe(500);
    // La más barata.
    expect(light.quote).toMatchObject({ carrierName: "Servientrega", serviceName: "Terrestre", priceCents: 1250050 });

    // 20 esmaltes de 60 g: 1,2 kg.
    await prisma.product.update({ where: { id: product.id }, data: { weight: 0.06 } });
    await prisma.storeOrderItem.updateMany({ where: { orderId: order.id }, data: { quantity: 20 } });
    calls = [];
    const heavy = await quickQuoteOrder(brand.id, order.id);
    expect(heavy.weightGrams).toBe(1200);
    const rate = calls.find((c) => c.url.endsWith("/ship/rate/"))!;
    expect(rate.body).toMatchObject({
      destination: { street: "Calle 1 # 2-3", number: "", city: "05266000", state: "AN" },
      packages: [{ weight: 1.2, declaredValue: 45000, dimensions: { length: 20, width: 15, height: 10 } }],
    });

    const { quote } = heavy;
    const created = await quickCreateOrderLabel(brand.id, order.id, { carrier: quote.carrier, service: quote.service, priceCents: quote.priceCents });
    expect(created).toMatchObject({ trackingNumber: TRACKING, labelUrl: LABEL_PDF, costCents: 1250050 });
    expect(calls.find((c) => c.url.endsWith("/ship/generate/"))?.body).toMatchObject({ packages: [{ weight: 1.2 }] });
    expect((await orderOf(order.id)).fulfillmentStatus).toBe("PREPARED");
    await expect(quickQuoteOrder(brand.id, order.id)).rejects.toThrow("ya tiene guía");
  });

  it("las guías de varios pedidos salen en un solo PDF, en el orden de la lista", async () => {
    const brand = await createBrand();
    await saveEnviaConnection(brand.id, { ...ORIGIN, apiToken: "llave-buena" });
    const [a, b, sinGuia, perdida] = await Promise.all([1, 2, 3, 4].map(() => paidOrderIn(brand.id).then((r) => r.order)));
    const label = (id: string, name: string) =>
      prisma.storeOrder.update({
        where: { id },
        data: { enviaCarrier: "interrapidisimo", trackingNumber: `T-${name}`, enviaLabelUrl: `https://s3.envia.com/labels/${name}.pdf` },
      });
    await Promise.all([label(a.id, "a"), label(b.id, "b"), label(perdida.id, "no-existe")]);

    session.profile = { id: brand.id, storefrontSlug: "hlacosedora" };
    const res = await guidesPdfRoute(
      new Request("https://marcolini.lat/api/marca/tienda/pedidos/envia/guias", {
        method: "POST",
        body: JSON.stringify({ orderIds: [b.id, sinGuia.id, a.id, perdida.id] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    // El que no tiene guía y la que no se pudo bajar.
    expect(res.headers.get("X-Guias-Faltantes")).toBe("2");
    const merged = await PDFDocument.load(await res.arrayBuffer());
    expect(merged.getPages().map((p) => p.getWidth())).toEqual([200, 100]);

    // Con la hoja de empaque: primero ella (hoja carta, 612 de ancho) y
    // después las guías, en el mismo orden; todo en un PDF.
    const both = await guidesPdfRoute(
      new Request("https://marcolini.lat/api/marca/tienda/pedidos/envia/guias", {
        method: "POST",
        body: JSON.stringify({ orderIds: [b.id, sinGuia.id, a.id, perdida.id], conEmpaque: true }),
      }),
    );
    expect(both.status).toBe(200);
    expect(both.headers.get("content-disposition")).toContain("guias-y-hoja-de-empaque.pdf");
    expect(both.headers.get("X-Guias-Faltantes")).toBe("2");
    const combined = await PDFDocument.load(await both.arrayBuffer());
    expect(combined.getPages().map((p) => p.getWidth())).toEqual([612, 200, 100]);

    // Otra marca no baja las guías de esta.
    const other = await createBrand();
    session.profile = { id: other.id, storefrontSlug: "hlacosedora" };
    const foreign = await guidesPdfRoute(
      new Request("https://marcolini.lat/api/marca/tienda/pedidos/envia/guias", { method: "POST", body: JSON.stringify({ orderIds: [a.id] }) }),
    );
    expect(foreign.status).toBe(400);
  });

  it("la hoja de empaque sale en PDF, solo con pedidos de la marca", async () => {
    const brand = await createBrand();
    const [a, b] = await Promise.all([paidOrderIn(brand.id), paidOrderIn(brand.id)]);
    const send = (orderIds: string[]) =>
      packingRoute(new Request("https://marcolini.lat/api/marca/tienda/pedidos/empaque", { method: "POST", body: JSON.stringify({ orderIds }) }));

    // Cualquier marca, con o sin Envia.
    session.profile = { id: brand.id, storefrontSlug: brand.storefrontSlug };
    const res = await send([b.order.id, a.order.id]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect((await PDFDocument.load(await res.arrayBuffer())).getPageCount()).toBe(1);

    const other = await createBrand();
    session.profile = { id: other.id, storefrontSlug: other.storefrontSlug };
    const foreign = await send([a.order.id]);
    expect(foreign.status).toBe(400);
    expect((await foreign.json()).error).toBe("Elige pedidos de tu tienda.");
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
    const quick = await send({ action: "cotizar-rapido", orderId: order.id });
    expect(quick.status).toBe(200);
    expect(await quick.json()).toMatchObject({ weightGrams: 500, quote: { priceCents: 1250050 } });
    // Errores de Envia y del pedido, con un mensaje para la marca.
    const missing = await send({ action: "estado", orderId: order.id });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe("Este pedido no tiene guía de Envia.");
  });
});
