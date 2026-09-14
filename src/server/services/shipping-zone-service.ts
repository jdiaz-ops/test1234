import { prisma } from "@/lib/prisma";
import { COLOMBIA_REGIONS, REST_OF_COUNTRY } from "@/lib/colombia-regions";

export class ShippingZoneError extends Error {}

export type ShippingRateCondition = "NONE" | "MIN_ORDER_AMOUNT" | "MIN_WEIGHT";

export type ShippingRateInput = {
  name: string;
  price: number;
  condition: ShippingRateCondition;
  conditionValue?: number | null;
  /// Tope opcional para armar un rango (ej. "pesa entre 2 y 5 kg", "pedido
  /// entre $20.000 y $50.000") — ver pickShippingRate.
  conditionMaxValue?: number | null;
  /// Solo presentación cuando condition = MIN_WEIGHT — ambos valores
  /// siempre se guardan en kg. Ver conversación del 2026-09-14.
  conditionValueUnit?: "KG" | "G";
};

type ShippingZoneInput = {
  name: string;
  regions: string[];
  rates: ShippingRateInput[];
};

function assertValidRegions(regions: string[]) {
  if (regions.length === 0) {
    throw new ShippingZoneError("Elige al menos una región para la zona.");
  }
  const valid = new Set([...COLOMBIA_REGIONS, REST_OF_COUNTRY]);
  for (const r of regions) {
    if (!valid.has(r as (typeof COLOMBIA_REGIONS)[number] | typeof REST_OF_COUNTRY)) {
      throw new ShippingZoneError(`"${r}" no es una región válida.`);
    }
  }
}

/// Al menos una tarifa, y cualquiera que no sea "siempre aplica" necesita
/// al menos un umbral que la activa (mínimo, máximo, o ambos para armar un
/// rango — ej. "pesa entre 2 y 5 kg"). No se exige que exista una tarifa
/// NONE — una zona puede ser, por ejemplo, "gratis siempre" con una sola
/// regla NONE en $0.
function assertValidRates(rates: ShippingRateInput[]) {
  if (rates.length === 0) {
    throw new ShippingZoneError("Agrega al menos una tarifa para la zona.");
  }
  for (const r of rates) {
    if (!r.name.trim()) {
      throw new ShippingZoneError("Cada tarifa necesita un nombre.");
    }
    if (r.price < 0) {
      throw new ShippingZoneError("El precio de la tarifa no puede ser negativo.");
    }
    if (r.condition !== "NONE") {
      const hasMin = r.conditionValue != null && r.conditionValue > 0;
      const hasMax = r.conditionMaxValue != null && r.conditionMaxValue > 0;
      if (!hasMin && !hasMax) {
        throw new ShippingZoneError(
          `"${r.name}" necesita un umbral mayor a cero (peso o monto).`,
        );
      }
      if (
        hasMin &&
        hasMax &&
        r.conditionMaxValue! <= r.conditionValue!
      ) {
        throw new ShippingZoneError(
          `"${r.name}": el tope del rango debe ser mayor que el mínimo.`,
        );
      }
    }
  }
}

const zoneInclude = { rates: { orderBy: { position: "asc" as const } } };

export async function listShippingZones(brandId: string) {
  return prisma.shippingZone.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
    include: zoneInclude,
  });
}

export async function createShippingZone(brandId: string, data: ShippingZoneInput) {
  assertValidRegions(data.regions);
  assertValidRates(data.rates);
  const count = await prisma.shippingZone.count({ where: { brandId } });
  return prisma.shippingZone.create({
    data: {
      brandId,
      name: data.name.trim(),
      regions: data.regions,
      position: count,
      rates: {
        create: data.rates.map((r, position) => ({
          name: r.name.trim(),
          price: r.price,
          condition: r.condition,
          conditionValue: r.condition === "NONE" ? null : r.conditionValue,
          conditionMaxValue: r.condition === "NONE" ? null : r.conditionMaxValue,
          conditionValueUnit: r.conditionValueUnit ?? "KG",
          position,
        })),
      },
    },
    include: zoneInclude,
  });
}

export async function updateShippingZone(
  brandId: string,
  zoneId: string,
  data: ShippingZoneInput,
) {
  assertValidRegions(data.regions);
  assertValidRates(data.rates);
  const existing = await prisma.shippingZone.findFirst({
    where: { id: zoneId, brandId },
  });
  if (!existing) throw new ShippingZoneError("Zona no encontrada.");

  return prisma.$transaction(async (tx) => {
    await tx.shippingZone.update({
      where: { id: zoneId },
      data: { name: data.name.trim(), regions: data.regions },
    });
    await tx.shippingZoneRate.deleteMany({ where: { zoneId } });
    await tx.shippingZoneRate.createMany({
      data: data.rates.map((r, position) => ({
        zoneId,
        name: r.name.trim(),
        price: r.price,
        condition: r.condition,
        conditionValue: r.condition === "NONE" ? null : r.conditionValue,
        conditionMaxValue: r.condition === "NONE" ? null : r.conditionMaxValue,
        conditionValueUnit: r.conditionValueUnit ?? "KG",
        position,
      })),
    });
    return tx.shippingZone.findUniqueOrThrow({
      where: { id: zoneId },
      include: zoneInclude,
    });
  });
}

export async function deleteShippingZone(brandId: string, zoneId: string) {
  const existing = await prisma.shippingZone.findFirst({
    where: { id: zoneId, brandId },
  });
  if (!existing) throw new ShippingZoneError("Zona no encontrada.");
  await prisma.shippingZone.delete({ where: { id: zoneId } });
}

/// Encuentra la zona que cubre una región, con la zona catch-all ("*")
/// como último recurso — usada al armar el pedido (ver createStoreOrder)
/// para calcular el costo de envío real según a dónde va el comprador.
export function matchShippingZone<T extends { regions: string[] }>(
  zones: T[],
  region: string,
): T | null {
  const exact = zones.find((z) => z.regions.includes(region));
  if (exact) return exact;
  return zones.find((z) => z.regions.includes(REST_OF_COUNTRY)) ?? null;
}

/// De las tarifas de una zona, elige la que aplica al pedido — evalúa
/// todas las que cumplen su condición (o no tienen ninguna) y se queda
/// con la más barata, así una regla de "gratis si..." siempre le gana a
/// la tarifa estándar en cuanto el pedido la cumple, sin que la marca
/// tenga que ordenarlas a mano. Null si la zona no tiene ninguna tarifa
/// (no debería pasar — assertValidRates exige al menos una al guardar).
export function pickShippingRate<
  T extends {
    // number|string cuando viene del cliente (JSON) o Prisma.Decimal
    // cuando viene directo de la base — Number() maneja los tres.
    price: number | string | { toString(): string };
    condition: string;
    conditionValue: number | string | { toString(): string } | null;
    conditionMaxValue?: number | string | { toString(): string } | null;
  },
>(rates: T[], cart: { orderAmountCents: number; weightKg: number }): T | null {
  const eligible = rates.filter((r) => {
    if (r.condition === "NONE") return true;
    const value =
      r.condition === "MIN_ORDER_AMOUNT"
        ? cart.orderAmountCents / 100
        : cart.weightKg;
    // Rango: si trae mínimo, tiene que superarlo; si trae máximo, tiene
    // que quedarse dentro. Con solo uno de los dos, ese es el único
    // requisito (ver assertValidRates, que exige al menos uno).
    if (r.conditionValue != null && value < Number(r.conditionValue)) {
      return false;
    }
    if (
      r.conditionMaxValue != null &&
      value > Number(r.conditionMaxValue)
    ) {
      return false;
    }
    return true;
  });
  if (eligible.length === 0) return null;
  return eligible.reduce((cheapest, r) =>
    Number(r.price) < Number(cheapest.price) ? r : cheapest,
  );
}
