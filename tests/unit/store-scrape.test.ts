import { describe, expect, it } from "vitest";
import {
  categoriesToCollections,
  extractInfoPageLinks,
  menuHrefToShopify,
  isCategoryUrl,
  isProductUrl,
  parseProductPage,
  parseSitemap,
  parseWooProduct,
  sitemapsFromRobots,
  toShopifyImport,
  weightToKg,
} from "@/lib/store-scrape";
import { isPrivateIp } from "@/server/integrations/safe-fetch";

const ORIGIN = "https://tienda.example.com";

describe("WooCommerce Store API", () => {
  it("convierte precios en unidad mínima y lee categorías", () => {
    const p = parseWooProduct(
      {
        id: 7,
        name: "Bolso &amp; Cartera",
        slug: "bolso",
        permalink: `${ORIGIN}/producto/bolso/`,
        type: "simple",
        sku: "BO-1",
        description: "<p>Cuero</p>",
        prices: { price: "8990000", regular_price: "9990000", currency_code: "COP", currency_minor_unit: 2 },
        images: [{ src: "https://tienda.example.com/wp-content/uploads/bolso.jpg" }],
        categories: [{ name: "Bolsos" }],
      },
      ORIGIN,
    )!;
    expect(p.name).toBe("Bolso & Cartera");
    expect(p.price).toBe(89900);
    expect(p.compareAtPrice).toBe(99900);
    expect(p.currency).toBe("COP");
    expect(p.collectionNames).toEqual(["Bolsos"]);
    expect(p.sku).toBe("BO-1");
  });

  it("arma variantes con el nombre visible del término y el precio de cada variación", () => {
    const p = parseWooProduct(
      {
        id: 8,
        name: "Camiseta",
        slug: "camiseta",
        type: "variable",
        prices: { price: "50000", currency_minor_unit: 0 },
        attributes: [
          { name: "Color", has_variations: true, terms: [{ name: "Azul marino", slug: "azul-marino" }] },
        ],
        variations: [{ id: 81, attributes: [{ name: "Color", value: "azul-marino" }] }],
      },
      ORIGIN,
      new Map([[81, { prices: { price: "55000", currency_minor_unit: 0 }, sku: "CA-AZ" }]]),
    )!;
    expect(p.hasVariants).toBe(true);
    expect(p.variants[0]).toMatchObject({ option1Value: "Azul marino", price: 55000, sku: "CA-AZ" });
  });
});

describe("página de producto genérica", () => {
  it("lee el JSON-LD: precio, SKU, código de barras, peso y categoría", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://cdn.example.com/og.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList","itemListElement":[{"name":"Inicio"},{"name":"Maquillaje"},{"name":"Labial"}]},
        {"@type":"Product","name":"Labial Rojo","description":"Rojo intenso\\n\\nLarga duración","sku":"LB-01","gtin13":"7701234567890",
         "image":["https://cdn.example.com/1.jpg",{"url":"https://cdn.example.com/2.jpg"}],
         "weight":{"@type":"QuantitativeValue","value":"120","unitCode":"GRM"},
         "offers":{"@type":"Offer","price":"32.900","priceCurrency":"COP","availability":"https://schema.org/InStock"}}
      ]}</script></head></html>`;
    const p = parseProductPage(html, `${ORIGIN}/productos/labial-rojo/`)!;
    expect(p.handle).toBe("labial-rojo");
    expect(p.name).toBe("Labial Rojo");
    expect(p.price).toBe(32900);
    expect(p.sku).toBe("LB-01");
    expect(p.barcode).toBe("7701234567890");
    expect(p.weight).toBe(0.12);
    expect(p.collectionNames).toEqual(["Maquillaje"]);
    expect(p.images).toEqual([
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg",
      "https://cdn.example.com/og.jpg",
    ]);
    expect(p.description).toBe("<p>Rojo intenso</p><p>Larga duración</p>");
  });

  it("lee las variantes de Tiendanube", () => {
    const variants = JSON.stringify([
      { option0: "S", price_number: 45000, sku: "T-S", stock: 3, weight: "0.300" },
      { option0: "M", price_number: 47000, sku: "T-M", stock: 0, weight: "0.300" },
    ]).replace(/"/g, "&quot;");
    const html = `<meta property="og:type" content="product"><meta property="og:title" content="Top Lino">
      <label for="variation_1">Talle</label>
      <form data-variants="${variants}"></form>`;
    const p = parseProductPage(html, `${ORIGIN}/productos/top-lino/`)!;
    expect(p.hasVariants).toBe(true);
    expect(p.optionNames).toEqual(["Talle"]);
    expect(p.variants.map((v) => [v.option1Value, v.price, v.sku, v.stock, v.weight])).toEqual([
      ["S", 45000, "T-S", 3, 0.3],
      ["M", 47000, "T-M", 0, 0.3],
    ]);
  });

  it("ignora páginas que no son de producto", () => {
    expect(parseProductPage("<html><title>Inicio</title></html>", ORIGIN)).toBeNull();
  });
});

describe("sitemaps y URLs", () => {
  it("lee índices de sitemap y URLs", () => {
    expect(parseSitemap("<sitemapindex><sitemap><loc>https://x.com/sitemap_products_1.xml</loc></sitemap></sitemapindex>").sitemaps).toEqual([
      "https://x.com/sitemap_products_1.xml",
    ]);
    expect(parseSitemap("<urlset><url><loc>https://x.com/a?x=1&amp;y=2</loc></url></urlset>").urls).toEqual(["https://x.com/a?x=1&y=2"]);
    expect(sitemapsFromRobots("User-agent: *\nSitemap: https://x.com/sitemap.xml")).toEqual(["https://x.com/sitemap.xml"]);
  });

  it("distingue páginas de producto y de categoría", () => {
    expect(isProductUrl("https://x.com/productos/top-lino/")).toBe(true);
    expect(isProductUrl("https://x.com/products/top")).toBe(true);
    expect(isProductUrl("https://x.com/contacto")).toBe(false);
    expect(isCategoryUrl("https://x.com/product-category/bolsos/")).toBe(true);
    expect(isCategoryUrl("https://x.com/collections/verano")).toBe(true);
  });

  it("convierte pesos a kg", () => {
    expect(weightToKg(2, "lb").weight).toBe(0.907);
    expect(weightToKg(500, "g")).toEqual({ weight: 0.5, weightUnit: "G" });
  });
});

describe("al shape del importador de Shopify", () => {
  const base = parseProductPage(
    `<meta property="og:type" content="product"><meta property="og:title" content="Gorra">`,
    `${ORIGIN}/productos/gorra/`,
  )!;

  it("sin precio entra como borrador; con precio, activo", () => {
    expect(toShopifyImport(base).status).toBe("DRAFT");
    expect(toShopifyImport({ ...base, price: 25000 }).status).toBe("ACTIVE");
  });

  it("arma una colección por categoría con sus productos", () => {
    const a = { ...base, handle: "a", collectionNames: ["Gorras", "Verano"] };
    const b = { ...base, handle: "b", collectionNames: ["gorras"] };
    const collections = categoriesToCollections([a, b]);
    expect(collections.map((c) => [c.handle, c.name, c.productHandles])).toEqual([
      ["gorras", "Gorras", ["a", "b"]],
      ["verano", "Verano", ["a"]],
    ]);
  });
});

describe("páginas y menú de otras plataformas", () => {
  it("encuentra las páginas informativas de la portada", () => {
    const html = `<footer>
      <a href="/politica-de-envios/">Política de envíos</a>
      <a href="https://tienda.example.com/quienes-somos">Quiénes somos</a>
      <a href="/productos/gorra/">Gorra</a>
      <a href="https://instagram.com/x">Instagram</a>
      <a href="/contacto">Contacto</a>
    </footer>`;
    expect(extractInfoPageLinks(html, ORIGIN)).toEqual([
      { url: `${ORIGIN}/politica-de-envios/`, label: "Política de envíos", handle: "politica-de-envios", kind: "policy" },
      { url: `${ORIGIN}/quienes-somos`, label: "Quiénes somos", handle: "quienes-somos", kind: "page" },
    ]);
  });

  it("traduce el menú a la forma de Shopify y no deja enlaces a la tienda vieja", () => {
    const pages = new Set(["quienes-somos"]);
    expect(menuHrefToShopify("/product-category/bolsos/", ORIGIN, pages)).toBe("/collections/bolsos");
    expect(menuHrefToShopify("/productos/gorra/", ORIGIN, pages)).toBe("/products/gorra");
    expect(menuHrefToShopify("/quienes-somos", ORIGIN, pages)).toBe("/pages/quienes-somos");
    expect(menuHrefToShopify("/", ORIGIN, pages)).toBe("/");
    expect(menuHrefToShopify("/blog/novedades", ORIGIN, pages)).toBeNull();
    expect(menuHrefToShopify("https://instagram.com/x", ORIGIN, pages)).toBe("https://instagram.com/x");
  });
});

describe("protección de direcciones internas", () => {
  it("bloquea IPs privadas y de metadatos", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.1", "172.16.5.5", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });
});
