import { after } from "next/server";
import type { ExternalSale, Prisma, StoreOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { orderNumber } from "@/lib/order-math";
import { resolveDaneLocation } from "@/lib/dane";
import { dataicoAllowed } from "@/lib/features";
import { fetchWompiTransaction, getActiveWompiKeys } from "@/server/integrations/wompi-client";

/// Conexión directa con la API de Dataico (facturación electrónica ante la
/// DIAN): cada venta pagada se factura sola. Contrato tomado de la
/// especificación OpenAPI 2.0.0 de Dataico (servidor
/// https://api.dataico.com/dataico_api/v2, encabezado auth-token, POST
/// /invoices con { actions, invoice }). Ver conversación del 2026-10-01.
///
/// Alternativa sin esto: el webhook con la "Shopify url" de Dataico (ver
/// webhook-service.ts). Se usa una u otra — con las dos, cada venta
/// saldría facturada dos veces.

export class DataicoError extends Error {}

const DATAICO_API = "https://api.dataico.com/dataico_api/v2";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 6;

/// Consumidor final: la DIAN permite facturar sin identificar al
/// comprador con este número.
const FINAL_CONSUMER_ID = "222222222222";

export const BILLING_ID_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "NIT", label: "NIT (empresa)" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "PPT", label: "Permiso por protección temporal" },
] as const;

export type BillingIdType = (typeof BILLING_ID_TYPES)[number]["value"];

export function isBillingIdType(value: string): value is BillingIdType {
  return BILLING_ID_TYPES.some((t) => t.value === value);
}

/// IVA que acepta la DIAN (según la especificación de Dataico).
const VALID_IVA_RATES = [0, 5, 16, 19];

async function dataicoFetch(path: string, authToken: string, init: { method: string; body?: unknown }) {
  let res: Response;
  try {
    res = await fetch(`${DATAICO_API}${path}`, {
      method: init.method,
      headers: { "Content-Type": "application/json", Accept: "application/json", "auth-token": authToken },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    throw new DataicoError(
      err instanceof Error && err.name === "TimeoutError"
        ? "Dataico no respondió a tiempo. Intenta de nuevo en un momento."
        : "No se pudo conectar con Dataico.",
    );
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, ok: res.ok, body };
}

/// Convierte la respuesta de error de Dataico ({ errors: {...} } o
/// { errors: [{ message, path }] } o texto) en una frase para la marca.
export function describeDataicoError(status: number, body: unknown): string {
  if (status === 401 || status === 403) {
    return "Dataico rechazó el token. Revisa el Auth Token y el Account ID en Conexiones.";
  }
  const parts: string[] = [];
  const walk = (value: unknown, prefix: string) => {
    if (value == null) return;
    if (typeof value === "string") parts.push(prefix ? `${prefix}: ${value}` : value);
    else if (Array.isArray(value)) value.forEach((v) => walk(v, prefix));
    else if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.message === "string") {
        parts.push(obj.path ? `${obj.path}: ${obj.message}` : obj.message);
        return;
      }
      for (const [k, v] of Object.entries(obj)) walk(v, prefix ? `${prefix}.${k}` : k);
    }
  };
  const errors = body && typeof body === "object" && "errors" in body ? (body as { errors: unknown }).errors : body;
  walk(errors, "");
  const text = parts.join(" · ").slice(0, 500);
  return text ? `Dataico: ${text}` : `Dataico respondió ${status}.`;
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export async function getDataicoConnection(brandId: string) {
  return prisma.dataicoConnection.findUnique({ where: { brandId } });
}

export async function saveDataicoConnection(
  brandId: string,
  data: {
    accountId: string;
    /// undefined = conservar el guardado (la página no lo recibe completo).
    authToken?: string;
    env: "PRUEBAS" | "PRODUCCION";
    prefix?: string | null;
    resolutionNumber?: string | null;
    nextNumber?: number | null;
    sendEmail: boolean;
    enabled: boolean;
  },
) {
  const current = await getDataicoConnection(brandId);
  const authToken = data.authToken?.trim() || current?.authToken;
  if (!authToken) throw new DataicoError("Pega el Auth Token de Dataico.");
  const accountId = data.accountId.trim();
  if (!accountId) throw new DataicoError("Pega el Account ID de Dataico.");
  if (data.enabled && (!data.prefix || !data.nextNumber)) {
    throw new DataicoError("Para activar la facturación elige la numeración y el siguiente número de factura.");
  }
  const values = {
    accountId,
    authToken,
    env: data.env,
    prefix: data.prefix?.trim() || null,
    resolutionNumber: data.resolutionNumber?.trim() || null,
    nextNumber: data.nextNumber ?? null,
    sendEmail: data.sendEmail,
    enabled: data.enabled,
  };
  return prisma.dataicoConnection.upsert({
    where: { brandId },
    create: { brandId, ...values },
    update: values,
  });
}

export async function deleteDataicoConnection(brandId: string) {
  await prisma.dataicoConnection.deleteMany({ where: { brandId } });
}

export type DataicoNumbering = {
  prefix: string;
  resolutions: { number: string | null; start: number | null; end: number | null; endDate: string | null }[];
};

/// "Probar conexión": trae las numeraciones de factura de la cuenta. Si
/// responde, el token sirve; y la marca elige con cuál facturar.
export async function fetchDataicoNumberings(authToken: string): Promise<DataicoNumbering[]> {
  const res = await dataicoFetch("/numberings/invoice", authToken, { method: "GET" });
  if (!res.ok) throw new DataicoError(describeDataicoError(res.status, res.body));
  const list =
    res.body && typeof res.body === "object" && "numberings" in res.body
      ? (res.body as { numberings: unknown }).numberings
      : res.body;
  if (!Array.isArray(list)) return [];
  return list
    .map((n: Record<string, unknown>) => ({
      prefix: typeof n.prefix === "string" ? n.prefix : "",
      resolutions: (Array.isArray(n.dian_resolutions) ? n.dian_resolutions : []).map((r: Record<string, unknown>) => ({
        number: typeof r.number === "string" ? r.number : null,
        start: typeof r.start === "number" ? r.start : null,
        end: typeof r.end === "number" ? r.end : null,
        endDate: typeof r["end-date"] === "string" ? (r["end-date"] as string) : null,
      })),
    }))
    .filter((n) => n.prefix);
}

// ---------------------------------------------------------------------------
// La factura
// ---------------------------------------------------------------------------

const invoiceOrderInclude = {
  brand: { select: { taxRatePercent: true, paymentMode: true, storefrontSlug: true } },
  items: {
    orderBy: { id: "asc" },
    include: {
      product: { select: { sku: true, slug: true } },
      variant: { select: { sku: true } },
    },
  },
} satisfies Prisma.StoreOrderInclude;

type InvoiceOrder = Prisma.StoreOrderGetPayload<{ include: typeof invoiceOrderInclude }>;

/// dd/MM/yyyy HH:mm:ss en hora de Colombia, como lo pide Dataico.
export function dataicoDate(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}`;
}

/// Medio de pago de Wompi → código de Dataico.
export function paymentMeansFor(wompiMethod: string | null | undefined) {
  switch (wompiMethod) {
    case "CARD":
      return "CREDIT_CARD";
    case "PSE":
      return "DEBIT_ACH";
    case "BANCOLOMBIA_COLLECT":
      return "CASH";
    default:
      return "DEBIT_TRANSFER";
  }
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "Cliente";
  return { first, last: parts.slice(1).join(" ") || first };
}

/// Quien compra, como lo pide la factura: un pedido de la tienda o una venta
/// de otra plataforma (ExternalSale), que no trae dirección.
type InvoiceParty = Pick<StoreOrder, "billingIdType" | "billingIdNumber" | "billingName" | "buyerName" | "buyerFirstName" | "buyerLastName" | "buyerEmail"> & {
  buyerPhone: string | null;
} & Partial<Pick<StoreOrder, "billingAddress" | "billingRegion" | "billingCity" | "shippingAddress" | "shippingRegion" | "shippingCity">>;

function customerFor(order: InvoiceParty) {
  const type = order.billingIdType && isBillingIdType(order.billingIdType) ? order.billingIdType : null;
  const raw = order.billingIdNumber?.trim();
  if (!type || !raw) {
    return {
      party_identification: FINAL_CONSUMER_ID,
      party_identification_type: "CC",
      party_type: "PERSONA_NATURAL",
      tax_level_code: "NO_RESPONSABLE_DE_IVA",
      regimen: "ORDINARIO",
      first_name: "Consumidor",
      family_name: "Final",
      country_code: "CO",
    };
  }
  // El NIT va sin dígito de verificación ("900123456-7" → "900123456").
  const identification = type === "NIT" ? raw.replace(/-\d$/, "").replace(/\D/g, "") : raw.replace(/[\s.]/g, "");
  const split = splitName(order.buyerName);
  const first = order.buyerFirstName?.trim() || split.first;
  const last = order.buyerLastName?.trim() || split.last;
  const company = type === "NIT";
  // Dataico exige departamento y ciudad (en código DANE) junto con la
  // dirección; si la ciudad no se puede identificar sin dudas, la factura
  // sale sin dirección (la DIAN no la exige para quien compra) en vez de
  // fallar. Antes se mandaba solo la dirección y Dataico la rechazaba:
  // "Departamento '' es inválido". Ver lib/dane.ts.
  const useBilling = Boolean(order.billingAddress);
  const addressLine = useBilling ? order.billingAddress : order.shippingAddress;
  const location = addressLine
    ? resolveDaneLocation(
        (useBilling ? order.billingRegion : order.shippingRegion) ?? null,
        (useBilling ? order.billingCity : order.shippingCity) ?? null,
      )
    : null;
  return {
    party_identification: identification,
    party_identification_type: type,
    party_type: company ? "PERSONA_JURIDICA" : "PERSONA_NATURAL",
    tax_level_code: "NO_RESPONSABLE_DE_IVA",
    regimen: "ORDINARIO",
    ...(company ? { company_name: order.billingName?.trim() || order.buyerName } : { first_name: first, family_name: last }),
    email: order.buyerEmail,
    ...(order.buyerPhone != null ? { phone: order.buyerPhone } : {}),
    ...(addressLine && location
      ? { address_line: addressLine, department: location.department, city: location.city }
      : {}),
    country_code: "CO",
  };
}

/// El cuerpo de POST /invoices. Los precios de Marcolini ya traen el IVA;
/// Dataico espera el precio sin IVA y la tasa, y calcula el impuesto. El
/// descuento del código va como % por ítem; el envío como cargo (no lleva
/// IVA en Marcolini, ver createStoreOrder).
export function buildDataicoInvoice(
  order: InvoiceOrder,
  connection: { accountId: string; env: "PRUEBAS" | "PRODUCCION"; prefix: string | null; resolutionNumber: string | null; sendEmail: boolean },
  number: number,
  paymentMeans: string,
) {
  const rate = Number(order.brand.taxRatePercent);
  if (!VALID_IVA_RATES.includes(rate)) {
    throw new DataicoError(`La DIAN solo acepta IVA de 0, 5, 16 o 19 %, y tu tienda tiene ${rate} %. Cámbialo en Configuración → General.`);
  }
  const discountRate =
    order.subtotalCents > 0 && order.discountCents > 0
      ? Math.round((order.discountCents / order.subtotalCents) * 100 * 10_000) / 10_000
      : 0;
  const issued = dataicoDate(order.paidAt ?? order.createdAt);

  return {
    actions: {
      send_dian: true,
      send_email: connection.sendEmail,
      ...(connection.sendEmail ? { email: order.buyerEmail } : {}),
    },
    invoice: {
      env: connection.env,
      dataico_account_id: connection.accountId,
      number: String(number),
      numbering: {
        prefix: connection.prefix,
        ...(connection.resolutionNumber ? { resolution_number: connection.resolutionNumber } : {}),
        flexible: true,
      },
      issue_date: issued,
      payment_date: issued,
      invoice_type_code: "FACTURA_VENTA",
      payment_means_type: "DEBITO",
      payment_means: paymentMeans,
      order_reference: `#${orderNumber(order.reference)}`,
      // La factura es de la marca: no menciona Marcolini (pedido del 2026-10-04).
      notes: [`Pedido #${orderNumber(order.reference)}`],
      customer: customerFor(order),
      items: order.items.map((item, i) => ({
        sku: item.variant?.sku || item.product?.sku || item.product?.slug || `MKL-${order.number}-${i + 1}`,
        description: item.variantLabel ? `${item.name} - ${item.variantLabel}` : item.name,
        quantity: item.quantity,
        price: Math.round((item.unitPriceCents / 100 / (1 + rate / 100)) * 100) / 100,
        ...(discountRate > 0 ? { "discount-rate": discountRate } : {}),
        taxes: [{ "tax-category": "IVA", "tax-rate": rate }],
      })),
      charges:
        order.shippingCents > 0
          ? [{ "base-amount": order.shippingCents / 100, reason: "Envío", discount: false }]
          : [],
    },
  };
}

/// Una línea de una venta externa (ExternalSale.items): el precio con IVA.
export type ExternalSaleItem = { name: string; quantity: number; unitPriceCents: number; taxRate: number };

/// ExternalSale.items leído con cuidado: lo que no tenga forma de línea se
/// descarta (la API ya lo valida al guardarlo).
export function externalSaleItems(raw: unknown): ExternalSaleItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { name, quantity, unitPriceCents, taxRate } = item as Record<string, unknown>;
    return typeof name === "string" && typeof quantity === "number" && typeof unitPriceCents === "number" && typeof taxRate === "number"
      ? [{ name, quantity, unitPriceCents, taxRate }]
      : [];
  });
}

/// "Nail Fest" + su id → "NF-8K2J4M9QXA": la referencia corta de la venta en
/// la factura (las iniciales de la plataforma y el final de su id).
export function externalSaleReference(sale: Pick<ExternalSale, "source" | "externalId">) {
  const initials = sale.source
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return `${initials || "EXT"}-${sale.externalId.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase()}`;
}

/// El cuerpo de POST /invoices para una venta de otra plataforma: igual al
/// de un pedido, con lo vendido tal como lo mandó (sin descuento ni envío) y
/// su propia tasa de IVA por línea.
export function buildExternalSaleInvoice(
  sale: ExternalSale,
  connection: { accountId: string; env: "PRUEBAS" | "PRODUCCION"; prefix: string | null; resolutionNumber: string | null; sendEmail: boolean },
  number: number,
  paymentMeans: string,
) {
  const items = externalSaleItems(sale.items);
  if (items.length === 0) throw new DataicoError("La venta no trae nada que facturar.");
  const wrong = items.find((item) => !VALID_IVA_RATES.includes(item.taxRate));
  if (wrong) throw new DataicoError(`La DIAN solo acepta IVA de 0, 5, 16 o 19 %, y «${wrong.name}» trae ${wrong.taxRate} %.`);
  const issued = dataicoDate(sale.paidAt);
  const reference = externalSaleReference(sale);

  return {
    actions: {
      send_dian: true,
      send_email: connection.sendEmail,
      ...(connection.sendEmail ? { email: sale.buyerEmail } : {}),
    },
    invoice: {
      env: connection.env,
      dataico_account_id: connection.accountId,
      number: String(number),
      numbering: {
        prefix: connection.prefix,
        ...(connection.resolutionNumber ? { resolution_number: connection.resolutionNumber } : {}),
        flexible: true,
      },
      issue_date: issued,
      payment_date: issued,
      invoice_type_code: "FACTURA_VENTA",
      payment_means_type: "DEBITO",
      payment_means: paymentMeans,
      order_reference: reference,
      notes: [`${sale.source} · venta ${reference}`],
      customer: customerFor(sale),
      items: items.map((item, i) => ({
        sku: `${reference.split("-")[0]}-${i + 1}`,
        description: item.name,
        quantity: item.quantity,
        price: Math.round((item.unitPriceCents / 100 / (1 + item.taxRate / 100)) * 100) / 100,
        taxes: [{ "tax-category": "IVA", "tax-rate": item.taxRate }],
      })),
      charges: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Emitir
// ---------------------------------------------------------------------------

async function reserveNumber(brandId: string) {
  const updated = await prisma.dataicoConnection.update({
    where: { brandId },
    data: { nextNumber: { increment: 1 } },
    select: { nextNumber: true },
  });
  return (updated.nextNumber ?? 1) - 1;
}

/// El medio de pago de una transacción de Wompi en la cuenta de la marca.
/// Solo Wompi lo expone por API con la llave pública; con otra pasarela (o
/// sin transacción) se factura con el medio por defecto.
async function wompiPaymentMethod(brandId: string, paymentMode: "TEST" | "PRODUCTION", transactionId: string | null) {
  if (!transactionId) return null;
  try {
    const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });
    const keys = getActiveWompiKeys({ ...brand, paymentMode });
    if (!keys) return null;
    const tx = (await fetchWompiTransaction(paymentMode, keys.publicKey, transactionId)) as { payment_method_type?: string } | undefined;
    return tx?.payment_method_type ?? null;
  } catch {
    return null;
  }
}

export type InvoiceResult = { status: "ISSUED" | "FAILED" | "SKIPPED"; error?: string };

/// Los campos de la factura, que un pedido y una venta externa tienen igual.
type InvoiceFields = {
  einvoiceStatus?: "PENDING" | "ISSUED" | "FAILED";
  einvoiceNumber?: string | null;
  einvoiceUuid?: string | null;
  einvoiceCufe?: string | null;
  einvoicePdfUrl?: string | null;
  einvoiceIssuedAt?: Date | null;
  einvoiceError?: string | null;
  einvoiceAttempts?: number | { increment: number };
};

/// La emisión toma un registro sin factura y sin otra emisión en curso (o
/// con una que quedó colgada hace más de 15 minutos).
function claimable(staleBefore: Date) {
  return {
    einvoiceUuid: null,
    OR: [{ einvoiceStatus: null }, { einvoiceStatus: "FAILED" as const }, { einvoiceStatus: "PENDING" as const, updatedAt: { lt: staleBefore } }],
  };
}
const CLAIM = { einvoiceStatus: "PENDING" as const, einvoiceAttempts: { increment: 1 }, einvoiceError: null };

/// Emite una factura y guarda lo que pasó donde diga `record` (el pedido o
/// la venta externa). Idempotente: si ya tiene factura o hay otra emisión
/// en curso, no hace nada. Reserva el número una sola vez (un reintento usa
/// el mismo), salvo que Dataico diga que ese número ya existe.
async function emitInvoice(params: {
  record: { claim: (staleBefore: Date) => Promise<boolean>; save: (data: InvoiceFields) => Promise<unknown> };
  brandId: string;
  connection: { authToken: string; prefix: string | null };
  reservedNumber: string | null;
  paymentMeans: () => Promise<string>;
  payloadFor: (number: number, paymentMeans: string) => unknown;
}): Promise<InvoiceResult> {
  const { record, brandId, connection } = params;
  if (!(await record.claim(new Date(Date.now() - 15 * 60 * 1000)))) return { status: "SKIPPED" };

  const fail = async (error: string) => {
    await record.save({ einvoiceStatus: "FAILED", einvoiceError: error });
    return { status: "FAILED" as const, error };
  };

  try {
    const paymentMeans = await params.paymentMeans();
    let number = params.reservedNumber ? Number(params.reservedNumber) : await reserveNumber(brandId);
    if (!params.reservedNumber) await record.save({ einvoiceNumber: String(number) });

    for (let attempt = 0; attempt < 3; attempt++) {
      const payload = params.payloadFor(number, paymentMeans);
      const res = await dataicoFetch("/invoices", connection.authToken, { method: "POST", body: payload });
      if (res.ok) {
        const inv = (
          res.body && typeof res.body === "object" && "invoice" in res.body ? (res.body as { invoice: unknown }).invoice : res.body
        ) as Record<string, unknown> | null;
        const rejected = inv?.dian_status === "DIAN_RECHAZADO";
        await record.save({
          einvoiceStatus: rejected ? "FAILED" : "ISSUED",
          einvoiceUuid: typeof inv?.uuid === "string" ? inv.uuid : null,
          einvoiceNumber: typeof inv?.number === "string" ? inv.number : `${connection.prefix}${number}`,
          einvoiceCufe: typeof inv?.cufe === "string" ? inv.cufe : null,
          einvoicePdfUrl: typeof inv?.pdf_url === "string" ? inv.pdf_url : null,
          einvoiceIssuedAt: new Date(),
          einvoiceError: rejected ? "La DIAN rechazó la factura. Revísala en Dataico." : null,
          // Rechazada: no se reintenta sola (crearía otra factura).
          ...(rejected ? { einvoiceAttempts: MAX_ATTEMPTS } : {}),
        });
        return rejected ? { status: "FAILED", error: "La DIAN rechazó la factura." } : { status: "ISSUED" };
      }
      const error = describeDataicoError(res.status, res.body);
      // Ese número ya se usó (ej. alguien facturó a mano en Dataico con la
      // misma numeración): se toma el siguiente y se intenta otra vez.
      if (/n[uú]mero|number/i.test(error) && /duplic|exist|usad/i.test(error)) {
        number = await reserveNumber(brandId);
        await record.save({ einvoiceNumber: String(number) });
        continue;
      }
      return fail(error);
    }
    return fail("Dataico dice que los números de factura ya están usados. Revisa el siguiente número en Conexiones.");
  } catch (err) {
    return fail(err instanceof DataicoError ? err.message : "No se pudo emitir la factura.");
  }
}

/// Emite la factura de un pedido pagado (ver emitInvoice).
export async function issueOrderInvoice(orderId: string): Promise<InvoiceResult> {
  const order = await prisma.storeOrder.findUnique({ where: { id: orderId }, include: invoiceOrderInclude });
  if (!order || order.kind !== "PURCHASE" || order.status !== "PAID") return { status: "SKIPPED" };
  if (!dataicoAllowed(order.brand)) return { status: "SKIPPED" };
  const connection = await getDataicoConnection(order.brandId);
  if (!connection?.enabled || !connection.prefix) return { status: "SKIPPED" };
  // Un pedido de prueba (Wompi en modo prueba) solo se factura en el
  // ambiente de pruebas de Dataico — nunca una factura real por algo que
  // no se cobró.
  if (order.paymentMode === "TEST" && connection.env === "PRODUCCION") return { status: "SKIPPED" };

  return emitInvoice({
    record: {
      claim: async (staleBefore) =>
        (await prisma.storeOrder.updateMany({ where: { id: order.id, ...claimable(staleBefore) }, data: CLAIM })).count > 0,
      save: (data) => prisma.storeOrder.update({ where: { id: order.id }, data }),
    },
    brandId: order.brandId,
    connection,
    reservedNumber: order.einvoiceNumber,
    paymentMeans: async () =>
      paymentMeansFor(order.paymentProvider === "WOMPI" ? await wompiPaymentMethod(order.brandId, order.paymentMode, order.wompiTransactionId) : null),
    payloadFor: (number, paymentMeans) => buildDataicoInvoice(order, connection, number, paymentMeans),
  });
}

/// Emite la factura de una venta de otra plataforma (ExternalSale) con la
/// misma conexión y la misma numeración que los pedidos de la tienda.
export async function issueExternalSaleInvoice(saleId: string): Promise<InvoiceResult> {
  const sale = await prisma.externalSale.findUnique({ where: { id: saleId }, include: { brand: { select: { storefrontSlug: true } } } });
  if (!sale || !dataicoAllowed(sale.brand)) return { status: "SKIPPED" };
  const connection = await getDataicoConnection(sale.brandId);
  if (!connection?.enabled || !connection.prefix) return { status: "SKIPPED" };
  if (sale.paymentMode === "TEST" && connection.env === "PRODUCCION") return { status: "SKIPPED" };

  return emitInvoice({
    record: {
      claim: async (staleBefore) =>
        (await prisma.externalSale.updateMany({ where: { id: sale.id, ...claimable(staleBefore) }, data: CLAIM })).count > 0,
      save: (data) => prisma.externalSale.update({ where: { id: sale.id }, data }),
    },
    brandId: sale.brandId,
    connection,
    reservedNumber: sale.einvoiceNumber,
    paymentMeans: async () => paymentMeansFor(await wompiPaymentMethod(sale.brandId, sale.paymentMode, sale.wompiTransactionId)),
    payloadFor: (number, paymentMeans) => buildExternalSaleInvoice(sale, connection, number, paymentMeans),
  });
}

/// Después de que un pedido queda pagado. Nunca tira error: la factura no
/// puede tumbar un pago. Corre después de responder a Wompi.
export function issueInvoiceAfterPayment(orderId: string) {
  const work = async () => {
    try {
      await issueOrderInvoice(orderId);
    } catch (err) {
      console.error(`[dataico] No se pudo facturar el pedido ${orderId}:`, err);
    }
  };
  try {
    after(work);
  } catch {
    return work();
  }
}

/// La factura de una venta externa, después de responderle a la otra
/// plataforma (la emisión puede tardar). Nunca tira error.
export function issueExternalSaleInvoiceAfter(saleId: string) {
  const work = async () => {
    try {
      await issueExternalSaleInvoice(saleId);
    } catch (err) {
      console.error(`[dataico] No se pudo facturar la venta externa ${saleId}:`, err);
    }
  };
  try {
    after(work);
  } catch {
    return work();
  }
}

/// Cron diario: reintenta las facturas que fallaron en los últimos 7 días,
/// de pedidos y de ventas externas.
export async function retryFailedInvoices() {
  const orders = await prisma.storeOrder.findMany({
    where: {
      status: "PAID",
      einvoiceStatus: { in: ["FAILED", "PENDING"] },
      einvoiceUuid: null,
      einvoiceAttempts: { lt: MAX_ATTEMPTS },
      paidAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    },
    select: { id: true },
    take: 100,
  });
  const sales = await prisma.externalSale.findMany({
    where: {
      einvoiceStatus: { in: ["FAILED", "PENDING"] },
      einvoiceUuid: null,
      einvoiceAttempts: { lt: MAX_ATTEMPTS },
      paidAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
    },
    select: { id: true },
    take: 100,
  });
  let issued = 0;
  for (const o of orders) {
    if ((await issueOrderInvoice(o.id).catch(() => ({ status: "FAILED" }))).status === "ISSUED") issued++;
  }
  for (const sale of sales) {
    if ((await issueExternalSaleInvoice(sale.id).catch(() => ({ status: "FAILED" }))).status === "ISSUED") issued++;
  }
  return { retried: orders.length + sales.length, issued };
}
