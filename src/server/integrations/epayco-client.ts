// Integración con ePayco — desembolso a la cuenta bancaria del creador el
// día 15 (o en un cobro anticipado). El cobro a las marcas ya NO pasa por
// aquí: se hace por transferencia directa (QR/Bre-B) con comprobante
// verificado a mano, ver payment-service.ts. Sigue la documentación pública
// de la API REST de ePayco (https://apify.epayco.co) para transferencias a
// cuenta bancaria.
//
// No hay credenciales reales de ePayco configuradas en este entorno, así
// que — exactamente como ya se hace con el correo transaccional en
// src/lib/email.ts cuando falta RESEND_API_KEY — si no hay
// EPAYCO_PUBLIC_KEY/EPAYCO_PRIVATE_KEY, la función cae a un modo simulado
// que queda registrado en consola con la etiqueta "[ePayco simulado]" y
// devuelve una referencia de transacción falsa pero reconocible (prefijo
// SIM-), para poder probar a fondo toda la lógica de cálculo/estados del
// Motor de Pagos sin necesitar una cuenta real.

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
