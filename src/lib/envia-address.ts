import type { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import { municipalityName, resolveDaneLocation } from "@/lib/dane";

/// Direcciones de Colombia como las pide la API de Envia.com (guías desde
/// el pedido, ver envia-service.ts). En Colombia Envia ubica por el código
/// DANE del municipio, no por el nombre ni por el código postal.

/// Código de cada departamento en Envia: sus propios códigos de 2 letras,
/// que no son los ISO (Santander es SN, Cauca CU, Quindío QU, Guaviare
/// GA…). Comprobados contra Envia en producción por el módulo de Magento
/// magento2-envia-live-rates (licencia MIT), docs/colombia-department-codes.md.
export const ENVIA_STATE_CODE: Record<(typeof COLOMBIA_REGIONS)[number], string> = {
  Amazonas: "AM",
  Antioquia: "AN",
  Arauca: "AR",
  Atlántico: "AT",
  "Bogotá D.C.": "DC",
  Bolívar: "BL",
  Boyacá: "BY",
  Caldas: "CL",
  Caquetá: "CA",
  Casanare: "CS",
  Cauca: "CU",
  Cesar: "CE",
  Chocó: "CH",
  Córdoba: "CO",
  Cundinamarca: "CN",
  Guainía: "GU",
  Guaviare: "GA",
  Huila: "HU",
  "La Guajira": "LG",
  Magdalena: "MA",
  Meta: "ME",
  Nariño: "NA",
  "Norte de Santander": "NS",
  Putumayo: "PU",
  Quindío: "QU",
  Risaralda: "RI",
  "San Andrés y Providencia": "SA",
  Santander: "SN",
  Sucre: "SU",
  Tolima: "TO",
  "Valle del Cauca": "VC",
  Vaupés: "VA",
  Vichada: "VI",
};

export function enviaStateCode(region: string | null | undefined): string | null {
  return region ? (ENVIA_STATE_CODE[region as keyof typeof ENVIA_STATE_CODE] ?? null) : null;
}

export type EnviaPlace = {
  /// Departamento en código de Envia ("AN").
  state: string;
  /// Municipio en código DANE de 8 dígitos ("05001000" = Medellín). Va
  /// también como código postal: así guarda Envia las direcciones de
  /// Colombia en su panel ("Calle…, 11001000, DC, 11001000, CO").
  city: string;
  /// Nombre del municipio, para mostrarlo ("Medellín").
  cityName: string;
};

/// Departamento (de COLOMBIA_REGIONS) y ciudad escrita a mano → como los
/// pide Envia. null si la ciudad no se reconoce en ese departamento.
export function enviaPlace(region: string | null | undefined, city: string | null | undefined): EnviaPlace | null {
  const state = enviaStateCode(region);
  const dane = resolveDaneLocation(region, city);
  if (!state || !dane) return null;
  const code = `${dane.department}${dane.city}`;
  return { state, city: `${code}000`, cityName: municipalityName(code) ?? city?.trim() ?? "" };
}

/// Sin tildes ni caracteres especiales, en una línea: con UTF-8 en nombres
/// y direcciones Envia a veces no devuelve tarifas.
export function enviaText(text: string | null | undefined, max = 100): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/// Celular de 10 dígitos, sin +57 ni espacios.
export function enviaPhone(raw: string | null | undefined): string {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  return digits.slice(-10);
}

/// Nombre de cada transportadora (los mismos de CARRIERS en carriers.ts,
/// para que el pedido muestre el de siempre). Envia usa códigos como
/// "servientrega" o "interRapidisimo".
const CARRIER_NAMES: Record<string, string> = {
  servientrega: "Servientrega",
  coordinadora: "Coordinadora",
  interrapidisimo: "Interrapidísimo",
  envia: "Envía",
  tcc: "TCC",
  deprisa: "Deprisa",
  "472": "4-72",
  "99minutos": "99minutos",
  entrega: "Entrega",
};

export function enviaCarrierName(code: string, fallback?: string | null): string {
  const known = CARRIER_NAMES[code.trim().toLowerCase()];
  if (known) return known;
  // El nombre que da Envia, si no es el mismo código repetido.
  const given = fallback?.trim();
  if (given && given !== code.trim()) return given;
  const clean = code.trim();
  // Siglas ("dhl", "ups") en mayúsculas; el resto, con mayúscula inicial.
  return clean.length <= 3 ? clean.toUpperCase() : clean.charAt(0).toUpperCase() + clean.slice(1);
}

function statusKey(status: string) {
  return status
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const STATUS_LABELS: [keys: string[], label: string][] = [
  [["created", "labelcreated", "creado", "creada", "information"], "Guía creada"],
  [["pickup", "pickedup", "collected", "recolectado", "recogido"], "La recogió la transportadora"],
  [["shipped", "intransit", "transit", "entransito"], "En camino"],
  [["outfordelivery", "enreparto", "endistribucion"], "En reparto"],
  [["delivered", "entregado", "entregada"], "Entregado"],
  [["canceled", "cancelled", "cancelado", "cancelada", "anulado", "anulada"], "Anulada"],
  [["returned", "return", "devuelto", "devolucion"], "Devuelto"],
  [["exception", "incident", "delayed", "lost", "damaged", "novedad"], "Con novedad"],
];

/// El estado que reporta Envia ("Delivered", "In Transit"…) en español.
export function enviaStatusLabel(status: string | null | undefined): string | null {
  if (!status?.trim()) return null;
  const key = statusKey(status);
  return STATUS_LABELS.find(([keys]) => keys.includes(key))?.[1] ?? status.trim();
}

export function isDeliveredStatus(status: string | null | undefined): boolean {
  return Boolean(status) && ["delivered", "entregado", "entregada"].includes(statusKey(status!));
}
