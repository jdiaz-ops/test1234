import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentGatewayError, type PaymentOrderInput, type PaymentOutcome } from "@/server/payments/types";

/// Bold, API de links de pago: con la llave de identidad de la marca se
/// crea un link cerrado por el total del pedido y se manda al comprador a
/// su URL. Bold avisa al webhook del panel (firma x-bold-signature con la
/// llave secreta) identificando el link por su id (LNK_…), y el estado real
/// se confirma consultando el link. Referencia: developers.bold.co (API
/// Link de pagos, Webhook). Hecho a partir de la documentación pública:
/// conviene confirmarlo con las llaves de pruebas antes de cobrar de
/// verdad (2026-10-18).

const API = "https://integrations.api.bold.co";
const TIMEOUT = 10_000;

export type BoldValues = { apiKey: string; secretKey?: string };

export type BoldLink = {
  status: string;
  transactionId: string | null;
  paymentMethod: string | null;
};

function headers(values: BoldValues) {
  return { Authorization: `x-api-key ${values.apiKey}`, "Content-Type": "application/json", Accept: "application/json" };
}

/// Crea el link de pago (vence en 24 horas) y devuelve su id y su URL.
export async function createBoldLink(values: BoldValues, input: PaymentOrderInput) {
  const cents = Math.round(input.amountCents);
  const body = {
    amount_type: "CLOSE",
    amount: { currency: input.currency, tip_amount: 0, total_amount: cents % 100 === 0 ? cents / 100 : Number((cents / 100).toFixed(2)) },
    description: input.description.slice(0, 100),
    callback_url: input.returnUrl,
    payer_email: input.buyer.email,
    // Bold recibe la fecha de vencimiento en nanosegundos.
    expiration_date: (Date.now() + 24 * 3600 * 1000) * 1_000_000,
  };
  const res = await fetch(`${API}/online/link/v1`, {
    method: "POST",
    headers: headers(values),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json().catch(() => null);
  const payload = data?.payload;
  if (!res.ok || !payload?.payment_link || !payload?.url) {
    const detail = Array.isArray(data?.errors) && data.errors[0]?.message ? `: ${data.errors[0].message}` : "";
    throw new PaymentGatewayError(`Bold respondió ${res.status} al crear el link de pago${detail}`);
  }
  return { linkId: String(payload.payment_link), url: String(payload.url) };
}

export async function fetchBoldLink(values: BoldValues, linkId: string): Promise<BoldLink> {
  const res = await fetch(`${API}/online/link/v1/${encodeURIComponent(linkId)}`, {
    headers: headers(values),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const data = await res.json().catch(() => null);
  const payload = data?.payload;
  if (!res.ok || !payload || typeof payload.status !== "string") {
    throw new PaymentGatewayError(`Bold respondió ${res.status} al consultar el link de pago`);
  }
  return {
    status: payload.status,
    transactionId: payload.transaction_id ? String(payload.transaction_id) : null,
    paymentMethod: payload.payment_method ? String(payload.payment_method) : null,
  };
}

/// PAID → pagado; ACTIVE/PROCESSING (o algo que no conocemos) sigue
/// esperando; REJECTED/CANCELLED/EXPIRED no se dio.
export function mapBoldLinkStatus(status: string): PaymentOutcome {
  const s = status.toUpperCase();
  if (s === "PAID") return "APPROVED";
  if (["REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "FAILED"].includes(s)) return "DECLINED";
  return "PENDING";
}

/// Tipo del evento del webhook → resultado; null para los que no son
/// ventas (anulaciones, que la marca registra a mano).
export function mapBoldEvent(type: string): PaymentOutcome | null {
  if (type === "SALE_APPROVED") return "APPROVED";
  if (type === "SALE_REJECTED") return "DECLINED";
  return null;
}

/// x-bold-signature = hex(HMAC-SHA256(llave secreta, base64(cuerpo crudo))).
export function verifyBoldSignature(params: { rawBody: string; signature: string | null; secretKey: string }) {
  if (!params.signature) return false;
  const encoded = Buffer.from(params.rawBody, "utf8").toString("base64");
  const expected = createHmac("sha256", params.secretKey).update(encoded).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(params.signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/// Estado que viene en el query al volver (bold-tx-status).
export function mapBoldReturnStatus(status: string | null | undefined): PaymentOutcome | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "approved") return "APPROVED";
  if (["rejected", "failed"].includes(s)) return "DECLINED";
  if (s === "pending" || s === "processing") return "PENDING";
  return null;
}
