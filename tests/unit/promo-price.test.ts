import { describe, expect, it } from "vitest";
import { joinPromo, splitPromo } from "@/lib/promo-price";

describe("precio y precio de promoción", () => {
  it("lee lo guardado como lo ve la marca", () => {
    expect(splitPromo(8000, 10000)).toEqual({ regular: 10000, promo: 8000 });
    expect(splitPromo(10000, null)).toEqual({ regular: 10000, promo: null });
    // Un tachado que no es mayor no es promoción.
    expect(splitPromo(10000, 9000)).toEqual({ regular: 10000, promo: null });
    expect(splitPromo(null, null)).toEqual({ regular: null, promo: null });
  });

  it("guarda la promoción como el precio que paga y el normal tachado", () => {
    expect(joinPromo(10000, 8000)).toEqual({ price: 8000, compareAtPrice: 10000 });
    expect(joinPromo(10000, null)).toEqual({ price: 10000, compareAtPrice: null });
  });
});
