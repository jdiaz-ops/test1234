import { randomBytes } from "node:crypto";
import type { EnviaConnection, StoreOrder } from "@prisma/client";
import { PDFDocument, type PDFPage } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { ENVIA_CO_CARRIERS } from "@/lib/envia-carriers";
import {
  colombiaPostalCode,
  enviaCarrierName,
  enviaIdNumber,
  enviaPhone,
  enviaPlace,
  enviaStateCode,
  enviaStatusStage,
  enviaText,
  standardStreet,
  type EnviaPlace,
} from "@/lib/envia-address";
import { orderNumber } from "@/lib/order-math";
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
import { packingSlipsPdf } from "@/server/services/packing-slip-service";
import { addLabelSheets } from "@/server/services/label-sheets";

/// Guías con Envia.com desde el pedido, con la cuenta de Envia de la marca:
/// cotiza con sus transportadoras, crea la guía (se cobra de su saldo en
/// Envia) y deja el pedido preparado con la guía. Cuando Envia avisa que
/// la transportadora recogió el paquete, el pedido pasa a enviado y la
/// compradora recibe el correo con el seguimiento; después, a entregado.
/// Lo que antes hacía Envia con Shopify. Solo las tiendas de
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
/// Guías por PDF combinado (Vercel no responde más de ~4,5 MB).
export const MAX_LABELS_PER_PDF = 50;

const authOf = (conn: Pick<EnviaConnection, "apiToken" | "sandbox">): EnviaAuth => ({
  apiToken: conn.apiToken,
  sandbox: conn.sandbox,
});

/// Envia pidió esperar (429, muchas consultas seguidas): ese rechazo no
/// cotiza ni crea guía, así que se espera y se intenta otra vez.
async function withRateLimitRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (err) {
      if (!(err instanceof EnviaError && err.status === 429) || attempt >= 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
    }
  }
}

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
  /// NIT o cédula de quien envía.
  originIdNumber?: string | null;
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
    originIdNumber: enviaIdNumber(input.originIdNumber) || null,
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

/// El código postal del destino (6 dígitos, de 4-72): Interrapidísimo lo
/// usa para la zona de reparto; con el de la ciudad pone uno genérico y la
/// guía sale sin zona (guía del pedido #A32F4E55, 2026-11-27). El que
/// escribió la compradora en el checkout (si la dirección no se corrigió);
/// si no, el código DANE de la ciudad, como en el ejemplo de Envia. (Buscarlo
/// en Google Maps pedía una llave de Google: la marca no la quiere.)
function destinationPostalCode(order: StoreOrder, input: LabelInput, place: EnviaPlace) {
  const sameAddress =
    input.destination.street.trim() === (order.shippingAddress ?? "").trim() &&
    input.destination.city.trim() === (order.shippingCity ?? "").trim();
  return (sameAddress ? colombiaPostalCode(order.shippingPostalCode, place.city) : null) ?? place.city;
}

/// Origen y destino como los pide Envia para Colombia (su ejemplo de
/// "Generate domestic shipment (Colombia)"): la dirección completa en
/// `street`, `number` y `district` vacíos, ciudad y código postal con el
/// código DANE. El destino, con el código postal real de la compradora
/// (ver destinationPostalCode) y la dirección con "#" y "-".
/// Para reintentar si Envia rechaza algo (ver addressFix): `filledNumber`,
/// número "S/N" y la ciudad como barrio; `danePostalCode`, el código de la
/// ciudad como código postal.
type ShipmentOptions = { filledNumber?: boolean; danePostalCode?: boolean };

async function buildShipment(
  conn: EnviaConnection,
  order: StoreOrder,
  input: LabelInput,
  options: ShipmentOptions = {},
): Promise<EnviaShipment> {
  const origin = enviaPlace(conn.originRegion, conn.originCity);
  if (!origin) throw new EnviaServiceError("Revisa la ciudad de despacho en Tienda → Conexiones → Envia.");
  const destination = await destinationPlace(conn, input.destination.region, input.destination.city);
  // Quien envía: el de la conexión o, si no lo tiene, el NIT de la marca.
  const originId =
    enviaIdNumber(conn.originIdNumber) ||
    enviaIdNumber(
      (await prisma.brandProfile.findUnique({ where: { id: conn.brandId }, select: { taxId: true } }))?.taxId,
    );
  if (!originId) {
    throw new EnviaServiceError(
      "Falta el NIT o la cédula de quien envía: agrégalo en Tienda → Conexiones → Envia (las transportadoras lo exigen).",
    );
  }
  // El documento de la compradora: Envia lo exige ("Destination
  // identification number is required") y solo con números. Si lo escribió
  // sin ningún número (pasó con un pedido del 2026-11-27), va su celular,
  // que siempre está: así la guía sale sin que nadie tenga que corregirla.
  const buyerId = enviaIdNumber(order.billingIdNumber) || enviaPhone(order.buyerPhone);
  const destinationStreet = standardStreet(input.destination.street);
  const postalCode = options.danePostalCode ? destination.city : destinationPostalCode(order, input, destination);
  const numberAndDistrict = (place: EnviaPlace) =>
    options.filledNumber ? { number: "S/N", district: enviaText(place.cityName, 60) } : { number: "", district: "" };
  return {
    origin: {
      name: enviaText(conn.originName, 60),
      // Sin empresa, el mismo nombre (algunas transportadoras la piden).
      company: enviaText(conn.originCompany || conn.originName, 60),
      ...(conn.originEmail ? { email: conn.originEmail } : {}),
      phone_code: "CO",
      phone: enviaPhone(conn.originPhone),
      identificationNumber: originId,
      street: enviaText(conn.originStreet, 200),
      ...numberAndDistrict(origin),
      city: origin.city,
      state: origin.state,
      country: "CO",
      postalCode: origin.city,
      ...(conn.originReference ? { reference: enviaText(conn.originReference) } : {}),
    },
    destination: {
      name: enviaText(order.buyerName, 60),
      email: order.buyerEmail,
      phone_code: "CO",
      phone: enviaPhone(order.buyerPhone),
      ...(buyerId ? { identificationNumber: buyerId } : {}),
      street: enviaText(destinationStreet, 200),
      ...numberAndDistrict(destination),
      city: destination.city,
      state: destination.state,
      country: "CO",
      postalCode,
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
  /// Ver EnviaRate.dropOff.
  dropOff: number | null;
};

/// Peso del paquete: lo que pesan los productos del pedido (el peso que
/// tienen en Productos) y nunca menos que el paquete de siempre. Así un
/// pedido de 30 esmaltes no se cotiza como medio kilo.
export function packageWeightGrams(defaultGrams: number, items: { quantity: number; weightKg: number | null }[]) {
  const products = items.reduce((sum, i) => sum + (i.weightKg ?? 0) * 1000 * i.quantity, 0);
  return Math.max(defaultGrams, Math.round(products));
}

export async function orderPackageWeightGrams(conn: Pick<EnviaConnection, "packageWeightGrams">, orderId: string) {
  const items = await prisma.storeOrderItem.findMany({
    where: { orderId },
    select: { quantity: true, product: { select: { weight: true } }, variant: { select: { weight: true } } },
  });
  return packageWeightGrams(
    conn.packageWeightGrams,
    items.map((i) => {
      // La variante sin peso propio usa el del producto.
      const weight = i.variant?.weight ?? i.product?.weight ?? null;
      return { quantity: i.quantity, weightKg: weight != null ? Number(weight) : null };
    }),
  );
}

/// Lo que se usa al crear la guía desde la lista de pedidos, sin abrir el
/// pedido: el paquete de siempre (con el peso de los productos), el valor
/// de la mercancía y la dirección del pedido.
async function quickLabelInput(conn: EnviaConnection, order: StoreOrder): Promise<LabelInput> {
  return {
    packageLengthCm: conn.packageLengthCm,
    packageWidthCm: conn.packageWidthCm,
    packageHeightCm: conn.packageHeightCm,
    packageWeightGrams: await orderPackageWeightGrams(conn, order.id),
    declaredValue: Math.max(0, Math.round((order.subtotalCents - order.discountCents) / 100)),
    destination: {
      street: order.shippingAddress ?? "",
      region: order.shippingRegion ?? "",
      city: order.shippingCity ?? "",
      reference: order.shippingNotes?.slice(0, 120) ?? null,
    },
  };
}

/// Precio de cada transportadora (y servicio) para este pedido, del más
/// barato al más caro. `failed`: las que no cotizaron.
export async function quoteOrderShipping(brandId: string, orderId: string, input: LabelInput) {
  const conn = await requireConnection(brandId);
  const order = await loadOrder(brandId, orderId);
  return quoteWith(conn, order, input);
}

/// Desde la lista de pedidos: la tarifa más barata con el paquete de
/// siempre, y el peso con que se cotizó.
export async function quickQuoteOrder(brandId: string, orderId: string) {
  const conn = await requireConnection(brandId);
  const order = await loadOrder(brandId, orderId);
  // Ya la tiene (creada en otra pestaña, o la lista estaba desactualizada):
  // se muestra la que hay, no un error.
  if (order.enviaCarrier) return { existing: await existingLabel(brandId, order) };
  const input = await quickLabelInput(conn, order);
  const { quotes } = await quoteWith(conn, order, input);
  return { quote: quotes[0], weightGrams: input.packageWeightGrams };
}

/// Un servicio que deja el paquete en una oficina de la transportadora: la
/// compradora tendría que ir a recogerlo, y para crearlo Envia pide la
/// oficina (branchCode). Lo dice el dropOff de Envia (1 y 3 terminan en
/// oficina) o el nombre, que termina en el destino: "Interrapidisimo
/// Mensajería Domicilio - Oficina" recoge en la casa y entrega en oficina.
export function deliversToOffice(quote: Pick<ShippingQuote, "service" | "serviceName" | "dropOff">) {
  if (quote.dropOff === 1 || quote.dropOff === 3) return true;
  const name = quote.serviceName?.trim() || quote.service;
  return /oficina|sucursal|branch/i.test(name.split(/\s+-\s+/).pop() ?? name);
}

async function quoteWith(conn: EnviaConnection, order: StoreOrder, input: LabelInput) {
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

  const rateAll = (shipment: EnviaShipment) =>
    Promise.allSettled(carriers.map((c) => withRateLimitRetry(() => rateCarrier(auth, shipment, c.code))));
  let results = await rateAll(await buildShipment(conn, order, input));
  // Si Envia no acepta el código postal, se cotiza con el de la ciudad.
  const nothing = results.every((r) => r.status === "rejected" || r.value.length === 0);
  const postalRejected = results.some((r) => r.status === "rejected" && addressFix(r.reason)?.danePostalCode);
  if (nothing && postalRejected) results = await rateAll(await buildShipment(conn, order, input, { danePostalCode: true }));
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
        dropOff: rate.dropOff,
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
  // Las compradoras esperan el pedido en su casa ("no a oficina, a
  // domicilio", 2026-11-27): los servicios que lo dejan en una oficina de
  // la transportadora no se ofrecen.
  const home = quotes.filter((q) => !deliversToOffice(q));
  if (home.length === 0) {
    throw new EnviaServiceError(
      "Para esta dirección la transportadora solo entrega en su oficina, no a domicilio. Si la compradora puede recogerlo allá, crea la guía desde tu cuenta de Envia.",
    );
  }
  // Primero los de puerta a puerta (la transportadora recoge y entrega en
  // la casa), y en cada grupo del más barato al más caro: el primero es el
  // que se usa por defecto.
  const rank = (q: ShippingQuote) => (q.dropOff == null || q.dropOff === 0 ? 0 : 1);
  home.sort((a, b) => rank(a) - rank(b) || a.priceCents - b.priceCents);
  return { quotes: home, failed };
}

/// Qué cambiar para reintentar cuando Envia (o la transportadora) rechaza
/// un dato de la dirección: el número o el barrio vacíos → "S/N" y la
/// ciudad; el código postal → el de la ciudad. null: otro error.
function addressFix(err: unknown): ShipmentOptions | null {
  if (!(err instanceof EnviaError)) return null;
  const message = err.message;
  const fix: ShipmentOptions = {};
  if (/\b(number|district|numero|barrio)\b/i.test(message) && !/identification|phone|tracking|telefono/i.test(message)) {
    fix.filledNumber = true;
  }
  if (/postal|zip|c[oó]digo postal/i.test(message)) fix.danePostalCode = true;
  return fix.filledNumber || fix.danePostalCode ? fix : null;
}

type LabelChoice = { carrier: string; service: string; priceCents?: number };

/// Crea la guía con la transportadora y el servicio elegidos y deja el
/// pedido preparado con su guía. La compradora recibe el correo con el
/// seguimiento cuando la transportadora recoja el paquete (applyTracking):
/// la guía se puede crear el viernes y entregarse el martes, y no se le
/// dice antes que va en camino (pedido del 2026-11-27).
export async function createOrderLabel(brandId: string, orderId: string, input: LabelInput & LabelChoice) {
  const conn = await requireConnection(brandId);
  const order = await loadOrder(brandId, orderId);
  return createWith(brandId, conn, order, input);
}

/// Desde la lista de pedidos, con lo mismo con que se cotizó ahí.
export async function quickCreateOrderLabel(brandId: string, orderId: string, choice: LabelChoice) {
  const conn = await requireConnection(brandId);
  const order = await loadOrder(brandId, orderId);
  return createWith(brandId, conn, order, { ...(await quickLabelInput(conn, order)), ...choice });
}

/// La guía que ya tiene el pedido, como la devuelve createWith. Si quedó
/// "no preparado" con guía (se cortó a mitad), queda preparado.
async function existingLabel(brandId: string, order: StoreOrder) {
  if (order.fulfillmentStatus === "UNFULFILLED" && order.trackingNumber) {
    await updateOrderFulfillment(brandId, { orderId: order.id, fulfillmentStatus: "PREPARED" }).catch((err) => {
      if (!(err instanceof StoreOrderError)) throw err;
    });
  }
  return {
    carrier: order.carrier ?? enviaCarrierName(order.enviaCarrier ?? ""),
    trackingNumber: order.trackingNumber ?? "",
    labelUrl: order.enviaLabelUrl,
    trackUrl: order.trackingUrl,
    costCents: order.enviaCostCents,
    existing: true,
  };
}

async function createWith(brandId: string, conn: EnviaConnection, order: StoreOrder, input: LabelInput & LabelChoice) {
  // Pedir dos veces la misma guía (dos clics, dos pestañas, una lista
  // desactualizada) devuelve la que ya tiene: nunca se compra otra.
  if (order.enviaCarrier) return existingLabel(brandId, order);
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
  const auth = authOf(conn);
  const generate = (s: EnviaShipment) =>
    withRateLimitRetry(() =>
      generateLabel(auth, s, input.carrier, input.service, { orderReference: orderNumber(order.reference) }),
    );
  try {
    label = await generate(shipment).catch(async (err) => {
      const fix = addressFix(err);
      if (!fix) throw err;
      // Envia manda el número y el barrio vacíos en Colombia; si esta
      // transportadora no los acepta así (o no acepta el código postal), se
      // ajusta y se intenta otra vez (un rechazo no crea guía ni cobra).
      return generate(await buildShipment(conn, order, input, fix));
    });
  } catch (err) {
    await prisma.storeOrder.update({ where: { id: order.id }, data: { enviaLabelAt: null } });
    friendly(err);
  }

  const carrier = enviaCarrierName(label.carrier);
  const costCents = label.totalPrice != null ? Math.round(label.totalPrice * 100) : (input.priceCents ?? null);
  try {
    await prisma.storeOrder.update({
      where: { id: order.id },
      data: {
        // Tal cual lo devuelve Envia: así se anula después.
        enviaCarrier: label.carrier,
        enviaService: label.service,
        enviaLabelUrl: label.labelUrl,
        enviaCostCents: costCents,
        enviaLabelAt: now,
        enviaStatus: "Created",
        trackingUrl: label.trackUrl,
        // Ya estaba como enviado con otra guía (puesta a mano): el correo
        // con la nueva sale cuando la transportadora la recoja.
        ...(order.shippedAt && order.trackingNumber !== label.trackingNumber ? { shippedAt: null } : {}),
      },
    });
    // Preparado con su guía, sin correo todavía: "enviado" es cuando la
    // transportadora tiene el paquete.
    await updateOrderFulfillment(brandId, {
      orderId: order.id,
      fulfillmentStatus: "PREPARED",
      carrier,
      trackingNumber: label.trackingNumber,
    });
  } catch (err) {
    // La guía ya se compró: que quede el número en el registro.
    console.error(
      `[envia] La guía ${label.trackingNumber} (${carrier}) se creó pero no quedó bien guardada en el pedido ${order.id}:`,
      err,
    );
    throw err;
  }
  return { carrier, trackingNumber: label.trackingNumber, labelUrl: label.labelUrl, trackUrl: label.trackUrl, costCents };
}

/// Corre `work` sobre cada elemento, de a `limit` a la vez, en orden.
async function inBatches<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...(await Promise.all(items.slice(i, i + limit).map(work))));
  }
  return results;
}

async function downloadPdf(url: string): Promise<Uint8Array | null> {
  if (!url.startsWith("https://")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/// Las guías de varios pedidos en un solo PDF, en el orden pedido, para
/// imprimirlas de una vez. Con `packing`, primero la hoja de empaque de esos
/// mismos pedidos (los que tienen guía), en el mismo orden: todo se
/// imprime junto en papel carta (pedido del 2026-11-27). Las guías van
/// varias por hoja a tamaño real (de a 4 las de Interrapidísimo; ver
/// label-sheets.ts). `missing`: las guías que no se pudieron incluir.
export async function mergedOrderLabels(brandId: string, orderIds: string[], options: { packing?: boolean } = {}) {
  const ids = orderIds.slice(0, MAX_LABELS_PER_PDF);
  const orders = await prisma.storeOrder.findMany({
    where: { brandId, id: { in: ids }, enviaLabelUrl: { not: null } },
    select: { id: true, enviaLabelUrl: true },
  });
  const urlOf = new Map(orders.map((o) => [o.id, o.enviaLabelUrl!]));
  const labeled = ids.filter((id) => urlOf.has(id));
  const urls = labeled.map((id) => urlOf.get(id)!);
  const files = await inBatches(urls, 5, downloadPdf);

  const merged = await PDFDocument.create();
  if (options.packing && labeled.length > 0) {
    const sheet = await PDFDocument.load(await packingSlipsPdf(brandId, labeled));
    for (const page of await merged.copyPages(sheet, sheet.getPageIndices())) merged.addPage(page);
  }
  let missing = ids.length - urls.length;
  const labelPages: PDFPage[] = [];
  for (const bytes of files) {
    if (!bytes) {
      missing += 1;
      continue;
    }
    try {
      labelPages.push(...(await PDFDocument.load(bytes, { ignoreEncryption: true })).getPages());
    } catch {
      missing += 1;
    }
  }
  missing += (await addLabelSheets(merged, labelPages)).failed;
  if (merged.getPageCount() === 0) {
    throw new EnviaServiceError("No se pudo descargar ninguna guía. Descárgalas desde cada pedido o desde tu cuenta de Envia.");
  }
  return { pdf: await merged.save(), missing };
}

type TrackedOrder = Pick<StoreOrder, "id" | "status" | "trackingNumber" | "fulfillmentStatus" | "enviaStatus">;

/// Deja el pedido preparado y sin guía (se anuló), para crear otra.
async function clearEnviaLabel(orderId: string) {
  await prisma.storeOrder.update({
    where: { id: orderId },
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
}

/// Guarda el último estado de cada guía y mueve el pedido:
/// - La transportadora recogió el paquete: pasa a enviado y la compradora
///   recibe el correo con el seguimiento (antes no, ver createWith).
/// - Entregado: pasa a entregado (si nunca se vio en camino, sin el correo
///   de "va en camino").
/// - Guía anulada en Envia: el pedido queda preparado y sin guía.
async function applyTracking(
  conn: Pick<EnviaConnection, "brandId" | "sandbox">,
  orders: TrackedOrder[],
  results: { trackingNumber: string; status: string | null }[],
) {
  let shipped = 0;
  let delivered = 0;
  for (const order of orders) {
    const status = results.find((r) => r.trackingNumber === order.trackingNumber)?.status;
    if (!status) continue;
    const stage = enviaStatusStage(status);
    // (Un pedido devuelto se deja como está, con el estado de la guía.)
    if (stage === "canceled" && order.status === "PAID" && order.fulfillmentStatus !== "DELIVERED") {
      await clearEnviaLabel(order.id);
      continue;
    }
    if (status !== order.enviaStatus) {
      await prisma.storeOrder.update({ where: { id: order.id }, data: { enviaStatus: status } });
    }
    const sent = order.fulfillmentStatus === "SHIPPED" || order.fulfillmentStatus === "DELIVERED";
    try {
      if (stage === "delivered" && order.fulfillmentStatus !== "DELIVERED") {
        await updateOrderFulfillment(conn.brandId, { orderId: order.id, fulfillmentStatus: "DELIVERED" }, { notifyBuyer: false });
        delivered += 1;
      } else if (stage === "transit" && !sent) {
        // Una guía de prueba no es real: la compradora no se entera.
        await updateOrderFulfillment(
          conn.brandId,
          { orderId: order.id, fulfillmentStatus: "SHIPPED" },
          { notifyBuyer: !conn.sandbox },
        );
        shipped += 1;
      }
    } catch (err) {
      // Ej. el pedido se devolvió mientras tanto: se deja como está.
      if (!(err instanceof StoreOrderError)) throw err;
    }
  }
  return { shipped, delivered };
}

const trackedSelect = { id: true, status: true, trackingNumber: true, fulfillmentStatus: true, enviaStatus: true } as const;

/// Las guías de Envia que faltan por entregar (de los últimos 45 días),
/// las más nuevas primero.
function openEnviaOrders(where: { brandId?: string }, take: number) {
  return prisma.storeOrder.findMany({
    where: {
      ...where,
      status: "PAID",
      fulfillmentStatus: { not: "DELIVERED" },
      enviaCarrier: { not: null },
      trackingNumber: { not: null },
      enviaLabelAt: { gte: new Date(Date.now() - 45 * 24 * 60 * 60_000) },
    },
    select: { ...trackedSelect, brandId: true },
    orderBy: { enviaLabelAt: "desc" },
    take,
  });
}

/// "Actualizar estado" en el pedido.
export async function refreshOrderTracking(brandId: string, orderId: string) {
  const conn = await requireConnection(brandId);
  const order = await prisma.storeOrder.findFirst({
    where: { id: orderId, brandId, enviaCarrier: { not: null } },
    select: trackedSelect,
  });
  if (!order?.trackingNumber) throw new EnviaServiceError("Este pedido no tiene guía de Envia.");
  const results = await trackShipments(authOf(conn), [order.trackingNumber]).catch(friendly);
  await applyTracking(conn, [order], results);
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
  await clearEnviaLabel(order.id);
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
/// marca. Si el aviso no trae un número de guía de un pedido (otro formato
/// de aviso, o una guía hecha por fuera de Marcolini), se revisan las guías
/// sin entregar más nuevas de la marca.
export async function processEnviaWebhook(conn: EnviaConnection, payload: unknown) {
  await prisma.enviaConnection.update({ where: { id: conn.id }, data: { lastWebhookAt: new Date() } });
  const numbers = trackingNumbersIn(payload).slice(0, 50);
  let orders =
    numbers.length > 0
      ? await prisma.storeOrder.findMany({
          where: { brandId: conn.brandId, trackingNumber: { in: numbers }, enviaCarrier: { not: null } },
          select: trackedSelect,
        })
      : [];
  if (orders.length === 0) orders = await openEnviaOrders({ brandId: conn.brandId }, TRACK_BATCH);
  if (orders.length === 0) return { shipped: 0, delivered: 0 };
  const results = await trackShipments(
    authOf(conn),
    orders.map((o) => o.trackingNumber!),
  );
  return applyTracking(conn, orders, results);
}

/// Repaso diario (cron) de las guías sin entregar, por si un aviso de Envia
/// no llegó o la marca no configuró los avisos: las que la transportadora
/// ya recogió pasan a enviadas (con el correo) y las entregadas, a entregadas.
export async function refreshShippedEnviaOrders() {
  const orders = await openEnviaOrders({}, 500);
  const byBrand = new Map<string, typeof orders>();
  for (const o of orders) byBrand.set(o.brandId, [...(byBrand.get(o.brandId) ?? []), o]);

  let shipped = 0;
  let delivered = 0;
  for (const [brandId, brandOrders] of byBrand) {
    const conn = await getEnviaConnection(brandId);
    if (!conn) continue;
    for (let i = 0; i < brandOrders.length; i += TRACK_BATCH) {
      const batch = brandOrders.slice(i, i + TRACK_BATCH);
      try {
        const results = await trackShipments(authOf(conn), batch.map((o) => o.trackingNumber!));
        const moved = await applyTracking(conn, batch, results);
        shipped += moved.shipped;
        delivered += moved.delivered;
      } catch (err) {
        console.error(`[envia] No se pudo revisar el estado de las guías de la marca ${brandId}:`, err);
      }
    }
  }
  return { checked: orders.length, shipped, delivered };
}
