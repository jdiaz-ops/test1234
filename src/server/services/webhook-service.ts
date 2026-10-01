import { createHash, createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ROOT_DOMAIN } from "@/lib/subdomain";
import { orderNumber } from "@/lib/order-math";
import { isWebhookTopic, type WebhookTopic } from "@/lib/webhook-topics";

/// Conexiones: webhooks salientes de una tienda. Cuando pasa algo (un
/// pedido se paga, sale, se devuelve; un cliente nuevo) se manda en JSON a
/// las URLs que la marca registró para ese evento.
///
/// Formato Shopify a propósito: mismos nombres de evento, mismos campos de
/// pedido y cliente, mismos encabezados (X-Shopify-Topic,
/// X-Shopify-Hmac-Sha256...). Así la marca pega las mismas URLs que ya
/// usaba en Shopify — la de Dataico para facturación electrónica (factura
/// cuando llega financial_status = "paid"), sus Google Sheets, Zapier — sin
/// que esos sistemas tengan que cambiar nada. Ver conversación del
/// 2026-10-01.

export class WebhookError extends Error {}

const MAX_WEBHOOKS_PER_BRAND = 20;
const DELIVERY_TIMEOUT_MS = 10_000;
/// Reintentos seguidos dentro del mismo envío (además del cron diario y
/// del botón "Reenviar").
const INLINE_RETRY_DELAYS_MS = [0, 2_000, 6_000];
const MAX_TOTAL_ATTEMPTS = 8;
const API_VERSION = "2024-10";

// ---------------------------------------------------------------------------
// URL: solo https públicas
// ---------------------------------------------------------------------------

function isPrivateAddress(address: string) {
  const v4 = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/// Una URL de webhook la escribe la marca y la llama nuestro servidor: si
/// apuntara a una dirección interna (localhost, la red de Vercel, la
/// metadata de la nube) alguien podría usar Marcolini para tocar cosas
/// que no son públicas. Solo se aceptan https a direcciones públicas — se
/// revisa al guardar y otra vez antes de cada envío.
export async function assertPublicHttpsUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new WebhookError("Esa URL no es válida. Cópiala completa, empezando por https://");
  }
  if (url.protocol !== "https:") throw new WebhookError("La URL tiene que empezar por https://");
  if (url.username || url.password) throw new WebhookError("La URL no puede llevar usuario ni contraseña.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new WebhookError("La URL tiene que ser una dirección pública de internet.");
  }
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true }).then(
        (r) => r.map((a) => a.address),
        () => {
          throw new WebhookError("No encontramos esa dirección. Revisa que la URL esté bien escrita.");
        },
      );
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new WebhookError("La URL tiene que ser una dirección pública de internet.");
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Configuración de la marca
// ---------------------------------------------------------------------------

export async function getWebhookSigningSecret(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: { webhookSigningSecret: true },
  });
  if (brand.webhookSigningSecret) return brand.webhookSigningSecret;
  const secret = randomBytes(32).toString("hex");
  // Si dos pestañas lo crean a la vez, gana la primera.
  await prisma.brandProfile.updateMany({
    where: { id: brandId, webhookSigningSecret: null },
    data: { webhookSigningSecret: secret },
  });
  return (await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: { webhookSigningSecret: true },
  })).webhookSigningSecret!;
}

export async function listBrandWebhooks(brandId: string) {
  return prisma.brandWebhook.findMany({
    where: { brandId },
    orderBy: { createdAt: "asc" },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          topic: true,
          test: true,
          status: true,
          attempts: true,
          lastStatusCode: true,
          lastError: true,
          createdAt: true,
          deliveredAt: true,
          payload: true,
        },
      },
    },
  });
}

export async function createBrandWebhook(brandId: string, data: { topic: string; url: string }) {
  if (!isWebhookTopic(data.topic)) throw new WebhookError("Elige un evento.");
  const url = await assertPublicHttpsUrl(data.url);
  const count = await prisma.brandWebhook.count({ where: { brandId } });
  if (count >= MAX_WEBHOOKS_PER_BRAND) {
    throw new WebhookError(`Puedes tener hasta ${MAX_WEBHOOKS_PER_BRAND} webhooks.`);
  }
  await getWebhookSigningSecret(brandId);
  return prisma.brandWebhook.create({ data: { brandId, topic: data.topic, url } });
}

export async function deleteBrandWebhook(brandId: string, webhookId: string) {
  const result = await prisma.brandWebhook.deleteMany({ where: { id: webhookId, brandId } });
  if (result.count === 0) throw new WebhookError("Webhook no encontrado.");
}

// ---------------------------------------------------------------------------
// Payloads con formato Shopify
// ---------------------------------------------------------------------------

/// Los sistemas que reciben webhooks de Shopify esperan ids numéricos;
/// los nuestros son texto. Un número estable derivado del id.
function numericId(value: string) {
  return parseInt(createHash("sha256").update(value).digest("hex").slice(0, 13), 16);
}

const money = (cents: number) => (cents / 100).toFixed(2);
const moneySet = (cents: number, currency: string) => ({
  shop_money: { amount: money(cents), currency_code: currency },
  presentment_money: { amount: money(cents), currency_code: currency },
});

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

const orderInclude = {
  brand: { select: { storefrontSlug: true, taxRatePercent: true } },
  items: {
    orderBy: { id: "asc" },
    include: {
      product: { select: { sku: true } },
      variant: { select: { sku: true } },
    },
  },
} satisfies Prisma.StoreOrderInclude;

type OrderForPayload = Prisma.StoreOrderGetPayload<{ include: typeof orderInclude }>;

const FINANCIAL_STATUS: Record<string, string> = {
  PENDING: "pending",
  PAID: "paid",
  REFUNDED: "refunded",
  FAILED: "voided",
  EXPIRED: "voided",
};

function customerPayload(c: {
  email: string;
  name: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
  notes?: string | null;
  emailSubscribed?: boolean;
  address?: Record<string, unknown> | null;
}) {
  const { first, last } = splitName(c.name ?? "");
  const id = numericId(c.email.toLowerCase());
  return {
    id,
    email: c.email,
    first_name: first,
    last_name: last,
    phone: c.phone,
    state: "enabled",
    verified_email: true,
    tax_exempt: false,
    currency: "COP",
    note: c.notes ?? null,
    tags: (c.tags ?? []).join(", "),
    accepts_marketing: c.emailSubscribed ?? false,
    created_at: c.createdAt.toISOString(),
    updated_at: (c.updatedAt ?? c.createdAt).toISOString(),
    default_address: c.address ? { ...c.address, customer_id: id, default: true } : null,
    admin_graphql_api_id: `gid://shopify/Customer/${id}`,
  };
}

export function buildOrderPayload(order: OrderForPayload) {
  const currency = order.currency;
  const rate = Number(order.brand.taxRatePercent) / 100;
  const id = order.number;
  const { first, last } = splitName(order.buyerName);
  const address = order.shippingAddress
    ? {
        first_name: first,
        last_name: last,
        name: order.buyerName,
        address1: order.shippingAddress,
        address2: null,
        city: order.shippingCity,
        province: order.shippingRegion,
        country: "Colombia",
        country_code: "CO",
        zip: null,
        phone: order.buyerPhone,
        company: order.billingName,
      }
    : null;

  // El descuento del código se reparte entre las líneas en proporción a lo
  // que pesa cada una, como lo hace Shopify con discount_allocations.
  const lines = order.items.map((item) => item.unitPriceCents * item.quantity);
  let discountLeft = order.discountCents;
  const allocations = lines.map((lineCents, i) => {
    if (i === lines.length - 1) return discountLeft;
    const share = order.subtotalCents > 0 ? Math.round((order.discountCents * lineCents) / order.subtotalCents) : 0;
    discountLeft -= share;
    return share;
  });

  const line_items = order.items.map((item, i) => {
    const lineCents = lines[i];
    const lineNet = lineCents - allocations[i];
    // Precios con IVA incluido: el impuesto es la parte del total que
    // corresponde a la tasa.
    const lineTax = rate > 0 ? Math.round(lineNet - lineNet / (1 + rate)) : 0;
    return {
      id: id * 1000 + i + 1,
      admin_graphql_api_id: `gid://shopify/LineItem/${id * 1000 + i + 1}`,
      product_id: item.productId ? numericId(item.productId) : null,
      variant_id: item.variantId ? numericId(item.variantId) : item.productId ? numericId(item.productId) : null,
      title: item.name,
      name: item.variantLabel ? `${item.name} - ${item.variantLabel}` : item.name,
      variant_title: item.variantLabel,
      sku: item.variant?.sku ?? item.product?.sku ?? null,
      vendor: null,
      quantity: item.quantity,
      current_quantity: item.quantity,
      price: money(item.unitPriceCents),
      price_set: moneySet(item.unitPriceCents, currency),
      total_discount: money(allocations[i]),
      total_discount_set: moneySet(allocations[i], currency),
      discount_allocations:
        allocations[i] > 0
          ? [{ amount: money(allocations[i]), amount_set: moneySet(allocations[i], currency), discount_application_index: 0 }]
          : [],
      taxable: rate > 0,
      tax_lines:
        rate > 0 ? [{ title: "IVA", rate, price: money(lineTax), price_set: moneySet(lineTax, currency) }] : [],
      requires_shipping: Boolean(order.shippingAddress),
      fulfillment_status:
        order.fulfillmentStatus === "SHIPPED" || order.fulfillmentStatus === "DELIVERED" ? "fulfilled" : null,
      gift_card: false,
      properties: [],
    };
  });

  const discountPercent =
    order.subtotalCents > 0 ? ((order.discountCents / order.subtotalCents) * 100).toFixed(1) : "0.0";
  const totalTax = order.taxCents;
  const fulfilled = order.fulfillmentStatus === "SHIPPED" || order.fulfillmentStatus === "DELIVERED";

  return {
    id,
    admin_graphql_api_id: `gid://shopify/Order/${id}`,
    name: `#${orderNumber(order.reference)}`,
    order_number: 1000 + id,
    number: id,
    token: order.reference,
    email: order.buyerEmail,
    contact_email: order.buyerEmail,
    phone: order.buyerPhone,
    created_at: order.createdAt.toISOString(),
    updated_at: order.updatedAt.toISOString(),
    processed_at: (order.paidAt ?? order.createdAt).toISOString(),
    closed_at: null,
    cancelled_at: null,
    cancel_reason: null,
    confirmed: order.status === "PAID" || order.status === "REFUNDED",
    test: order.paymentMode === "TEST",
    currency,
    presentment_currency: currency,
    financial_status: FINANCIAL_STATUS[order.status] ?? "pending",
    fulfillment_status: fulfilled ? "fulfilled" : null,
    taxes_included: true,
    total_price: money(order.totalCents),
    total_price_set: moneySet(order.totalCents, currency),
    current_total_price: money(order.status === "REFUNDED" ? 0 : order.totalCents),
    subtotal_price: money(order.subtotalCents - order.discountCents),
    subtotal_price_set: moneySet(order.subtotalCents - order.discountCents, currency),
    total_line_items_price: money(order.subtotalCents),
    total_line_items_price_set: moneySet(order.subtotalCents, currency),
    total_discounts: money(order.discountCents),
    total_discounts_set: moneySet(order.discountCents, currency),
    total_tax: money(totalTax),
    total_tax_set: moneySet(totalTax, currency),
    total_shipping_price_set: moneySet(order.shippingCents, currency),
    tax_lines: rate > 0 ? [{ title: "IVA", rate, price: money(totalTax), price_set: moneySet(totalTax, currency) }] : [],
    discount_codes: order.discountCode
      ? [{ code: order.discountCode, amount: money(order.discountCents), type: "percentage" }]
      : [],
    discount_applications: order.discountCode
      ? [
          {
            type: "discount_code",
            code: order.discountCode,
            title: order.discountCode,
            value: discountPercent,
            value_type: "percentage",
            allocation_method: "across",
            target_selection: "all",
            target_type: "line_item",
          },
        ]
      : [],
    line_items,
    shipping_lines:
      order.shippingAddress || order.shippingCents > 0
        ? [
            {
              id: id * 1000,
              title: "Envío",
              code: "Envío",
              source: "marcolini",
              price: money(order.shippingCents),
              price_set: moneySet(order.shippingCents, currency),
              discounted_price: money(order.shippingCents),
              tax_lines: [],
            },
          ]
        : [],
    shipping_address: address,
    billing_address: address,
    customer: customerPayload({
      email: order.buyerEmail,
      name: order.buyerName,
      phone: order.buyerPhone,
      createdAt: order.createdAt,
      address,
    }),
    fulfillments:
      fulfilled && order.trackingNumber
        ? [
            {
              id: id * 1000 + 999,
              status: "success",
              tracking_company: order.carrier,
              tracking_number: order.trackingNumber,
              created_at: (order.shippedAt ?? order.updatedAt).toISOString(),
            },
          ]
        : [],
    refunds: order.refundedAt
      ? [{ id: id * 1000 + 998, created_at: order.refundedAt.toISOString(), note: order.refundReason, restock: order.restocked }]
      : [],
    note: order.shippingNotes,
    // Datos de factura que dio el comprador (cédula/NIT), para el sistema
    // de facturación que reciba el pedido.
    note_attributes:
      order.billingIdType && order.billingIdNumber
        ? [
            { name: "tipo_documento", value: order.billingIdType },
            { name: "numero_documento", value: order.billingIdNumber },
            ...(order.billingName ? [{ name: "razon_social", value: order.billingName }] : []),
          ]
        : [],
    tags: "",
    gateway: "wompi",
    payment_gateway_names: ["wompi"],
    source_name: "marcolini",
    order_status_url: null,
  };
}

// ---------------------------------------------------------------------------
// Envío
// ---------------------------------------------------------------------------

/// Corre `work` después de responder si estamos dentro de una petición
/// (no demora el webhook de Wompi ni la acción de la marca); fuera de una
/// petición (pruebas, scripts) lo corre directo.
function runLater(work: () => Promise<void>) {
  try {
    after(work);
  } catch {
    return work();
  }
}

async function attemptDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      webhook: {
        include: { brand: { select: { storefrontSlug: true, webhookSigningSecret: true, id: true } } },
      },
    },
  });
  if (!delivery || delivery.status === "SUCCEEDED") return delivery?.status ?? null;

  const { webhook } = delivery;
  const body = JSON.stringify(delivery.payload);
  const secret = webhook.brand.webhookSigningSecret ?? (await getWebhookSigningSecret(webhook.brand.id));
  const hmac = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const now = new Date();

  let statusCode: number | null = null;
  let error: string | null = null;
  try {
    await assertPublicHttpsUrl(webhook.url);
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Marcolini-Webhooks/1.0",
        "X-Shopify-Topic": delivery.topic,
        "X-Shopify-Hmac-Sha256": hmac,
        "X-Shopify-Shop-Domain": `${webhook.brand.storefrontSlug ?? "tienda"}.${ROOT_DOMAIN}`,
        "X-Shopify-API-Version": API_VERSION,
        "X-Shopify-Webhook-Id": delivery.id,
        "X-Shopify-Event-Id": delivery.id,
        "X-Shopify-Triggered-At": delivery.createdAt.toISOString(),
        "X-Marcolini-Topic": delivery.topic,
        "X-Marcolini-Hmac-Sha256": hmac,
        "X-Marcolini-Delivery-Id": delivery.id,
      },
      body,
      // Muchos receptores (ej. Google Apps Script) responden un redirect
      // después de procesar: el pedido ya llegó, no se sigue.
      redirect: "manual",
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      cache: "no-store",
    });
    statusCode = res.status;
    // 2xx = recibido; 3xx = recibido y nos mandan a otro lado (Apps Script).
    if (res.status >= 400) error = `Respondió ${res.status}`;
  } catch (err) {
    error =
      err instanceof WebhookError
        ? err.message
        : err instanceof Error && err.name === "TimeoutError"
          ? "No respondió a tiempo (10 segundos)."
          : "No se pudo conectar con la URL.";
  }

  const succeeded = error === null;
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attempts: { increment: 1 },
      lastAttemptAt: now,
      lastStatusCode: statusCode,
      lastError: error,
      status: succeeded ? "SUCCEEDED" : "FAILED",
      deliveredAt: succeeded ? now : null,
    },
  });
  return succeeded ? "SUCCEEDED" : "FAILED";
}

async function deliverWithRetries(deliveryIds: string[]) {
  await Promise.all(
    deliveryIds.map(async (id) => {
      for (const delay of INLINE_RETRY_DELAYS_MS) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        try {
          if ((await attemptDelivery(id)) !== "FAILED") return;
        } catch (err) {
          console.error(`[webhooks] Falló el envío ${id}:`, err);
          return;
        }
      }
    }),
  );
}

async function enqueue(brandId: string, topics: WebhookTopic[], payload: object) {
  const webhooks = await prisma.brandWebhook.findMany({
    where: { brandId, topic: { in: topics } },
    select: { id: true, topic: true },
  });
  if (webhooks.length === 0) return [];
  const deliveries = await prisma.$transaction(
    webhooks.map((w) =>
      prisma.webhookDelivery.create({
        data: { webhookId: w.id, topic: w.topic, payload: payload as Prisma.InputJsonValue },
        select: { id: true },
      }),
    ),
  );
  return deliveries.map((d) => d.id);
}

/// Avisa a los webhooks de la marca que escuchan estos eventos de pedido.
/// Nunca tira error: un webhook caído no puede tumbar un pago ni una
/// acción de la marca.
export async function emitOrderEvent(orderId: string, topics: WebhookTopic[]) {
  try {
    const order = await prisma.storeOrder.findUnique({ where: { id: orderId }, include: orderInclude });
    // Las muestras ($0) no son ventas, y los pedidos hechos en modo de
    // prueba de Wompi no se cobraron de verdad: ninguno de los dos se
    // envía, para que un sistema de facturación (Dataico) nunca emita una
    // factura ante la DIAN por algo que no fue una venta.
    if (!order || order.kind !== "PURCHASE" || order.paymentMode === "TEST") return;
    const ids = await enqueue(order.brandId, topics, buildOrderPayload(order));
    if (ids.length > 0) await runLater(() => deliverWithRetries(ids));
  } catch (err) {
    console.error(`[webhooks] No se pudo preparar el aviso del pedido ${orderId}:`, err);
  }
}

export async function emitCustomerEvent(brandId: string, email: string, topic: "customers/create" | "customers/update") {
  try {
    const customer = await prisma.storeCustomer.findUnique({
      where: { brandId_email: { brandId, email: email.toLowerCase() } },
    });
    if (!customer) return;
    const ids = await enqueue(
      brandId,
      [topic],
      customerPayload({
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        tags: customer.tags,
        notes: customer.notes,
        emailSubscribed: customer.emailSubscribed,
      }),
    );
    if (ids.length > 0) await runLater(() => deliverWithRetries(ids));
  } catch (err) {
    console.error(`[webhooks] No se pudo preparar el aviso del cliente ${email}:`, err);
  }
}

/// "Enviar prueba": un pedido o cliente de ejemplo (test = true) al
/// webhook, y se espera el resultado para mostrarlo en la página.
export async function sendTestWebhook(brandId: string, webhookId: string) {
  const webhook = await prisma.brandWebhook.findFirst({
    where: { id: webhookId, brandId },
    include: { brand: { select: { taxRatePercent: true, storefrontSlug: true } } },
  });
  if (!webhook) throw new WebhookError("Webhook no encontrado.");

  const now = new Date();
  // El pedido de ejemplo va "voided" (anulado), como el de Shopify: así
  // Dataico, que factura cuando llega financial_status = "paid", no emite
  // una factura real por la prueba.
  const payload = webhook.topic.startsWith("customers/")
    ? customerPayload({ email: "cliente.prueba@example.com", name: "Cliente de Prueba", phone: "3000000000", createdAt: now })
    : buildOrderPayload({
        id: "prueba",
        number: 999999,
        brandId,
        kind: "PURCHASE",
        reference: "mt_prueba_00000000",
        buyerName: "Cliente de Prueba",
        buyerEmail: "cliente.prueba@example.com",
        buyerPhone: "3000000000",
        shippingAddress: "Calle 1 # 2-3",
        shippingCity: "Medellín",
        shippingRegion: "Antioquia",
        shippingNotes: null,
        servicePreferredAt: null,
        discountCode: null,
        subtotalCents: 4_000_000,
        discountCents: 0,
        shippingCents: 1_000_000,
        taxCents: Math.round(5_000_000 - 5_000_000 / (1 + Number(webhook.brand.taxRatePercent) / 100)),
        totalCents: 5_000_000,
        currency: "COP",
        paymentMode: "TEST",
        status: "PAID",
        fulfillmentStatus: "UNFULFILLED",
        carrier: null,
        trackingNumber: null,
        preparedAt: null,
        shippedAt: null,
        deliveredAt: null,
        internalNotes: null,
        wompiTransactionId: null,
        wompiStatus: null,
        transactionId: null,
        createdAt: now,
        updatedAt: now,
        paidAt: now,
        refundedAt: null,
        refundReason: null,
        restocked: false,
        dataConsentAt: now,
        brand: webhook.brand,
        items: [
          {
            id: "prueba-1",
            orderId: "prueba",
            productId: null,
            variantId: null,
            variantLabel: null,
            name: "Producto de prueba",
            unitPriceCents: 4_000_000,
            quantity: 1,
            imageUrl: null,
            serviceConfirmedAt: null,
            serviceMeetingInfo: null,
            product: null,
            variant: null,
          },
        ],
      } as unknown as OrderForPayload);
  if ("financial_status" in payload) Object.assign(payload, { financial_status: "voided", test: true });

  const delivery = await prisma.webhookDelivery.create({
    data: { webhookId: webhook.id, topic: webhook.topic, payload: payload as Prisma.InputJsonValue, test: true },
  });
  await attemptDelivery(delivery.id);
  return prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
}

export async function resendDelivery(brandId: string, deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findFirst({
    where: { id: deliveryId, webhook: { brandId } },
  });
  if (!delivery) throw new WebhookError("Envío no encontrado.");
  await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: "PENDING" } });
  await attemptDelivery(delivery.id);
  return prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
}

/// Cron: reintenta lo que no llegó en las últimas 72 horas (hasta 8
/// intentos en total) y borra el historial de más de 30 días.
export async function retryFailedDeliveries() {
  const since = new Date(Date.now() - 72 * 3600 * 1000);
  const failed = await prisma.webhookDelivery.findMany({
    where: { status: { in: ["FAILED", "PENDING"] }, test: false, createdAt: { gte: since }, attempts: { lt: MAX_TOTAL_ATTEMPTS } },
    select: { id: true },
    take: 200,
  });
  let succeeded = 0;
  for (const d of failed) {
    if ((await attemptDelivery(d.id).catch(() => "FAILED")) === "SUCCEEDED") succeeded++;
  }
  const pruned = await prisma.webhookDelivery.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
  });
  return { retried: failed.length, succeeded, pruned: pruned.count };
}
