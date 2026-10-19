import { describe, expect, it } from "vitest";
import { apexOf, companionDomain, customDomainRedirectUrl, refRemainingSeconds, REF_MAX_AGE } from "@/lib/custom-domain";
import { publicStoreUrl, storeCanonical } from "@/lib/store-url";

describe("dominio propio", () => {
  it("el dominio principal y su otra forma (www)", () => {
    expect(apexOf("tienda.marca.com")).toBe("marca.com");
    expect(apexOf("Marca.COM")).toBe("marca.com");
    expect(apexOf("marca.com.co")).toBe("marca.com.co");
    expect(apexOf("tienda.marca.com.co")).toBe("marca.com.co");
    expect(companionDomain("marca.com")).toBe("www.marca.com");
    expect(companionDomain("www.marca.com.co")).toBe("marca.com.co");
    expect(companionDomain("tienda.marca.com")).toBeNull();
  });

  it("el subdominio lleva a la misma página en el dominio propio, con la atribución", () => {
    const base = { customDomain: "beautysolution.com", slug: "beautysolution" };
    expect(customDomainRedirectUrl({ ...base, pathname: "/esmalte-rojo", search: "?color=rojo" })).toBe(
      "https://beautysolution.com/esmalte-rojo?color=rojo",
    );
    // Un link viejo absoluto con el prefijo /t/{slug}.
    expect(customDomainRedirectUrl({ ...base, pathname: "/t/beautysolution/coleccion/unas", search: "" })).toBe(
      "https://beautysolution.com/coleccion/unas",
    );
    expect(customDomainRedirectUrl({ ...base, pathname: "/t/beautysolution", search: "" })).toBe("https://beautysolution.com/");
    // La cookie de la creadora viaja con el tiempo que le quedaba…
    expect(customDomainRedirectUrl({ ...base, pathname: "/", search: "", ref: "LAURA10", refAt: "1760000000" })).toBe(
      "https://beautysolution.com/?ref=LAURA10&ref_at=1760000000",
    );
    // …pero un link nuevo de otra creadora manda.
    expect(customDomainRedirectUrl({ ...base, pathname: "/", search: "?ref=SOFI15", ref: "LAURA10", refAt: "1760000000" })).toBe(
      "https://beautysolution.com/?ref=SOFI15",
    );
  });

  it("la atribución dura lo que le quedaba", () => {
    const now = 2_000_000_000;
    expect(refRemainingSeconds(null, now)).toBe(REF_MAX_AGE);
    expect(refRemainingSeconds(now - 3600, now)).toBe(REF_MAX_AGE - 3600);
    expect(refRemainingSeconds(now - REF_MAX_AGE - 1, now)).toBe(0);
    // Una fecha del futuro o basura: los 30 días de un link nuevo.
    expect(refRemainingSeconds(now + 99, now)).toBe(REF_MAX_AGE);
    expect(refRemainingSeconds(Number.NaN, now)).toBe(REF_MAX_AGE);
  });

  it("los links usan el dominio solo cuando ya está activo", () => {
    const pending = { customDomain: "beautysolution.com", customDomainActiveAt: null, storefrontSlug: "beautysolution" };
    expect(publicStoreUrl(pending)).toBe("https://beautysolution.marcolini.lat");
    const active = { ...pending, customDomainActiveAt: new Date() };
    expect(publicStoreUrl(active)).toBe("https://beautysolution.com");
    expect(storeCanonical(active, "/esmalte-rojo")).toEqual({ canonical: "https://beautysolution.com/esmalte-rojo" });
    expect(storeCanonical({ customDomain: null, customDomainActiveAt: null, storefrontSlug: null }, "/")).toBeUndefined();
  });
});
