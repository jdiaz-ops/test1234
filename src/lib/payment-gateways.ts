/// Pasarelas de pago: la que Marcolini tiene (Wompi), las que no se
/// pueden integrar porque solo existen dentro de su plataforma, y las
/// que una marca puede pedir. Lo usan la detección al duplicar una
/// tienda (shopify-theme.ts), el aviso al admin
/// (payment-gateway-request-service.ts) y el selector de Pagos.
/// Ver conversación del 2026-10-18.

export const SUPPORTED_GATEWAYS = ["Wompi"] as const;

/// Solo funcionan dentro de Shopify: no hay integración que construir.
export const NOT_PORTABLE_GATEWAYS = ["Shopify Payments / Shop Pay"] as const;

/// Las que una marca puede elegir en Pagos (además de "Otra").
export const KNOWN_GATEWAYS = [
  "Mercado Pago",
  "PayU",
  "ePayco",
  "Addi",
  "Bold",
  "PlacetoPay",
  "PayPal",
  "Nequi",
  "Sistecrédito",
  "Kushki",
  "Openpay",
  "Stripe",
] as const;

const MAX_NAME = 60;

function key(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/// Nombre limpio y, si es una conocida, con su escritura oficial.
export function normalizeGatewayName(raw: string): string | null {
  const clean = raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  if (clean.length < 2) return null;
  const k = key(clean);
  for (const name of [...SUPPORTED_GATEWAYS, ...NOT_PORTABLE_GATEWAYS, ...KNOWN_GATEWAYS]) {
    if (key(name) === k) return name;
  }
  return clean;
}

/// true cuando Marcolini no la tiene y sí se podría construir.
export function needsIntegration(name: string): boolean {
  const normalized = normalizeGatewayName(name);
  if (!normalized) return false;
  const k = key(normalized);
  return !SUPPORTED_GATEWAYS.some((s) => key(s) === k) && !NOT_PORTABLE_GATEWAYS.some((s) => key(s) === k);
}
