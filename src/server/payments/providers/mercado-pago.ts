import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentGatewayError, type PaymentOrderInput, type PaymentOutcome } from "@/server/payments/types";

/// Mercado Pago, Checkout Pro: se crea una "preferencia" con el Access
/// Token de la marca y se manda al comprador a la URL que devuelve
/// (init_point). Mercado Pago avisa a notification_url (y/o a la URL de
/// Webhooks del panel) con el id del pago; el estado real siempre se
/// confirma consultando GET /v1/payments/{id} con el token de la marca.
/// Referencia: developers de Mercado Pago (Checkout Pro, Webhooks). Hecho
/// a partir de la documentación pública: conviene confirmarlo con una
/// cuenta de prueba real antes de cobrar de verdad (2026-10-18).

const API = "https://api.mercadopago.com";
const TIMEOUT = 10_000;

export type MercadoPagoValues = { accessToken: string; webhookSecret?: string };

type Payment = {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  transaction_amount?: number;
  payment_type_id?: string;
  payment_method_id?: string;
  live_mode?: boolean;
  date_created?: string;
};

function headers(values: MercadoPagoValues, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${values.accessToken}`, "Content-Type": "application/json", ...extra };
}

const ID_TYPES: Record<string, string> = { CC: "CC", CE: "CE", NIT: "NIT" };

/// Crea la preferencia de pago y devuelve su id y el link al que va el
/// comprador. Un solo ítem con el total del pedido: así descuentos y envío
/// no tienen que cuadrar línea por línea con lo que espera Mercado Pago.
export async function createMercadoPagoPreference(values: MercadoPagoValues, input: PaymentOrderInput) {
  const amount = Math.round(input.amountCents) / 100;
  const payer: Record<string, unknown> = { email: input.buyer.email };
  if (input.buyer.firstName) payer.name = input.buyer.firstName;
  if (input.buyer.lastName) payer.surname = input.buyer.lastName;
  const idType = input.buyer.idType ? ID_TYPES[input.buyer.idType] : undefined;
  if (idType && input.buyer.idNumber) payer.identification = { type: idType, number: input.buyer.idNumber.replace(/[^0-9A-Za-z]/g, "") };

  const body = {
    items: [
      {
        id: input.reference,
        title: input.description.slice(0, 256),
        quantity: 1,
        unit_price: amount,
        currency_id: input.currency,
      },
    ],
    payer,
    back_urls: { success: input.returnUrl, pending: input.returnUrl, failure: input.returnUrl },
    auto_return: "approved",
    external_reference: input.reference,
    notification_url: input.webhookUrl,
    statement_descriptor: input.brandName.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 22) || "MARCOLINI",
    metadata: { order_id: input.orderId },
  };
  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: headers(values, { "X-Idempotency-Key": input.reference }),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id || !data?.init_point) {
    throw new PaymentGatewayError(
      `Mercado Pago respondió ${res.status} al crear el cobro${data?.message ? `: ${data.message}` : ""}`,
    );
  }
  return { preferenceId: String(data.id), url: String(data.init_point) };
}

export async function fetchMercadoPagoPayment(values: MercadoPagoValues, paymentId: string): Promise<Payment> {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: headers(values),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new PaymentGatewayError(`Mercado Pago respondió ${res.status} al consultar el pago`);
  const data = await res.json();
  if (!data?.id || typeof data.status !== "string") throw new PaymentGatewayError("Mercado Pago devolvió un pago sin estado");
  return data as Payment;
}

/// Pagos de una referencia nuestra (external_reference) — para pedidos
/// pendientes cuyo aviso no llegó. Devuelve el aprobado si hay uno; si no,
/// el más reciente; null si no hay ninguno.
export async function findMercadoPagoPaymentByReference(values: MercadoPagoValues, reference: string): Promise<Payment | null> {
  const params = new URLSearchParams({ external_reference: reference, sort: "date_created", criteria: "desc" });
  const res = await fetch(`${API}/v1/payments/search?${params.toString()}`, {
    headers: headers(values),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new PaymentGatewayError(`Mercado Pago respondió ${res.status} al buscar el pago`);
  const data = await res.json();
  const list = (Array.isArray(data?.results) ? data.results : []) as Payment[];
  const mine = list.filter((p) => p.external_reference === reference);
  if (mine.length === 0) return null;
  return mine.find((p) => p.status === "approved") ?? mine[0];
}

/// approved → pagado; pending/in_process/authorized → sigue esperando
/// (PSE, efectivo, revisión); el resto no se dio.
export function mapMercadoPagoStatus(status: string): PaymentOutcome {
  if (status === "approved") return "APPROVED";
  if (["pending", "in_process", "authorized"].includes(status)) return "PENDING";
  return "DECLINED";
}

/// Firma de los webhooks: el header x-signature trae "ts=...,v1=..."; v1 es
/// HMAC-SHA256 (con la clave secreta de la aplicación) del manifiesto
/// "id:{data.id};request-id:{x-request-id};ts:{ts};" — con data.id en
/// minúsculas si es alfanumérico.
export function verifyMercadoPagoSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  if (!params.xSignature || !params.dataId) return false;
  const parts = Object.fromEntries(
    params.xSignature.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k.trim(), rest.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const id = /^[0-9]+$/.test(params.dataId) ? params.dataId : params.dataId.toLowerCase();
  const manifest = `id:${id};${params.xRequestId ? `request-id:${params.xRequestId};` : ""}ts:${ts};`;
  const expected = createHmac("sha256", params.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
