import { randomBytes } from "node:crypto";
import type { EnviaConnection, StoreOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ENVIA_CO_CARRIERS } from "@/lib/envia-carriers";
import {
  enviaCarrierName,
  enviaPhone,
  enviaPlace,
  enviaStateCode,
  enviaText,
  isDeliveredStatus,
  type EnviaPlace,
} from "@/lib/envia-address";
import {
  EnviaError,
  cancelLabel,
  isKeyRejected,
  generateLabel,
  listCarriers,
  locateCity,
  rateCarrier,
  trackShipments,
  type EnviaAuth,
  type EnviaLabel,
  type EnviaShipment,
} from "@/server/integrations/envia-client";
import { StoreOrderError, updateOrderFulfillment } from "@/server/services/store-order-service";

/// Guías con Envia.com desde el pedido, con la cuenta de Envia de la marca:
/// cotiza con sus transportadoras, crea la guía (se cobra de su saldo en
/// Envia), deja el pedido como enviado con la guía y el link de rastreo
/// (el comprador recibe el correo de siempre) y lo pasa a entregado cuando
/// Envia avisa. Lo que antes hacía Envia con Shopify. Solo las tiendas de
/// ENVIA_STORE_SLUGS. Ver conversación del 2026-11-27.

/// Mensaje para mostrarle a la marca tal cual.
export class EnviaServiceError extends Error {}

/// Si Envia no dice qué transportadoras tiene la cuenta, se cotiza con
/// las que suele tener en Colombia.
const DEFAULT_CARRIERS = ENVIA_CO_CARRIERS.map((c) => c.code);
const MAX_CARRIERS = 12;
/// Una guía "en creación" más vieja que esto se da por fallida (el
/// proceso se cayó en la mitad) y se puede volver a intentar.
const CREATING_MS = 2 * 60_000;
const TRACK_BATCH = 20;

const authOf = (conn: Pick<EnviaConnection, "apiToken" | "sandbox">): EnviaAuth => ({
  apiToken: conn.apiToken,
  sandbox: conn.sandbox,
});

function friendly(err: unknown): never {
  if (err instanceof EnviaError) throw new EnviaServiceError(err.message);
  throw err;
}

export function getEnviaConnection(brandId: string) {
  return prisma.enviaConnection.findUnique({ where: { brandId } });
}

async function requireConnection(brandId: string) {
  const conn = await getEnviaConnection(brandId);
  if (!conn) throw new EnviaServiceError("Conecta tu cuenta de Envia en Tienda → Conexiones.");
  return conn;
}

export type EnviaConnectionInput = {
  /// Vacío = conservar la guardada.
  apiToken?: string;
  sandbox: boolean;
  originName: string;
  originCompany?: string | null;
  originPhone: string;
  originEmail?: string | null;
  originStreet: string;
  originRegion: string;
  originCity: string;
  originReference?: string | null;
  /// Solo esta transportadora (código de Envia); null = todas.
  carrier?: string | null;
  packageLengthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  packageWeightGrams: number;
  packageContent: string;
};

/// Guarda la conexión después de probar la llave con Envia. Devuelve las
/// transportadoras de la cuenta, para mostrarlas.
export async function saveEnviaConnection(brandId: string, input: EnviaConnectionInput) {
  const existing = await getEnviaConnection(brandId);
  const apiToken = input.apiToken?.trim() || (existing && existing.sandbox === input.sandbox ? existing.apiToken : "");
  if (!apiToken) {
    throw new EnviaServiceError(
      existing ? "Cambiaste de cuenta (pruebas o producción): pega la llave de esa cuenta." : "Pega la llave (API key) de tu cuenta de Envia.",
    );
  }
  const place = enviaPlace(input.originRegion, input.originCity);
  if (!place) {
    throw new EnviaServiceError(`No encontramos «${input.originCity}» en ${input.originRegion}. Revisa cómo está escrita la ciudad.`);
  }
  if (enviaPhone(input.originPhone).length !== 10) {
    throw new EnviaServiceError("Escribe un celular de 10 dígitos para la transportadora.");
  }

  // Se prueba la llave. Si Envia falla por otra cosa (caído, sin red), se
  // guarda igual: se vuelve a probar al cotizar.
  let carriers: { code: string; name: string | null }[] = [];
  let verified = true;
  try {
    carriers = await listCarriers({ apiToken, sandbox: input.sandbox });
  } catch (err) {
    if (!(err instanceof EnviaError) || isKeyRejected(err)) friendly(err);
    verified = false;
  }

  const data = {
    apiToken,
    sandbox: input.sandbox,
    originName: input.originName.trim(),
    originCompany: input.originCompany?.trim() || null,
    originPhone: input.originPhone.trim(),
    originEmail: input.originEmail?.trim() || null,
    originStreet: input.originStreet.trim(),
    originRegion: input.originRegion,
    originCity: place.cityName,
    originReference: input.originReference?.trim() || null,
    carrier: input.carrier?.trim().toLowerCase() || null,
    packageLengthCm: input.packageLengthCm,
    packageWidthCm: input.packageWidthCm,
    packageHeightCm: input.packageHeightCm,
    packageWeightGrams: input.packageWeightGrams,
    packageContent: input.packageContent.trim(),
  };
  await prisma.enviaConnection.upsert({
    where: { brandId },
    create: { brandId, webhookSecret: randomBytes(24).toString("hex"), ...data },
    update: data,
  });
  return { carriers: carriers.map((c) => enviaCarrierName(c.code, c.name)), verified };
}

export async function deleteEnviaConnection(brandId: string) {
  await prisma.enviaConnection.deleteMany({ where: { brandId } });
}

export type LabelInput = {
  packageLengthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  packageWeightGrams: number;
  /// Valor de la mercancía, en pesos (lo que se asegura).
  declaredValue: number;
  /// Prellenado con el del pedido; la marca lo puede corregir.
  destination: {
    street: string;
    region: string;
    city: string;
    reference?: string | null;
  };
};

async function loadOrder(brandId: string, orderId: string) {
  const order = await prisma.storeOrder.findFirst({ where: { id: orderId, brandId } });
  if (!order) throw new EnviaServiceError("Pedido no encontrado.");
  if (order.status !== "PAID") throw new EnviaServiceError("Solo se puede crear la guía de un pedido pagado.");
  if (!order.shippingAddress) throw new EnviaServiceError("Este pedido no tiene dirección de envío.");
  return order;
}

async function destinationPlace(conn: EnviaConnection, region: string, city: string): Promise<EnviaPlace> {
  const ours = enviaPlace(region, city);
  if (ours) return ours;
  // Una ciudad mal escrita o de un nombre que no reconocemos: se le
  // pregunta a Envia.
  const state = enviaStateCode(region);
  const located = state ? await locateCity(conn.sandbox, enviaText(city), state) : null;
  if (located) return { state: located.state, city: located.city, cityName: located.name ?? city };
  throw new EnviaServiceError(`No encontramos «${city}» en ${region}. Corrige la ciudad del destino.`);
}

async function buildShipment(conn: EnviaConnection, order: StoreOrder, input: LabelInput): Promise<EnviaShipment> {
  const origin = enviaPlace(conn.originRegion, conn.originCity);
  if (!origin) throw new EnviaServiceError("Revisa la ciudad de despacho en Tienda → Conexiones → Envia.");
  const destination = await destinationPlace(conn, input.destination.region, input.destination.city);
  return {
    origin: {
      name: enviaText(conn.originName, 60),
      ...(conn.originCompany ? { company: enviaText(conn.originCompany, 60) } : {}),
      ...(conn.originEmail ? { email: conn.originEmail } : {}),
      phone: enviaPhone(conn.originPhone),
      street: enviaText(conn.originStreet),
      city: origin.city,
      state: origin.state,
      country: "CO",
      postalCode: origin.city,
      ...(conn.originReference ? { reference: enviaText(conn.originReference) } : {}),
    },
    destination: {
      name: enviaText(order.buyerName, 60),
      email: order.buyerEmail,
      phone: enviaPhone(order.buyerPhone),
      street: enviaText(input.destination.street),
      city: destination.city,
      state: destination.state,
      country: "CO",
      postalCode: destination.city,
      ...(input.destination.reference?.trim() ? { reference: enviaText(input.destination.reference) } : {}),
    },
    package: {
      content: enviaText(conn.packageContent, 60) || "Mercancia",
      declaredValue: Math.max(0, Math.round(input.declaredValue)),
      weightKg: input.packageWeightGrams / 1000,
      lengthCm: input.packageLengthCm,
      widthCm: input.packageWidthCm,
      heightCm: input.packageHeightCm,
    },
  };
}

export type ShippingQuote = {
  carrier: string;
  carrierName: string;
  service: string;
  serviceName: string;
  deliveryEstimate: string | null;
  priceCents: number;
};

/// Precio de cada transportadora (y servicio) para este pedido, del más
/// barato al más caro. `failed`: las que no cotizaron.
export async function quoteOrderShipping(brandId: string, orderId: string, input: LabelInput) {
  const conn = await requireConnection(brandId);
  const order = await loadOrder(brandId, orderId);
  const shipment = await buildShipment(conn, order, input);
  const auth = authOf(conn);

  // La marca despacha con una sola transportadora: solo esa se cotiza.
  let carriers = conn.carrier
    ? [{ code: conn.carrier, name: null }]
    : await listCarriers(auth).catch((err): { code: string; name: string | null }[] => {
        if (isKeyRejected(err)) friendly(err);
        return [];
      });
  if (carriers.length === 0) carriers = DEFAULT_CARRIERS.map((code) => ({ code, name: null }));
  carriers = carriers.slice(0, MAX_CARRIERS);

  const results = await Promise.allSettled(carriers.map((c) => rateCarrier(auth, shipment, c.code)));
  const quotes: ShippingQuote[] = [];
  const failed: string[] = [];
  results.forEach((result, i) => {
    const carrier = carriers[i];
    const name = enviaCarrierName(carrier.code, carrier.name);
    if (result.status === "rejected" || result.value.length === 0) {
      failed.push(name);
      return;
    }
    for (const rate of result.value) {
      quotes.push({
        carrier: rate.carrier,
        carrierName: enviaCarrierName(rate.carrier, rate.carrierName ?? carrier.name),
        service: rate.service,
        serviceName: rate.serviceName ?? rate.service,
        deliveryEstimate: rate.deliveryEstimate,
        priceCents: Math.round(rate.totalPrice * 100),
      });
    }
  });
  if (quotes.length === 0) {
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === "rejected")?.reason;
    throw new EnviaServiceError(
      firstError instanceof EnviaError
        ? firstError.message
        : "Ninguna transportadora dio precio para este envío. Revisa la dirección y el paquete.",
    );
  }
  quotes.sort((a, b) => a.priceCents - b.priceCents);
  return { quotes, failed };
}

/// Crea la guía con la transportadora y el servicio elegidos y deja el
/// pedido como enviado con su guía (el comprador recibe el correo).
export async function createOrderLabel(
  brandId: string,
  orderId: string,
  input: LabelInput & { carrier: string; service: string; priceCents?: number },
) {
  const conn = await requireConnection(brandId);
  const order = await loadOrder(brandId, orderId);
  if (order.enviaCarrier) throw new EnviaServiceError("Este pedido ya tiene guía de Envia.");
  if (order.fulfillmentStatus === "DELIVERED") throw new EnviaServiceError("Este pedido ya está entregado.");
  if (conn.carrier && input.carrier.trim().toLowerCase() !== conn.carrier) {
    throw new EnviaServiceError(`Las guías se crean solo con ${enviaCarrierName(conn.carrier)}. Cotiza otra vez.`);
  }
  const shipment = await buildShipment(conn, order, input);

  // Dos clics seguidos (o dos pestañas) no compran dos guías.
  const now = new Date();
  const claimed = await prisma.storeOrder.updateMany({
    where: {
      id: order.id,
      enviaCarrier: null,
      OR: [{ enviaLabelAt: null }, { enviaLabelAt: { lt: new Date(now.getTime() - CREATING_MS) } }],
    },
    data: { enviaLabelAt: now },
  });
  if (claimed.count === 0) {
    throw new EnviaServiceError("La guía de este pedido ya se está creando. Espera un momento y recarga la página.");
  }

  let label: EnviaLabel;
  try {
    label = await generateLabel(authOf(conn), shipment, input.carrier, input.service);
  } catch (err) {
    await prisma.storeOrder.update({ where: { id: order.id }, data: { enviaLabelAt: null } });
    friendly(err);
  }

  const carrier = enviaCarrierName(label.carrier);
  try {
    await prisma.storeOrder.update({
      where: { id: order.id },
      data: {
        enviaCarrier: label.carrier.toLowerCase(),
        enviaService: label.service,
        enviaLabelUrl: label.labelUrl,
        enviaCostCents: label.totalPrice != null ? Math.round(label.totalPrice * 100) : (input.priceCents ?? null),
        enviaLabelAt: now,
        enviaStatus: "Created",
        trackingUrl: label.trackUrl,
        // Ya estaba como enviado con otra guía (puesta a mano): así el
        // comprador recibe el correo con la nueva.
        ...(order.shippedAt && order.trackingNumber !== label.trackingNumber ? { shippedAt: null } : {}),
      },
    });
    await updateOrderFulfillment(
      brandId,
      { orderId: order.id, fulfillmentStatus: "SHIPPED", carrier, trackingNumber: label.trackingNumber },
      // Una guía de prueba no es real: la compradora no se entera.
      { notifyBuyer: !conn.sandbox },
    );
  } catch (err) {
    // La guía ya se compró: que quede el número en el registro.
    console.error(
      `[envia] La guía ${label.trackingNumber} (${carrier}) se creó pero no quedó bien guardada en el pedido ${order.id}:`,
      err,
    );
    throw err;
  }
  return { carrier, trackingNumber: label.trackingNumber, labelUrl: label.labelUrl, trackUrl: label.trackUrl };
}

type TrackedOrder = Pick<StoreOrder, "id" | "trackingNumber" | "fulfillmentStatus" | "enviaStatus">;

/// Guarda el último estado de cada guía y pasa a entregado lo entregado.
async function applyTracking(
  brandId: string,
  orders: TrackedOrder[],
  results: { trackingNumber: string; status: string | null }[],
) {
  let delivered = 0;
  for (const order of orders) {
    const status = results.find((r) => r.trackingNumber === order.trackingNumber)?.status;
    if (!status) continue;
    if (status !== order.enviaStatus) {
      await prisma.storeOrder.update({ where: { id: order.id }, data: { enviaStatus: status } });
    }
    if (isDeliveredStatus(status) && order.fulfillmentStatus !== "DELIVERED") {
      try {
        await updateOrderFulfillment(brandId, { orderId: order.id, fulfillmentStatus: "DELIVERED" });
        delivered += 1;
      } catch (err) {
        // Ej. el pedido se devolvió mientras tanto: se deja como está.
        if (!(err instanceof StoreOrderError)) throw err;
      }
    }
  }
  return delivered;
}

const trackedSelect = { id: true, trackingNumber: true, fulfillmentStatus: true, enviaStatus: true } as const;

/// "Actualizar estado" en el pedido.
export async function refreshOrderTracking(brandId: string, orderId: string) {
  const conn = await requireConnection(brandId);
  const order = await prisma.storeOrder.findFirst({
    where: { id: orderId, brandId, enviaCarrier: { not: null } },
    select: trackedSelect,
  });
  if (!order?.trackingNumber) throw new EnviaServiceError("Este pedido no tiene guía de Envia.");
  const results = await trackShipments(authOf(conn), [order.trackingNumber]).catch(friendly);
  await applyTracking(brandId, [order], results);
  return { status: results.find((r) => r.trackingNumber === order.trackingNumber)?.status ?? null };
}

/// Anula la guía en Envia y deja el pedido como preparado, sin guía, para
/// crear otra.
export async function cancelOrderLabel(brandId: string, orderId: string) {
  const conn = await requireConnection(brandId);
  const order = await prisma.storeOrder.findFirst({ where: { id: orderId, brandId, enviaCarrier: { not: null } } });
  if (!order?.trackingNumber || !order.enviaCarrier) throw new EnviaServiceError("Este pedido no tiene guía de Envia.");
  if (order.fulfillmentStatus === "DELIVERED") throw new EnviaServiceError("La guía ya se entregó: no se puede anular.");
  const result = await cancelLabel(authOf(conn), order.enviaCarrier, order.trackingNumber).catch(friendly);
  await prisma.storeOrder.update({
    where: { id: order.id },
    data: {
      fulfillmentStatus: "PREPARED",
      carrier: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      enviaCarrier: null,
      enviaService: null,
      enviaLabelUrl: null,
      enviaCostCents: null,
      enviaLabelAt: null,
      enviaStatus: null,
    },
  });
  return result;
}

/// Números de guía en un aviso de Envia, venga como venga el JSON
/// (trackingNumber, tracking_number, trackingNumbers…).
export function trackingNumbersIn(payload: unknown, depth = 0): string[] {
  if (depth > 6 || payload === null || typeof payload !== "object") return [];
  const found = new Set<string>();
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (/^tracking_?numbers?$/i.test(key)) {
      for (const v of Array.isArray(value) ? value : [value]) {
        if ((typeof v === "string" && v.trim()) || typeof v === "number") found.add(String(v).trim());
      }
    } else if (typeof value === "object") {
      for (const n of trackingNumbersIn(value, depth + 1)) found.add(n);
    }
  }
  return [...found];
}

export function findEnviaConnectionBySecret(secret: string) {
  if (!/^[a-f0-9]{48}$/.test(secret)) return null;
  return prisma.enviaConnection.findUnique({ where: { webhookSecret: secret } });
}

/// Aviso de Envia (un cambio de estado de una guía). No se confía en lo
/// que dice el aviso: se consulta el estado a Envia con la llave de la
/// marca.
export async function processEnviaWebhook(conn: EnviaConnection, payload: unknown) {
  await prisma.enviaConnection.update({ where: { id: conn.id }, data: { lastWebhookAt: new Date() } });
  const numbers = trackingNumbersIn(payload).slice(0, 50);
  if (numbers.length === 0) return { delivered: 0 };
  const orders = await prisma.storeOrder.findMany({
    where: { brandId: conn.brandId, trackingNumber: { in: numbers }, enviaCarrier: { not: null } },
    select: trackedSelect,
  });
  if (orders.length === 0) return { delivered: 0 };
  const results = await trackShipments(
    authOf(conn),
    orders.map((o) => o.trackingNumber!),
  );
  return { delivered: await applyTracking(conn.brandId, orders, results) };
}

/// Repaso diario (cron) de las guías en camino, por si un aviso de Envia
/// no llegó o la marca no configuró los avisos.
export async function refreshShippedEnviaOrders() {
  const since = new Date(Date.now() - 45 * 24 * 60 * 60_000);
  const orders = await prisma.storeOrder.findMany({
    where: {
      fulfillmentStatus: "SHIPPED",
      enviaCarrier: { not: null },
      trackingNumber: { not: null },
      enviaLabelAt: { gte: since },
    },
    select: { ...trackedSelect, brandId: true },
    take: 500,
  });
  const byBrand = new Map<string, typeof orders>();
  for (const o of orders) byBrand.set(o.brandId, [...(byBrand.get(o.brandId) ?? []), o]);

  let delivered = 0;
  for (const [brandId, brandOrders] of byBrand) {
    const conn = await getEnviaConnection(brandId);
    if (!conn) continue;
    for (let i = 0; i < brandOrders.length; i += TRACK_BATCH) {
      const batch = brandOrders.slice(i, i + TRACK_BATCH);
      try {
        const results = await trackShipments(authOf(conn), batch.map((o) => o.trackingNumber!));
        delivered += await applyTracking(brandId, batch, results);
      } catch (err) {
        console.error(`[envia] No se pudo revisar el estado de las guías de la marca ${brandId}:`, err);
      }
    }
  }
  return { checked: orders.length, delivered };
}
