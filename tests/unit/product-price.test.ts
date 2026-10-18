import { describe, expect, it } from "vitest";
import { basePriceFor, priceRange } from "@/lib/product-price";

describe("precio de un producto con variantes", () => {
  it("el base es el menor precio propio de las variantes", () => {
    expect(basePriceFor([{ price: 18900 }, { price: 15900 }, { price: null }], 0)).toBe(15900);
    expect(basePriceFor([{ price: null }, { price: null }], 20000)).toBe(20000);
    expect(basePriceFor([], 0)).toBe(0);
    expect(basePriceFor([{ price: 0 }], undefined)).toBe(0);
  });

  it("la tarjeta dice Desde solo si hay variantes más caras", () => {
    expect(priceRange(15900, [{ price: "15900" }, { price: "18900" }])).toEqual({ min: 15900, from: true });
    expect(priceRange(15900, [{ price: "15900" }, { price: "15900" }])).toEqual({ min: 15900, from: false });
    expect(priceRange(15900, [{ price: null }, { price: "19900" }])).toEqual({ min: 15900, from: true });
    expect(priceRange(15900, [])).toEqual({ min: 15900, from: false });
    expect(priceRange(15900)).toEqual({ min: 15900, from: false });
  });
});
