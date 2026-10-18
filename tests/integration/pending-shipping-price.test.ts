import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createShippingZone, updateShippingZone } from "@/server/services/shipping-zone-service";
import { importShopifyShippingZones } from "@/server/services/shopify-shipping-import-service";
import { getGoLiveChecklist } from "@/server/services/go-live-service";
import { createStoreOrder, quoteShipping } from "@/server/services/store-order-service";
import { BUYER, createProduct, createSellingBrand, hasDb } from "./helpers";

const email = (n: string) => `${n}-${Math.random().toString(36).slice(2, 8)}@prueba.test`;

/// Marcolini no permite envío contraentrega: una tarifa que venía así en
/// $0 queda sin precio y bloquea el checkout en su zona hasta que la marca
/// le ponga precio. Ver conversación del 2026-10-18.
describe.skipIf(!hasDb)("tarifa contraentrega (no permitida)", () => {
  it("bloquea el checkout en su zona con un aviso claro, y al ponerle precio vuelve a vender", async () => {
    const brand = await createSellingBrand();
    await prisma.shippingZone.deleteMany({ where: { brandId: brand.id } });
    const zone = await createShippingZone(brand.id, {
      name: "Todo el país",
      regions: ["Antioquia"],
      rates: [{ name: "EL ENVIO LO PAGAS CONTRAENTREGA", price: 0, condition: "NONE", pendingPrice: true }],
    });
    expect(zone.rates[0].pendingPrice).toBe(true);

    const blocked = await quoteShipping(brand.id, { region: "Antioquia", orderAmountCents: 1500000, weightKg: 0 });
    expect(blocked).toEqual({ ok: false, reason: "RATE_PENDING_PRICE" });

    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 5 });
    await expect(
      createStoreOrder(brand.storefrontSlug!, { ...BUYER, buyerEmail: email("cod"), items: [{ productId: placa.id, quantity: 1 }] }),
    ).rejects.toThrow(/todavía no definió el costo de envío/);

    // "Lo que falta para vender" se lo dice a la marca.
    const checklist = await getGoLiveChecklist(brand.id);
    const envios = checklist!.items.find((i) => i.key === "envios")!;
    expect(envios.done).toBe(false);
    expect(envios.detail).toContain("contraentrega");

    // Con precio, la bandera se apaga sola y la zona vende normal.
    const priced = await updateShippingZone(brand.id, zone.id, {
      name: zone.name,
      regions: zone.regions,
      rates: [{ name: "Envío nacional", price: 12000, condition: "NONE", pendingPrice: true }],
    });
    expect(priced.rates[0].pendingPrice).toBe(false);
    const quote = await quoteShipping(brand.id, { region: "Antioquia", orderAmountCents: 1500000, weightKg: 0 });
    expect(quote).toEqual({ ok: true, shippingCents: 1200000, rateName: "Envío nacional" });
    const { order } = await createStoreOrder(brand.storefrontSlug!, {
      ...BUYER,
      buyerEmail: email("ok"),
      items: [{ productId: placa.id, quantity: 1 }],
    });
    expect(order).toMatchObject({ shippingCents: 1200000, shippingMethod: "Envío nacional" });
    expect((await getGoLiveChecklist(brand.id))!.items.find((i) => i.key === "envios")!.done).toBe(true);
  });

  it("al leer los fletes de Shopify se marca sola por el nombre y la importación lo cuenta", async () => {
    const brand = await createSellingBrand();
    const result = await importShopifyShippingZones(
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
    expect(result.pendingPrice).toBe(1);
    const zones = await prisma.shippingZone.findMany({ where: { brandId: brand.id }, include: { rates: true }, orderBy: { position: "asc" } });
    expect(zones.map((z) => [z.name, z.rates[0].pendingPrice])).toEqual([
      ["Resto de Colombia", true],
      ["Gratis", false],
    ]);
    // Un envío gratis de verdad sí se cotiza.
    expect(await quoteShipping(brand.id, { region: "Cundinamarca", orderAmountCents: 100000, weightKg: 0 })).toEqual({
      ok: true,
      shippingCents: 0,
      rateName: "Envío gratis",
    });
  });
});
