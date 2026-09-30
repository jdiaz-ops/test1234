/// Transportadoras comunes en Colombia para el selector del pedido. El
/// link lleva a la página de rastreo de cada una; el comprador pega ahí su
/// número de guía (va en el correo y en su página del pedido). Se usa la
/// página principal de cada empresa a propósito: sus URLs de rastreo con
/// la guía incluida cambian seguido y un link roto confunde más que uno
/// genérico. Ver conversación del 2026-09-30.
export const CARRIERS: { name: string; url: string }[] = [
  { name: "Servientrega", url: "https://www.servientrega.com" },
  { name: "Coordinadora", url: "https://www.coordinadora.com" },
  { name: "Interrapidísimo", url: "https://www.interrapidisimo.com" },
  { name: "Envía", url: "https://envia.co" },
  { name: "TCC", url: "https://www.tcc.com.co" },
  { name: "Deprisa", url: "https://www.deprisa.com" },
  { name: "4-72", url: "https://www.4-72.com.co" },
];

export function trackingUrlFor(carrier: string | null | undefined): string | null {
  if (!carrier) return null;
  const key = carrier.trim().toLowerCase();
  return CARRIERS.find((c) => c.name.toLowerCase() === key)?.url ?? null;
}
