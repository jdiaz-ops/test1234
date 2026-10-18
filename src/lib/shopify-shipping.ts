import { COLOMBIA_REGIONS, REST_OF_COUNTRY } from "@/lib/colombia-regions";
import { REGION_DANE_CODE } from "@/lib/dane";

/// Fletes de una tienda Shopify, leídos probando carritos (2026-10-18):
/// se arma un carrito con un producto y se le pide a Shopify la tarifa
/// para cada departamento (/cart/shipping_rates.json), y después se busca
/// desde qué monto el envío sale gratis subiendo la cantidad. Acá vive lo
/// puro: nombres de departamento como los conoce Shopify, lectura de la
/// respuesta, la búsqueda del umbral y el armado de zonas para Marcolini.
/// Quien habla con la tienda es shopify-store-reader.ts.

export type ShippingRateProbe = { name: string; price: number };
export type RatesByRegion = Record<string, ShippingRateProbe[]>;

/// Shopify llama "provincias" a los departamentos; casi todos se escriben
/// igual que en COLOMBIA_REGIONS, salvo Bogotá y San Andrés.
const SHOPIFY_PROVINCE: Record<string, { name: string; code: string }> = {
  Amazonas: { name: "Amazonas", code: "AMA" },
  Antioquia: { name: "Antioquia", code: "ANT" },
  Arauca: { name: "Arauca", code: "ARA" },
  Atlántico: { name: "Atlántico", code: "ATL" },
  "Bogotá D.C.": { name: "Bogotá, D.C.", code: "DC" },
  Bolívar: { name: "Bolívar", code: "BOL" },
  Boyacá: { name: "Boyacá", code: "BOY" },
  Caldas: { name: "Caldas", code: "CAL" },
  Caquetá: { name: "Caquetá", code: "CAQ" },
  Casanare: { name: "Casanare", code: "CAS" },
  Cauca: { name: "Cauca", code: "CAU" },
  Cesar: { name: "Cesar", code: "CES" },
  Chocó: { name: "Chocó", code: "CHO" },
  Córdoba: { name: "Córdoba", code: "COR" },
  Cundinamarca: { name: "Cundinamarca", code: "CUN" },
  Guainía: { name: "Guainía", code: "GUA" },
  Guaviare: { name: "Guaviare", code: "GUV" },
  Huila: { name: "Huila", code: "HUI" },
  "La Guajira": { name: "La Guajira", code: "LAG" },
  Magdalena: { name: "Magdalena", code: "MAG" },
  Meta: { name: "Meta", code: "MET" },
  Nariño: { name: "Nariño", code: "NAR" },
  "Norte de Santander": { name: "Norte de Santander", code: "NSA" },
  Putumayo: { name: "Putumayo", code: "PUT" },
  Quindío: { name: "Quindío", code: "QUI" },
  Risaralda: { name: "Risaralda", code: "RIS" },
  "San Andrés y Providencia": { name: "San Andrés, Providencia y Santa Catalina", code: "SAP" },
  Santander: { name: "Santander", code: "SAN" },
  Sucre: { name: "Sucre", code: "SUC" },
  Tolima: { name: "Tolima", code: "TOL" },
  "Valle del Cauca": { name: "Valle del Cauca", code: "VAC" },
  Vaupés: { name: "Vaupés", code: "VAU" },
  Vichada: { name: "Vichada", code: "VID" },
};

export function shopifyProvince(region: string) {
  return SHOPIFY_PROVINCE[region] ?? { name: region, code: "" };
}

/// Un código postal verosímil de la capital del departamento, por si la
/// tienda lo exige: el formato colombiano empieza por el código DANE del
/// departamento. Las zonas de Shopify son por departamento, así que el
/// código solo tiene que ser válido, no exacto.
export function probeZip(region: string) {
  if (region === "Bogotá D.C.") return "110111";
  const dane = REGION_DANE_CODE[region];
  return dane ? `${dane}0001` : "";
}

export function isColombiaRegion(value: string): value is (typeof COLOMBIA_REGIONS)[number] {
  return (COLOMBIA_REGIONS as readonly string[]).includes(value);
}

/// La respuesta de /cart/shipping_rates.json → tarifas limpias. null si
/// todavía no hay tarifas (una transportadora calculándolas) o la
/// respuesta no es la esperada.
export function parseShippingRates(raw: unknown): ShippingRateProbe[] | null {
  const list = raw && typeof raw === "object" ? (raw as { shipping_rates?: unknown }).shipping_rates : null;
  if (!Array.isArray(list)) return null;
  const rates: ShippingRateProbe[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const { name, price } = item as { name?: unknown; price?: unknown };
    // "Recoger en tienda" no es un flete: sale en $0 y engañaría la
    // búsqueda del envío gratis.
    if (typeof name === "string" && PICKUP_RATE.test(name)) continue;
    const cleaned = typeof price === "string" ? price.replace(/[^0-9.-]/g, "") : "";
    const value = typeof price === "number" ? price : cleaned ? Number(cleaned) : NaN;
    if (!Number.isFinite(value)) continue;
    rates.push({ name: (typeof name === "string" && name.trim()) || "Envío", price: Math.max(0, Math.round(value)) });
  }
  return rates.sort((a, b) => a.price - b.price);
}

const PICKUP_RATE = /recog|retir|pick ?up|punto de entrega|en tienda|en local|in store/i;

export function isFreeRate(rate: ShippingRateProbe) {
  return rate.price === 0;
}

// ----------------------------------------------------------------------------
// Umbral de envío gratis: búsqueda binaria sobre la cantidad del producto
// de prueba. `probe(q)` deja el carrito con q unidades y dice cuánto suma
// y si el envío sale gratis; la cantidad real puede ser menor si no hay
// stock, y eso se respeta.
// ----------------------------------------------------------------------------

export type ThresholdProbe = (quantity: number) => Promise<{ quantity: number; subtotal: number; free: boolean }>;

export type ThresholdResult = {
  /// El menor subtotal probado con envío gratis (desde ahí seguro es
  /// gratis); null si no apareció hasta el tope.
  threshold: number | null;
  /// El mayor subtotal probado que todavía pagaba envío — el umbral real
  /// está entre este y `threshold`.
  paidBelow: number | null;
  /// Hasta dónde se pudo probar (stock o tope).
  maxSubtotal: number;
};

export async function findFreeShippingThreshold(probe: ThresholdProbe, maxQuantity: number): Promise<ThresholdResult> {
  const top = await probe(Math.max(1, maxQuantity));
  if (!top.free) return { threshold: null, paidBelow: top.subtotal, maxSubtotal: top.subtotal };
  let hi = Math.max(1, top.quantity);
  let hiSubtotal = top.subtotal;
  if (hi === 1) return { threshold: hiSubtotal, paidBelow: null, maxSubtotal: top.subtotal };
  const bottom = await probe(1);
  if (bottom.free) return { threshold: bottom.subtotal, paidBelow: null, maxSubtotal: top.subtotal };
  let lo = 1;
  let loSubtotal = bottom.subtotal;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const r = await probe(mid);
    if (r.quantity < mid) {
      // Sin stock para esa cantidad: lo que quedó en el carrito manda.
      if (r.quantity <= lo) break;
      hi = r.quantity;
      hiSubtotal = r.subtotal;
      if (!r.free) return { threshold: null, paidBelow: r.subtotal, maxSubtotal: r.subtotal };
      continue;
    }
    if (r.free) {
      hi = mid;
      hiSubtotal = r.subtotal;
    } else {
      lo = mid;
      loSubtotal = r.subtotal;
    }
  }
  return { threshold: hiSubtotal, paidBelow: loSubtotal, maxSubtotal: top.subtotal };
}

// ----------------------------------------------------------------------------
// Zonas para Marcolini: departamentos con la misma tarifa más barata van
// juntos. Si todo el país tiene tarifa y el grupo más grande cubre más de
// la mitad, ese grupo queda como "Resto de Colombia" (zona comodín).
// ----------------------------------------------------------------------------

export type ProposedShippingRate = {
  name: string;
  price: number;
  condition: "NONE" | "MIN_ORDER_AMOUNT";
  conditionValue?: number;
  /// Tarifa en $0 cuyo nombre dice que el envío se pagaba al recibir
  /// (contraentrega): Marcolini no lo permite, así que entra como tarifa
  /// sin precio para que la marca le ponga el suyo — ver isPayOnDeliveryRate.
  pendingPrice?: boolean;
};

/// "EL ENVIO LO PAGAS CONTRAENTREGA", "Pago contra entrega", "Flete al
/// recibir"… en $0: el envío no era gratis, se le pagaba a la
/// transportadora. Si tiene precio, es un cobro normal (no se marca).
const PAY_ON_DELIVERY =
  /contra\s*-?\s*entrega|al\s+recibir|pag[aá]s?\s+(el\s+)?(env[ií]o|flete)|cobro\s+en\s+destino|flete\s+(al\s+)?destino|pago\s+en\s+destino/i;

export function isPayOnDeliveryRate(name: string, price: number): boolean {
  return price === 0 && PAY_ON_DELIVERY.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
}

export type ProposedShippingZone = {
  name: string;
  regions: string[];
  rates: ProposedShippingRate[];
  /// Otras tarifas que Shopify ofrecía en esos departamentos (solo
  /// informativo: en Marcolini aplica la más barata).
  otherRates: ShippingRateProbe[];
};

function regionsLabel(regions: string[]) {
  if (regions.length <= 3) return regions.join(regions.length === 2 ? " y " : ", ").replace(/, ([^,]*)$/, " y $1");
  return `${regions.slice(0, 2).join(", ")} y ${regions.length - 2} más`;
}

export function buildShippingZones(
  ratesByRegion: RatesByRegion,
  thresholds: Record<string, ThresholdResult | null> = {},
): { zones: ProposedShippingZone[]; uncovered: string[] } {
  const groups = new Map<string, { cheapest: ShippingRateProbe; others: ShippingRateProbe[]; regions: string[] }>();
  const uncovered: string[] = [];
  for (const region of COLOMBIA_REGIONS) {
    const rates = ratesByRegion[region];
    if (!rates) continue;
    if (rates.length === 0) {
      uncovered.push(region);
      continue;
    }
    const cheapest = rates[0];
    const key = `${cheapest.price}|${cheapest.name.toLowerCase()}`;
    const group = groups.get(key) ?? { cheapest, others: rates.slice(1), regions: [] };
    group.regions.push(region);
    groups.set(key, group);
  }

  const covered = Object.keys(ratesByRegion).filter((r) => isColombiaRegion(r)).length;
  const allCovered = covered === COLOMBIA_REGIONS.length && uncovered.length === 0;
  const ordered = Array.from(groups.values()).sort((a, b) => a.cheapest.price - b.cheapest.price || b.regions.length - a.regions.length);
  const biggest = ordered.reduce<(typeof ordered)[number] | null>((best, g) => (!best || g.regions.length > best.regions.length ? g : best), null);

  const zones: ProposedShippingZone[] = ordered.map((group) => {
    const isRest = allCovered && ordered.length > 1 && group === biggest && group.regions.length > COLOMBIA_REGIONS.length / 2;
    const threshold = group.regions.map((r) => thresholds[r]?.threshold ?? null).find((t): t is number => t != null) ?? null;
    const rates: ProposedShippingRate[] = [];
    if (group.cheapest.price === 0) {
      const pendingPrice = isPayOnDeliveryRate(group.cheapest.name, 0);
      rates.push({
        name: group.cheapest.name === "Envío" ? "Envío gratis" : group.cheapest.name,
        price: 0,
        condition: "NONE",
        ...(pendingPrice ? { pendingPrice: true } : {}),
      });
    } else {
      rates.push({ name: group.cheapest.name, price: group.cheapest.price, condition: "NONE" });
      if (threshold != null && threshold > 0) {
        rates.push({ name: "Envío gratis", price: 0, condition: "MIN_ORDER_AMOUNT", conditionValue: threshold });
      }
    }
    return {
      name: isRest ? "Resto de Colombia" : regionsLabel(group.regions),
      regions: isRest ? [REST_OF_COUNTRY] : group.regions,
      rates,
      otherRates: group.others,
    };
  });
  // La comodín va de última para que las demás tengan prioridad al leerse.
  zones.sort((a, b) => Number(a.regions[0] === REST_OF_COUNTRY) - Number(b.regions[0] === REST_OF_COUNTRY));
  return { zones, uncovered };
}
