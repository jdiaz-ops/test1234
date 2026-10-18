import { createHash, timingSafeEqual } from "node:crypto";
import { PaymentGatewayError, type PaymentModeIdLike, type PaymentOrderInput, type PaymentOutcome } from "@/server/payments/types";

/// ePayco, Checkout estándar: la ventana la abre el script de ePayco en el
/// checkout con la PUBLIC_KEY de la marca (ver payment-launch.ts). ePayco
/// avisa a la URL de confirmación con la firma x_signature (SHA-256 con
/// P_CUST_ID_CLIENTE y P_KEY) y devuelve al comprador con ?ref_payco=…,
/// que se valida contra su API pública de referencias. Referencia:
/// docs.epayco.com (checkout, páginas de respuesta y confirmación). Hecho
/// a partir de la documentación pública: conviene confirmarlo con una
/// cuenta en modo de prueba antes de cobrar de verdad (2026-10-18).

const VALIDATION_URL = "https://secure.epayco.co/validation/v1/reference/";

export type EpaycoValues = { publicKey: string; custId: string; pKey: string };

export type EpaycoTransaction = {
  x_ref_payco: string;
  x_transaction_id: string | null;
  x_id_invoice: string | null;
  x_amount: string | null;
  x_currency_code: string | null;
  x_cod_response: string;
  x_response: string | null;
};

/// x_signature = SHA256(p_cust_id_cliente^p_key^x_ref_payco^x_transaction_id^x_amount^x_currency_code).
export function epaycoSignature(params: {
  custId: string;
  pKey: string;
  refPayco: string;
  transactionId: string;
  amount: string;
  currency: string;
}) {
  return createHash("sha256")
    .update(`${params.custId}^${params.pKey}^${params.refPayco}^${params.transactionId}^${params.amount}^${params.currency}`)
    .digest("hex");
}

export function verifyEpaycoSignature(params: Parameters<typeof epaycoSignature>[0] & { signature: string }) {
  const a = Buffer.from(epaycoSignature(params));
  const b = Buffer.from(params.signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/// 1 aceptada; 3 pendiente, 7 retenida, 8 iniciada siguen esperando; el
/// resto (2 rechazada, 4 fallida, 6 reversada, 9 expirada, 10 abandonada,
/// 11 cancelada…) no se dio.
export function mapEpaycoCode(code: string | number | null | undefined): PaymentOutcome {
  const c = String(code ?? "").trim();
  if (c === "1") return "APPROVED";
  if (["3", "7", "8"].includes(c)) return "PENDING";
  return "DECLINED";
}

function str(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s : null;
}

/// Los campos que nos importan de un aviso o de la validación, tal como
/// los manda ePayco (los montos como texto, sin tocarlos: la firma se
/// calcula sobre el texto recibido).
export function readEpaycoTransaction(raw: Record<string, unknown>): EpaycoTransaction | null {
  const ref = str(raw.x_ref_payco);
  const code = str(raw.x_cod_response) ?? str(raw.x_cod_transaction_state);
  if (!ref || !code) return null;
  return {
    x_ref_payco: ref,
    x_transaction_id: str(raw.x_transaction_id),
    x_id_invoice: str(raw.x_id_invoice),
    x_amount: str(raw.x_amount),
    x_currency_code: str(raw.x_currency_code),
    x_cod_response: code,
    x_response: str(raw.x_response),
  };
}

/// Consulta pública de una transacción por su ref_payco.
export async function fetchEpaycoReference(refPayco: string): Promise<EpaycoTransaction> {
  const res = await fetch(`${VALIDATION_URL}${encodeURIComponent(refPayco)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new PaymentGatewayError(`ePayco respondió ${res.status} al validar la referencia`);
  const body = await res.json();
  const tx = body?.data && typeof body.data === "object" ? readEpaycoTransaction(body.data) : null;
  if (!body?.success || !tx) throw new PaymentGatewayError("ePayco no reconoció la referencia");
  return tx;
}

const EPAYCO_ID_TYPES: Record<string, string> = { CC: "CC", CE: "CE", NIT: "NIT", PASAPORTE: "PPN", PPT: "PPT" };

/// Lo que recibe handler.open() del script de ePayco.
export function buildEpaycoCheckout(values: EpaycoValues, mode: PaymentModeIdLike, input: PaymentOrderInput) {
  const cents = Math.round(input.amountCents);
  const data: Record<string, string> = {
    name: input.description.slice(0, 100),
    description: input.description.slice(0, 255),
    invoice: input.reference,
    currency: input.currency.toLowerCase(),
    amount: cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2),
    tax_base: "0",
    tax: "0",
    tax_ico: "0",
    country: "co",
    lang: "es",
    external: "false",
    response: input.returnUrl,
    confirmation: input.webhookUrl,
    extra1: input.orderId,
    email_billing: input.buyer.email,
    name_billing: input.buyer.fullName,
  };
  const phone = input.buyer.phone.replace(/\D/g, "");
  if (phone) data.mobilephone_billing = phone;
  const idType = input.buyer.idType ? EPAYCO_ID_TYPES[input.buyer.idType] : undefined;
  if (idType && input.buyer.idNumber) {
    data.type_doc_billing = idType;
    data.number_doc_billing = input.buyer.idNumber.replace(/[^0-9A-Za-z]/g, "");
  }
  if (input.buyer.address) data.address_billing = input.buyer.address.slice(0, 255);
  return { publicKey: values.publicKey, test: mode === "TEST", data };
}
