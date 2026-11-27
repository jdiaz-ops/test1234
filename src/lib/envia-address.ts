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

/// Código postal de Colombia (4-72) válido para ese municipio: 6 dígitos,
/// y los 2 primeros son los del departamento en el código DANE (Bogotá 11,
/// Antioquia 05…). `daneCity`: el código DANE de 8 dígitos. null si no.
export function colombiaPostalCode(raw: string | null | undefined, daneCity: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length === 6 && digits.slice(0, 2) === daneCity.slice(0, 2) ? digits : null;
}

const VIA = String.raw`(?:av(?:enida)?\.?\s*(?:calle|carrera|cra|kra|kr|cll|cl)|calle|cll|cl|carrera|cra|kra|kr|cr|transversal|trans|tv|diagonal|diag|dg|circular|cir|autopista)\.?`;
/// "16", "16F", "16 F", "63 Bis A", "45 Sur"…: una letra suelta, no el
/// comienzo de una palabra ("Parque").
const STREET_NUMBER = String.raw`\d{1,3}(?:\s*[a-z](?![a-z]))?(?:\s*bis(?![a-z]))?(?:\s*[a-z](?![a-z]))?`;
const SIDE = String.raw`(?:\s+(?:sur|este)(?![a-z]))?`;
const PLAIN_ADDRESS = new RegExp(
  String.raw`^(${VIA})\s*(${STREET_NUMBER}${SIDE})\s+(${STREET_NUMBER})\s+(\d{1,3})(?![\d-])`,
  "i",
);

/// La dirección con la nomenclatura de Colombia ("Calle 16 F # 99-59")
/// cuando se escribió sin "#" ni "-" ("Calle 16 F 99 59, Torre 4…"), para
/// que la transportadora y el mapa la ubiquen. Lo demás queda igual; si no
/// es claramente así, no se toca.
export function standardStreet(address: string): string {
  const clean = address.replace(/\s+/g, " ").trim();
  if (/#|\bno\.?\s*\d|n[°º]|\d\s*-\s*\d/i.test(clean)) return clean;
  const match = PLAIN_ADDRESS.exec(clean);
  if (!match) return clean;
  const [whole, via, street, cross, plate] = match;
  const tidy = (part: string) => part.replace(/\s+/g, " ").trim();
  return `${tidy(via)} ${tidy(street)} # ${tidy(cross)}-${plate}${clean.slice(whole.length)}`;
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

/// NIT o cédula como los pide Envia: sin puntos ni espacios, y el NIT sin
/// el dígito de verificación ("900.123.456-7" → "900123456"). Un
/// documento con letras (pasaporte) queda con sus letras y números.
export function enviaIdNumber(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (/[a-z]/i.test(value)) return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const withoutCheckDigit = value.replace(/\s*-\s*\d\s*$/, "");
  return withoutCheckDigit.replace(/\D/g, "");
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
  // Con los números: "1 delivery attempt" no es "2 delivery attempts".
  return status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/// En qué va la guía, para saber qué hacer con el pedido:
/// - "label": guía creada, la transportadora todavía no tiene el paquete.
/// - "transit": la transportadora ya lo recogió (lo escaneó) y va en camino.
/// - "delivered": entregado a la compradora.
/// - "problem": hay que revisarlo (devuelto, perdido, dirección errada…).
/// - "canceled": la guía se anuló.
/// - "info": Envia no dice en qué va.
export type EnviaStatusStage = "label" | "transit" | "delivered" | "problem" | "canceled" | "info";

/// Los estados de Envia (su catálogo, docs.envia.com → Track Shipments) en
/// español. `attention`: la marca debería mirarlo aunque vaya en camino.
const STATUSES: [keys: string[], label: string, stage: EnviaStatusStage, attention?: boolean][] = [
  [["created", "labelcreated", "creado", "creada"], "Guía creada", "label"],
  [["pending", "pendiente"], "Pendiente", "label"],
  [["outforpickup"], "Por recoger", "label"],
  [["1pickupattempt"], "Intento de recogida fallido", "label", true],
  [["information"], "Información nueva", "info"],
  [["na"], "Sin información", "info"],
  [["shipped", "intransit", "transit", "entransito"], "En camino", "transit"],
  [["pickedup", "collected", "recogido", "recolectado"], "La recogió la transportadora", "transit"],
  [["outfordelivery", "enreparto", "endistribucion"], "En reparto", "transit"],
  [["partiallyshipped"], "Enviado en parte", "transit", true],
  [["pickupatoffice"], "Para recoger en oficina", "transit", true],
  [["redirected"], "Redirigido", "transit", true],
  [["1deliveryattempt"], "1 intento de entrega", "transit", true],
  [["2deliveryattempts"], "2 intentos de entrega", "transit", true],
  [["3deliveryattempts"], "3 intentos de entrega", "transit", true],
  [["deliveryattempt"], "Intento de entrega", "transit", true],
  [["partiallydelivered"], "Entregado en parte", "transit", true],
  [["delivered", "entregado", "entregada"], "Entregado", "delivered"],
  [["canceled", "cancelled", "cancelado", "cancelada", "anulado", "anulada"], "Anulada", "canceled"],
  [["returned", "return", "devuelto", "devolucion"], "Devuelto", "problem"],
  [["deliveredatorigin"], "Devuelto a quien envía", "problem"],
  [["lost", "perdido"], "Perdido", "problem"],
  [["damaged"], "Dañado", "problem"],
  [["returnproblem"], "Problema en la devolución", "problem"],
  [["addresserror"], "Error en la dirección", "problem"],
  [["undeliverable"], "No se pudo entregar", "problem"],
  [["delayed"], "Retrasado", "problem"],
  [["rejected"], "Rechazado", "problem"],
  [["exception", "incident", "novedad"], "Con novedad", "problem"],
];

const statusOf = (status: string | null | undefined) =>
  status?.trim() ? STATUSES.find(([keys]) => keys.includes(statusKey(status))) : undefined;

/// El estado que reporta Envia ("Delivered", "Out for Delivery"…) en español.
export function enviaStatusLabel(status: string | null | undefined): string | null {
  if (!status?.trim()) return null;
  return statusOf(status)?.[1] ?? status.trim();
}

/// null: un estado que no conocemos (no se toca el pedido).
export function enviaStatusStage(status: string | null | undefined): EnviaStatusStage | null {
  return statusOf(status)?.[2] ?? null;
}

/// Para el color del estado en el pedido.
export function enviaStatusTone(status: string | null | undefined): "delivered" | "attention" | "canceled" | "normal" {
  const found = statusOf(status);
  if (!found) return "normal";
  const [, , stage, attention] = found;
  if (stage === "delivered") return "delivered";
  if (stage === "canceled") return "canceled";
  return stage === "problem" || attention ? "attention" : "normal";
}

export function isDeliveredStatus(status: string | null | undefined): boolean {
  return enviaStatusStage(status) === "delivered";
}
