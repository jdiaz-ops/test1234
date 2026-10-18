import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createShippingZone } from "@/server/services/shipping-zone-service";
import { importShopifyShippingZones } from "@/server/services/shopify-shipping-import-service";
import { createStoreOrder, quoteShipping } from "@/server/services/store-order-service";
import { BUYER, createProduct, createSellingBrand, hasDb } from "./helpers";

const email = (n: string) => `${n}-${Math.random().toString(36).slice(2, 8)}@prueba.test`;

describe.skipIf(!hasDb)("envío contraentrega", () => {
  it("una tarifa en $0 que se paga al recibir no sale como gratis: el checkout y el pedido lo saben", async () => {
    const brand = await createSellingBrand();
    await prisma.shippingZone.deleteMany({ where: { brandId: brand.id } });
    const zone = await createShippingZone(brand.id, {
      name: "Todo el país",
      regions: ["Antioquia"],
      rates: [{ name: "EL ENVIO LO PAGAS CONTRAENTREGA", price: 0, condition: "NONE", payOnDelivery: true }],
    });
    expect(zone.rates[0].payOnDelivery).toBe(true);

    const quote = await quoteShipping(brand.id, { region: "Antioquia", orderAmountCents: 1500000, weightKg: 0 });
    expect(quote).toEqual({ ok: true, shippingCents: 0, rateName: "EL ENVIO LO PAGAS CONTRAENTREGA", payOnDelivery: true });

    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    const { order } = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("cod"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    expect(order).toMatchObject({ shippingCents: 0, shippingPayOnDelivery: true, shippingMethod: "EL ENVIO LO PAGAS CONTRAENTREGA" });
  });

  it("solo aplica con precio 0; al leer los fletes de Shopify se marca sola por el nombre", async () => {
    const brand = await createSellingBrand();
    const paid = await createShippingZone(brand.id, {
      name: "Cobrada",
      regions: ["Cundinamarca"],
      rates: [{ name: "Contraentrega", price: 5000, condition: "NONE", payOnDelivery: true }],
    });
    expect(paid.rates[0].payOnDelivery).toBe(false);

    await importShopifyShippingZones(
      brand.id,
      [
        {
          name: "Resto de Colombia",
          regions: ["Antioquia"],
          rates: [{ name: "EL ENVIO LO PAGAS CONTRAENTREGA", price: 0, condition: "NONE" }],
          otherRates: [],
        },
        { name: "Gratis", regions: ["Cundinamarca"], rates: [{ name: "Envío gratis", price: 0, condition: "NONE" }], otherRates: [] },
      ],
      { replace: true },
    );
    const zones = await prisma.shippingZone.findMany({ where: { brandId: brand.id }, include: { rates: true }, orderBy: { position: "asc" } });
    expect(zones.map((z) => [z.name, z.rates[0].payOnDelivery])).toEqual([
      ["Resto de Colombia", true],
      ["Gratis", false],
    ]);
  });
});
