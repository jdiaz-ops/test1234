import { describe, expect, it } from "vitest";
import { buildBrandStoreLink } from "@/lib/brand-store-link";
import { ROOT_DOMAIN } from "@/lib/subdomain";

const shopify = {
  storeType: "SHOPIFY",
  storeUrl: "https://marca-vieja.myshopify.com",
  websiteUrl: "https://marca.com",
  customDomain: null,
  customDomainVerifiedAt: null,
};

describe("link a la tienda de la marca desde la vitrina", () => {
  it("si la marca tiene tienda en Marcolini, va ahí con el código del creador", () => {
    expect(buildBrandStoreLink({ ...shopify, storefrontSlug: "hlacosedora" }, "HEY12")).toBe(
      `https://hlacosedora.${ROOT_DOMAIN}/?ref=HEY12`,
    );
  });

  it("sin tienda en Marcolini sigue usando la tienda conectada", () => {
    expect(buildBrandStoreLink({ ...shopify, storefrontSlug: null }, "HEY12")).toBe(
      "https://marca-vieja.myshopify.com/discount/HEY12",
    );
  });
});
