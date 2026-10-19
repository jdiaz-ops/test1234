import { describe, expect, it } from "vitest";
import { bannerImageUrl, BannerSpecError, isGeneratedBannerUrl, mix, normalizeBannerSpec, readableOn, verifyBanner } from "@/lib/banner-image";

const KEY = "clave-de-prueba";
const spec = {
  layout: "wide" as const,
  title: "Semipermanente",
  subtitle: "Color que dura semanas",
  cta: "Ver esmaltes",
  image: "https://fotos.test/p1.jpg",
  bg: "#fff",
  fg: "#111111",
  accent: "#D1477B",
  font: "Poppins",
};

describe("banners con el estilo de la tienda", () => {
  it("la URL firmada se verifica y devuelve la misma receta; con otra llave o cambiada, no", () => {
    const url = bannerImageUrl(spec, KEY);
    expect(isGeneratedBannerUrl(url)).toBe(true);
    const params = new URL(url, "https://tienda.test").searchParams;
    const verified = verifyBanner(params.get("s")!, params.get("sig")!, KEY);
    expect(verified).toEqual({
      layout: "wide",
      title: "Semipermanente",
      subtitle: "Color que dura semanas",
      cta: "Ver esmaltes",
      image: "https://fotos.test/p1.jpg",
      bg: "#ffffff",
      fg: "#111111",
      accent: "#d1477b",
      font: "Poppins",
    });
    expect(verifyBanner(params.get("s")!, params.get("sig")!, "otra")).toBeNull();
    const tampered = Buffer.from(JSON.stringify({ ...verified, title: "Otro" })).toString("base64url");
    expect(verifyBanner(tampered, params.get("sig")!, KEY)).toBeNull();
    expect(verifyBanner("", "", KEY)).toBeNull();
    expect(isGeneratedBannerUrl("https://fotos.test/p1.jpg")).toBe(false);
  });

  it("normaliza: solo fotos https, colores hex de seis dígitos y textos con tope", () => {
    expect(() => normalizeBannerSpec({ ...spec, image: "http://fotos.test/p1.jpg" })).toThrow(BannerSpecError);
    expect(() => normalizeBannerSpec({ ...spec, image: "no es url" })).toThrow(BannerSpecError);
    const n = normalizeBannerSpec({ title: " a ".repeat(50), bg: "rojo", font: "", image: null });
    expect(n.layout).toBe("wide");
    expect(normalizeBannerSpec({ layout: "mobile" }).layout).toBe("mobile");
    expect(n.title.length).toBe(60);
    expect(n.bg).toBe("#ffffff");
    expect(n.font).toBe("Instrument Sans");
    expect(n.image).toBeNull();
  });

  it("texto legible sobre el acento y mezcla de colores", () => {
    expect(readableOn("#ffffff")).toBe("#111111");
    expect(readableOn("#111111")).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
