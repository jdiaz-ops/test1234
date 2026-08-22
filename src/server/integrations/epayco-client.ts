// Integración con ePayco (Pagos Divididos) — cobro a la tarjeta de la marca
// el día 1, y desembolso a la cuenta bancaria del creador el día 15 (o en un
// cobro anticipado). Sigue la documentación pública de la API REST de
// ePayco (https://apify.epayco.co: tokenización de tarjeta, creación de
// cliente y cobro; transferencias a cuenta bancaria para el desembolso).
//
// No hay credenciales reales de ePayco configuradas en este entorno, así
// que — exactamente como ya se hace con el correo transaccional en
// src/lib/email.ts cuando falta RESEND_API_KEY — si no hay
// EPAYCO_PUBLIC_KEY/EPAYCO_PRIVATE_KEY, cada función cae a un modo
// simulado que queda registrado en consola con la etiqueta "[ePayco
// simulado]" y devuelve una referencia de transacción falsa pero
// reconocible (prefijo SIM-), para poder probar a fondo toda la lógica de
// cálculo/estados del Motor de Pagos sin necesitar una cuenta real.

const API_BASE = "https://apify.epayco.co";
const PUBLIC_KEY = process.env.EPAYCO_PUBLIC_KEY;
const PRIVATE_KEY = process.env.EPAYCO_PRIVATE_KEY;

const SIMULATED = !PUBLIC_KEY || !PRIVATE_KEY;

export class EpaycoApiError extends Error {}

async function getAccessToken(): Promise<string> {
  const basicAuth = Buffer.from(`${PUBLIC_KEY}:${PRIVATE_KEY}`).toString("base64");
  const res = await fetch(`${API_BASE}/login`, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });
  if (!res.ok) throw new EpaycoApiError(`No se pudo autenticar con ePayco (${res.status})`);
  const body = await res.json();
  return body.token;
}

function simulate<T>(label: string, detail: string, value: T): T {
  console.log(`[ePayco simulado] ${label}: ${detail}`);
  return value;
}

/// Tokeniza los datos de la tarjeta (nunca se guardan en nuestra base) y
/// crea un cliente ePayco recurrente — el `customerId` resultante es lo que
/// se guarda como BrandProfile.cardTokenRef para cobrar sin pedir la
/// tarjeta de nuevo cada mes.
export async function tokenizeAndSaveCard(params: {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  holderName: string;
  holderEmail: string;
}): Promise<{ customerId: string }> {
  if (SIMULATED) {
    return simulate(
      "Tarjeta guardada",
      `terminada en ${params.cardNumber.slice(-4)} para ${params.holderName}`,
      { customerId: `SIM-CUST-${Date.now()}` }
    );
  }

  const token = await getAccessToken();
  const tokenRes = await fetch(`${API_BASE}/payment/token/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      "card[number]": params.cardNumber,
      "card[exp-year]": params.expYear,
      "card[exp-month]": params.expMonth,
      "card[cvc]": params.cvc,
    }),
  });
  if (!tokenRes.ok) throw new EpaycoApiError(`No se pudo tokenizar la tarjeta (${tokenRes.status})`);
  const tokenBody = await tokenRes.json();

  const customerRes = await fetch(`${API_BASE}/payment/customer/create`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      token_card: tokenBody.id,
      name: params.holderName,
      email: params.holderEmail,
    }),
  });
  if (!customerRes.ok) throw new EpaycoApiError(`No se pudo registrar el cliente en ePayco (${customerRes.status})`);
  const customerBody = await customerRes.json();

  return { customerId: customerBody.data.customerId };
}

/// Cobro del día 1 — usa el cliente/tarjeta ya guardado, sin volver a pedir
/// datos de la tarjeta.
export async function chargeBrandCard(params: {
  customerId: string;
  amount: number;
  description: string;
}): Promise<{ transactionRef: string }> {
  if (SIMULATED) {
    return simulate("Cobro a marca", `${params.description} por $${params.amount}`, {
      transactionRef: `SIM-CHARGE-${Date.now()}`,
    });
  }

  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/payment/process`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_id: params.customerId,
      value: params.amount,
      currency: "cop",
      description: params.description,
    }),
  });
  if (!res.ok) throw new EpaycoApiError(`No se pudo cobrar a la marca (${res.status})`);
  const body = await res.json();
  return { transactionRef: body.data.ref_payco };
}

/// Desembolso a la cuenta bancaria del creador (día 15, o cobro
/// anticipado) — transferencia bancaria vía ePayco, no tarjeta.
export async function payoutToCreatorBank(params: {
  bankName: string;
  bankAccountType: string;
  bankAccountNumber: string;
  holderName: string;
  amount: number;
  description: string;
}): Promise<{ transactionRef: string }> {
  if (SIMULATED) {
    return simulate(
      "Pago a creador",
      `${params.description} por $${params.amount} a ${params.bankName} ****${params.bankAccountNumber.slice(-4)}`,
      { transactionRef: `SIM-PAYOUT-${Date.now()}` }
    );
  }

  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}/payment/split/payout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      bank_name: params.bankName,
      account_type: params.bankAccountType,
      account_number: params.bankAccountNumber,
      beneficiary_name: params.holderName,
      value: params.amount,
      description: params.description,
    }),
  });
  if (!res.ok) throw new EpaycoApiError(`No se pudo procesar el pago al creador (${res.status})`);
  const body = await res.json();
  return { transactionRef: body.data.ref_payco };
}

export function isSimulated() {
  return SIMULATED;
}
