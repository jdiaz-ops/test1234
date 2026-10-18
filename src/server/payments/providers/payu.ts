import { createHash } from "node:crypto";
import { PaymentGatewayError, type PaymentModeIdLike, type PaymentOrderInput, type PaymentOutcome } from "@/server/payments/types";

/// PayU Latam, WebCheckout: el checkout manda al comprador con un
/// formulario POST firmado (MD5) a la página de pago de PayU; PayU avisa a
/// confirmationUrl (firma "sign") y devuelve al comprador a responseUrl
/// (firma "signature"). Con el API Login (opcional) se consultan por
/// referencia los pedidos que quedaron pendientes. Referencia: developers
/// de PayU (WebCheckout, página de confirmación, API de consultas). Hecho
/// a partir de la documentación pública: conviene confirmarlo con el
/// sandbox antes de cobrar de verdad (2026-10-18).

const FORM_URL = {
  TEST: "https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/",
  PRODUCTION: "https://checkout.payulatam.com/ppp-web-gateway-payu/",
} as const;

const QUERIES_URL = {
  TEST: "https://sandbox.api.payulatam.com/reports-api/4.0/service.cgi",
  PRODUCTION: "https://api.payulatam.com/reports-api/4.0/service.cgi",
} as const;

export type PayuValues = { merchantId: string; accountId: string; apiKey: string; apiLogin?: string };

function md5(raw: string) {
  return createHash("md5").update(raw).digest("hex");
}

/// Monto como lo recibe PayU en el formulario: entero cuando es entero,
/// si no con dos decimales. Tiene que ser el mismo texto que va en la firma.
export function payuAmount(amountCents: number): string {
  const cents = Math.round(amountCents);
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/// El valor como va en las firmas de confirmación y respuesta: con UN
/// decimal, redondeado hacia arriba desde .x5 (150.00 → 150.0, 150.25 →
/// 150.3, 150.34 → 150.3). Se hace con enteros para no depender de cómo
/// representa JavaScript los decimales.
export function payuSignedValue(value: string | number): string {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return text;
  const [, sign, whole, fraction = ""] = match;
  // En milésimas, enteras, para redondear a décimas hacia arriba desde 5.
  const thousandths = Number(whole) * 1000 + Number((fraction + "000").slice(0, 3));
  const tenths = Math.floor((thousandths + 50) / 100);
  return `${sign}${Math.floor(tenths / 10)}.${tenths % 10}`;
}

/// Firma del formulario: MD5(ApiKey~merchantId~referenceCode~amount~currency).
export function payuRequestSignature(params: {
  apiKey: string;
  merchantId: string;
  referenceCode: string;
  amount: string;
  currency: string;
}) {
  return md5(`${params.apiKey}~${params.merchantId}~${params.referenceCode}~${params.amount}~${params.currency}`);
}

/// Firma de la página de confirmación (aviso servidor a servidor):
/// MD5(ApiKey~merchant_id~reference_sale~new_value~currency~state_pol).
export function payuConfirmationSignature(params: {
  apiKey: string;
  merchantId: string;
  referenceSale: string;
  value: string;
  currency: string;
  statePol: string;
}) {
  return md5(
    `${params.apiKey}~${params.merchantId}~${params.referenceSale}~${payuSignedValue(params.value)}~${params.currency}~${params.statePol}`,
  );
}

/// Firma de la página de respuesta (el comprador vuelve a la tienda):
/// MD5(ApiKey~merchantId~referenceCode~TX_VALUE~currency~transactionState),
/// con TX_VALUE redondeado a un decimal.
export function payuResponseSignature(params: {
  apiKey: string;
  merchantId: string;
  referenceCode: string;
  txValue: string;
  currency: string;
  transactionState: string;
}) {
  return md5(
    `${params.apiKey}~${params.merchantId}~${params.referenceCode}~${payuSignedValue(params.txValue)}~${params.currency}~${params.transactionState}`,
  );
}

/// 4 = aprobada, 7 = pendiente; 6 declinada, 5 expirada, 104 error…
export function mapPayuState(state: string | number | null | undefined): PaymentOutcome {
  const s = String(state ?? "").trim();
  if (s === "4") return "APPROVED";
  if (s === "7") return "PENDING";
  return "DECLINED";
}

const PAYU_ID_TYPES: Record<string, string> = { CC: "CC", CE: "CE", NIT: "NIT", PASAPORTE: "PP" };

/// El formulario que el checkout envía por POST a PayU.
export function buildPayuForm(values: PayuValues, mode: PaymentModeIdLike, input: PaymentOrderInput) {
  const amount = payuAmount(input.amountCents);
  const fields: Record<string, string> = {
    merchantId: values.merchantId,
    accountId: values.accountId,
    description: input.description.slice(0, 255),
    referenceCode: input.reference,
    amount,
    tax: "0",
    taxReturnBase: "0",
    currency: input.currency,
    signature: payuRequestSignature({
      apiKey: values.apiKey,
      merchantId: values.merchantId,
      referenceCode: input.reference,
      amount,
      currency: input.currency,
    }),
    test: mode === "TEST" ? "1" : "0",
    lng: "es",
    buyerEmail: input.buyer.email,
    buyerFullName: input.buyer.fullName,
    responseUrl: input.returnUrl,
    confirmationUrl: input.webhookUrl,
    extra1: input.orderId,
  };
  const phone = input.buyer.phone.replace(/\D/g, "");
  if (phone) fields.telephone = phone;
  const idType = input.buyer.idType ? PAYU_ID_TYPES[input.buyer.idType] : undefined;
  if (idType && input.buyer.idNumber) {
    fields.payerDocument = input.buyer.idNumber.replace(/[^0-9A-Za-z]/g, "");
    fields.payerDocumentType = idType;
  }
  if (input.buyer.address) {
    fields.shippingAddress = input.buyer.address.slice(0, 255);
    fields.shippingCountry = "CO";
    if (input.buyer.city) fields.shippingCity = input.buyer.city.slice(0, 255);
  }
  return { url: FORM_URL[mode], fields };
}

type PayuTransaction = { id?: string; state?: string; paymentMethod?: string; createdDate?: number };

/// Busca en PayU (API de consultas) la orden de una referencia nuestra —
/// necesita el API Login. Devuelve la transacción aprobada si hay una; si
/// no, la más reciente; null si no hay ninguna.
export async function findPayuTransactionByReference(
  values: PayuValues,
  mode: PaymentModeIdLike,
  referenceCode: string,
): Promise<{ transactionId: string | null; state: string } | null> {
  if (!values.apiLogin) throw new PaymentGatewayError("PayU: sin API Login no se puede consultar la transacción");
  const res = await fetch(QUERIES_URL[mode], {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      test: false,
      language: "es",
      command: "ORDER_DETAIL_BY_REFERENCE_CODE",
      merchant: { apiLogin: values.apiLogin, apiKey: values.apiKey },
      details: { referenceCode },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new PaymentGatewayError(`PayU respondió ${res.status} al consultar la transacción`);
  const data = await res.json();
  if (data?.code !== "SUCCESS") throw new PaymentGatewayError(`PayU no pudo consultar la referencia: ${data?.error ?? data?.code ?? "sin detalle"}`);
  const orders = (Array.isArray(data?.result?.payload) ? data.result.payload : []) as { transactions?: PayuTransaction[] }[];
  const transactions = orders.flatMap((o) => o.transactions ?? []).filter((t) => t.state);
  if (transactions.length === 0) return null;
  const chosen =
    transactions.find((t) => t.state === "APPROVED") ??
    [...transactions].sort((a, b) => (b.createdDate ?? 0) - (a.createdDate ?? 0))[0];
  return { transactionId: chosen.id ?? null, state: chosen.state! };
}

/// Estados de la API de consultas → resultado.
export function mapPayuApiState(state: string): PaymentOutcome {
  if (state === "APPROVED") return "APPROVED";
  if (state === "PENDING" || state === "SUBMITTED") return "PENDING";
  return "DECLINED";
}
