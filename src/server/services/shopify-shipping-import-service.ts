import { prisma } from "@/lib/prisma";
import { isPayOnDeliveryRate, type ProposedShippingZone } from "@/lib/shopify-shipping";
import {
  createShippingZone,
  ShippingZoneError,
  type ShippingRateInput,
} from "@/server/services/shipping-zone-service";

/// Deja Mi tienda → Envíos con las zonas que se leyeron de Shopify
/// probando carritos (ver shopify-shipping.ts). Por defecto reemplaza las
/// zonas actuales: la marca que importa está armando la tienda.

export type ImportShippingResult = {
  zones: { name: string; action: "created" | "error"; regions: number; error?: string }[];
  removed: number;
  /// Tarifas que venían como contraentrega (Marcolini no lo permite) y
  /// quedaron sin precio: la marca tiene que ponérselo en Envíos.
  pendingPrice: number;
};

export async function importShopifyShippingZones(
  brandId: string,
  zones: ProposedShippingZone[],
  options: { replace: boolean },
): Promise<ImportShippingResult> {
  let removed = 0;
  if (options.replace) {
    removed = (await prisma.shippingZone.deleteMany({ where: { brandId } })).count;
  }
  const results: ImportShippingResult["zones"] = [];
  let pendingPrice = 0;
  for (const zone of zones) {
    try {
      const rates: ShippingRateInput[] = zone.rates.map((r) => ({
        name: r.name,
        price: r.price,
        pendingPrice: r.pendingPrice ?? isPayOnDeliveryRate(r.name, r.price),
        condition: r.condition,
        conditionValue: r.condition === "MIN_ORDER_AMOUNT" ? (r.conditionValue ?? null) : null,
      }));
      const created = await createShippingZone(brandId, { name: zone.name, regions: zone.regions, rates });
      pendingPrice += created.rates.filter((r) => r.pendingPrice).length;
      results.push({ name: created.name, action: "created", regions: zone.regions.length });
    } catch (err) {
      results.push({
        name: zone.name,
        action: "error",
        regions: zone.regions.length,
        error: err instanceof ShippingZoneError ? err.message : "No se pudo crear la zona.",
      });
    }
  }
  return { zones: results, removed, pendingPrice };
}
