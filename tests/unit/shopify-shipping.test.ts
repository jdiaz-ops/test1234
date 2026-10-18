import { describe, expect, it } from "vitest";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import {
  buildShippingZones,
  findFreeShippingThreshold,
  parseShippingRates,
  probeZip,
  shopifyProvince,
  type RatesByRegion,
} from "@/lib/shopify-shipping";

describe("fletes de Shopify: piezas puras", () => {
  it("conoce los departamentos como los llama Shopify y un código postal verosímil", () => {
    expect(shopifyProvince("Bogotá D.C.")).toEqual({ name: "Bogotá, D.C.", code: "DC" });
    expect(shopifyProvince("Antioquia")).toEqual({ name: "Antioquia", code: "ANT" });
    expect(shopifyProvince("San Andrés y Providencia").code).toBe("SAP");
    expect(probeZip("Bogotá D.C.")).toBe("110111");
    expect(probeZip("Antioquia")).toBe("050001");
    expect(probeZip("Valle del Cauca")).toBe("760001");
    for (const region of COLOMBIA_REGIONS) expect(shopifyProvince(region).code, region).not.toBe("");
  });

  it("lee las tarifas, las ordena por precio y descarta recoger en tienda", () => {
    expect(
      parseShippingRates({
        shipping_rates: [
          { name: "Express", price: "25000.00" },
          { name: "Nacional", price: 15000 },
          { name: "Recoger en tienda", price: "0.00" },
          { name: "", price: "x" },
          null,
        ],
      }),
    ).toEqual([
      { name: "Nacional", price: 15000 },
      { name: "Express", price: 25000 },
    ]);
    expect(parseShippingRates({ shipping_rates: null })).toBeNull();
    expect(parseShippingRates({})).toBeNull();
    expect(parseShippingRates("nada")).toBeNull();
  });

  it("encuentra desde qué subtotal el envío sale gratis subiendo la cantidad", async () => {
    const unit = 45000;
    const calls: number[] = [];
    const probe = async (q: number) => {
      calls.push(q);
      return { quantity: q, subtotal: q * unit, free: q * unit >= 150000 };
    };
    expect(await findFreeShippingThreshold(probe, 14)).toEqual({ threshold: 180000, paidBelow: 135000, maxSubtotal: 630000 });
    expect(calls).toEqual([14, 1, 7, 4, 2, 3]);
  });

  it("respeta el stock, y distingue 'nunca gratis' de 'gratis desde el primer carrito'", async () => {
    const unit = 45000;
    const capped = async (q: number) => {
      const quantity = Math.min(q, 3);
      return { quantity, subtotal: quantity * unit, free: quantity * unit >= 150000 };
    };
    expect(await findFreeShippingThreshold(capped, 14)).toEqual({ threshold: null, paidBelow: 135000, maxSubtotal: 135000 });

    const never = async (q: number) => ({ quantity: q, subtotal: q * unit, free: false });
    expect(await findFreeShippingThreshold(never, 14)).toMatchObject({ threshold: null, paidBelow: 630000 });

    const always = async (q: number) => ({ quantity: q, subtotal: q * unit, free: true });
    expect(await findFreeShippingThreshold(always, 14)).toEqual({ threshold: 45000, paidBelow: null, maxSubtotal: 630000 });
  });

  it("agrupa los departamentos con la misma tarifa en zonas, con comodín para el grupo grande", () => {
    const rates: RatesByRegion = {};
    for (const region of COLOMBIA_REGIONS) {
      rates[region] =
        region === "Bogotá D.C." || region === "Cundinamarca"
          ? [{ name: "Envío Bogotá", price: 8000 }]
          : [
              { name: "Nacional", price: 15000 },
              { name: "Express", price: 25000 },
            ];
    }
    const { zones, uncovered } = buildShippingZones(rates, {
      "Bogotá D.C.": { threshold: 180000, paidBelow: 135000, maxSubtotal: 630000 },
      Antioquia: { threshold: 200000, paidBelow: 150000, maxSubtotal: 630000 },
    });
    expect(uncovered).toEqual([]);
    expect(zones).toHaveLength(2);
    expect(zones[0]).toEqual({
      name: "Bogotá D.C. y Cundinamarca",
      regions: ["Bogotá D.C.", "Cundinamarca"],
      rates: [
        { name: "Envío Bogotá", price: 8000, condition: "NONE" },
        { name: "Envío gratis", price: 0, condition: "MIN_ORDER_AMOUNT", conditionValue: 180000 },
      ],
      otherRates: [],
    });
    expect(zones[1]).toMatchObject({
      name: "Resto de Colombia",
      regions: ["*"],
      rates: [
        { name: "Nacional", price: 15000, condition: "NONE" },
        { name: "Envío gratis", price: 0, condition: "MIN_ORDER_AMOUNT", conditionValue: 200000 },
      ],
      otherRates: [{ name: "Express", price: 25000 }],
    });
  });

  it("sin cobertura completa no usa comodín, y una tarifa en $0 es envío gratis", () => {
    const rates: RatesByRegion = {
      "Bogotá D.C.": [{ name: "Envío", price: 0 }],
      Antioquia: [{ name: "Nacional", price: 15000 }],
      Amazonas: [],
    };
    const { zones, uncovered } = buildShippingZones(rates);
    expect(uncovered).toEqual(["Amazonas"]);
    expect(zones.map((z) => z.regions)).toEqual([["Bogotá D.C."], ["Antioquia"]]);
    expect(zones[0].rates).toEqual([{ name: "Envío gratis", price: 0, condition: "NONE" }]);
    expect(zones[1].rates).toEqual([{ name: "Nacional", price: 15000, condition: "NONE" }]);
  });
});
