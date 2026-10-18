import { describe, expect, it } from "vitest";
import { isValidGoogleAnalyticsId, parseGoogleAnalyticsId } from "@/lib/ad-pixels";

describe("Google Analytics en la tienda", () => {
  it("acepta el ID de medición solo o dentro del código de gtag", () => {
    expect(parseGoogleAnalyticsId("G-ABC123XYZ")).toBe("G-ABC123XYZ");
    expect(parseGoogleAnalyticsId(" g-abc123xyz ")).toBe("G-ABC123XYZ");
    expect(parseGoogleAnalyticsId(`<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script><script>gtag('config', 'G-ABC123XYZ');</script>`)).toBe("G-ABC123XYZ");
    expect(parseGoogleAnalyticsId("")).toBe("");
    expect(parseGoogleAnalyticsId("UA-12345-1")).toBeNull();
    expect(parseGoogleAnalyticsId("G-<script>")).toBeNull();
    expect(isValidGoogleAnalyticsId("G-ABC123XYZ")).toBe(true);
    expect(isValidGoogleAnalyticsId("g-abc")).toBe(false);
    expect(isValidGoogleAnalyticsId(null)).toBe(false);
  });
});
