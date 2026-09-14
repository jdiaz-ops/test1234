import { prisma } from "@/lib/prisma";
import { COLOMBIA_REGIONS, REST_OF_COUNTRY } from "@/lib/colombia-regions";

export class ShippingZoneError extends Error {}

type ShippingZoneInput = {
  name: string;
  regions: string[];
  price: number;
  freeShippingThreshold?: number | null;
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

export async function listShippingZones(brandId: string) {
  return prisma.shippingZone.findMany({
    where: { brandId },
    orderBy: { position: "asc" },
  });
}

export async function createShippingZone(brandId: string, data: ShippingZoneInput) {
  assertValidRegions(data.regions);
  const count = await prisma.shippingZone.count({ where: { brandId } });
  return prisma.shippingZone.create({
    data: {
      brandId,
      name: data.name.trim(),
      regions: data.regions,
      price: data.price,
      freeShippingThreshold: data.freeShippingThreshold,
      position: count,
    },
  });
}

export async function updateShippingZone(
  brandId: string,
  zoneId: string,
  data: ShippingZoneInput,
) {
  assertValidRegions(data.regions);
  const existing = await prisma.shippingZone.findFirst({
    where: { id: zoneId, brandId },
  });
  if (!existing) throw new ShippingZoneError("Zona no encontrada.");
  return prisma.shippingZone.update({
    where: { id: zoneId },
    data: {
      name: data.name.trim(),
      regions: data.regions,
      price: data.price,
      freeShippingThreshold: data.freeShippingThreshold,
    },
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
