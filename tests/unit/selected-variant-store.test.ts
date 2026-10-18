import { describe, expect, it } from "vitest";
import {
  getSelectedVariantImage,
  setSelectedVariantImage,
  subscribeSelectedVariantImage,
} from "@/components/storefront/selected-variant-store";

describe("foto de la variante elegida", () => {
  it("guarda por producto y avisa solo cuando cambia", () => {
    let calls = 0;
    const unsubscribe = subscribeSelectedVariantImage(() => calls++);
    setSelectedVariantImage("p1", "/a.webp");
    setSelectedVariantImage("p1", "/a.webp");
    setSelectedVariantImage("p2", "/b.webp");
    expect(getSelectedVariantImage("p1")).toBe("/a.webp");
    expect(getSelectedVariantImage("p2")).toBe("/b.webp");
    expect(getSelectedVariantImage("p3")).toBeNull();
    expect(calls).toBe(2);
    setSelectedVariantImage("p1", null);
    expect(getSelectedVariantImage("p1")).toBeNull();
    expect(calls).toBe(3);
    unsubscribe();
    setSelectedVariantImage("p1", "/c.webp");
    expect(calls).toBe(3);
  });
});
