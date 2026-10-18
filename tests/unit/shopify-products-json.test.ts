import { describe, expect, it } from "vitest";
import {
  convertShopifyProducts,
  parseShopifyProductsPage,
  ShopifyStoreError,
} from "@/lib/shopify-products-json";

/// Una página de /products.json tal como la publica Shopify (campos que
/// usamos), con los mismos casos que la prueba del CSV.
const PAGE = {
  products: [
    {
      id: 1,
      title: " Placa de Stamping Back to Basics ",
      handle: "back-to-basics-placa-stamping",
      body_html: "<p>Placa</p>",
      product_type: "Placas Stamping",
      published_at: "2026-01-01T00:00:00-05:00",
      variants: [
        {
          title: "Default Title",
          option1: "Default Title",
          option2: null,
          option3: null,
          sku: "PL-001",
          price: "15000.00",
          compare_at_price: "30000.00",
          grams: 50,
          available: true,
        },
      ],
      images: [
        { src: "https://cdn.shopify.com/b.jpg?v=2", position: 2 },
        { src: "https://cdn.shopify.com/a.jpg?v=1", position: 1 },
        { src: "https://cdn.shopify.com/a.jpg?v=1", position: 3 },
      ],
      options: [{ name: "Title", values: ["Default Title"] }],
    },
    {
      id: 2,
      title: "Esmalte Stamping",
      handle: "esmalte-stamping",
      body_html: null,
      product_type: "Esmaltes",
      published_at: "2026-01-01T00:00:00-05:00",
      variants: [
        { option1: "Plateado", option2: null, option3: null, sku: "ES-PL", price: "5000.00", grams: 20, available: true },
        { option1: "Dorado", option2: null, option3: null, sku: "ES-DO", price: "5000.00", grams: 20, available: false },
        { option1: "plateado", option2: null, option3: null, sku: "REPETIDA", price: "1.00", grams: 20, available: true },
      ],
      images: [{ src: "https://cdn.shopify.com/c.jpg", position: 1 }],
      options: [{ name: "Color", values: ["Plateado", "Dorado"] }],
    },
    {
      id: 3,
      title: "Top Coat",
      handle: "top-coat",
      body_html: "",
      product_type: "",
      published_at: "2026-01-01T00:00:00-05:00",
      variants: [{ option1: "Default Title", option2: null, option3: null, sku: "", price: "0.00", grams: 1500 }],
      images: [],
      options: [{ name: "Title", values: ["Default Title"] }],
    },
    { id: 4, title: "", handle: "sin-titulo", variants: [], images: [], options: [] },
  ],
};

describe("importar productos desde el link de la tienda Shopify", () => {
  const result = convertShopifyProducts(parseShopifyProductsPage(PAGE));
  const byHandle = Object.fromEntries(result.products.map((p) => [p.handle, p]));

  it("convierte cada producto publicado y omite los que no tienen título", () => {
    expect(result.products).toHaveLength(3);
    expect(result.stats).toEqual({ products: 3, withVariants: 1, images: 3, unknownStock: 3, draft: 1 });
    expect(result.warnings.some((w) => w.includes("sin-titulo"))).toBe(true);
  });

  it("lee precio, precio antes, fotos en orden y sin repetir, SKU, peso y el Tipo como colección", () => {
    const placa = byHandle["back-to-basics-placa-stamping"];
    expect(placa.name).toBe("Placa de Stamping Back to Basics");
    expect(placa.description).toBe("<p>Placa</p>");
    expect(placa.price).toBe(15000);
    expect(placa.compareAtPrice).toBe(30000);
    expect(placa.images).toEqual(["https://cdn.shopify.com/a.jpg?v=1", "https://cdn.shopify.com/b.jpg?v=2"]);
    expect(placa.sku).toBe("PL-001");
    expect(placa.barcode).toBe("");
    expect(placa.weight).toBe(0.05);
    expect(placa.weightUnit).toBe("G");
    // Sin control de stock: el link no trae cantidades.
    expect(placa.stock).toBeNull();
    expect(placa.hasVariants).toBe(false);
    expect(placa.collectionName).toBe("Placas Stamping");
    expect(placa.status).toBe("ACTIVE");
  });

  it("arma las variantes sin repetir y las deja en 0 hasta que la marca ponga stock", () => {
    const esmalte = byHandle["esmalte-stamping"];
    expect(esmalte.hasVariants).toBe(true);
    expect(esmalte.optionNames).toEqual(["Color"]);
    expect(esmalte.variants.map((v) => v.option1Value)).toEqual(["Plateado", "Dorado"]);
    expect(esmalte.variants.map((v) => v.stock)).toEqual([0, 0]);
    expect(esmalte.variants[0]).toMatchObject({ price: 5000, sku: "ES-PL", weight: 0.02, weightUnit: "G" });
    expect(esmalte.price).toBe(0);
    expect(esmalte.collectionName).toBe("Esmaltes");
  });

  it("un producto sin precio entra como borrador, y sin Tipo queda sin colección", () => {
    const topCoat = byHandle["top-coat"];
    expect(topCoat.status).toBe("DRAFT");
    expect(topCoat.price).toBe(0);
    expect(topCoat.collectionName).toBeNull();
    expect(topCoat.weight).toBe(1.5);
    expect(topCoat.weightUnit).toBe("KG");
    expect(result.warnings.some((w) => w.includes("Top Coat"))).toBe(true);
  });

  it("una página vacía no es un error (es la que sigue a la última)", () => {
    expect(convertShopifyProducts([])).toEqual({
      products: [],
      warnings: [],
      stats: { products: 0, withVariants: 0, images: 0, unknownStock: 0, draft: 0 },
    });
  });

  it("rechaza lo que no es una página de products.json", () => {
    for (const raw of [null, "hola", [], {}, { products: "x" }, { products: null }]) {
      expect(() => parseShopifyProductsPage(raw)).toThrow(ShopifyStoreError);
    }
    expect(parseShopifyProductsPage({ products: [null, 1, { title: "ok" }] })).toEqual([{ title: "ok" }]);
  });
});

describe("colecciones de /collections.json", () => {
  it("convierte las colecciones publicadas y salta la portada, 'all' y las vacías", async () => {
    const { convertShopifyCollections, parseShopifyCollectionsPage, collectionProductHandles, htmlToText } = await import(
      "@/lib/shopify-products-json"
    );
    const raw = parseShopifyCollectionsPage({
      collections: [
        { id: 1, handle: "Soft-Gel", title: " Soft Gel ", body_html: "<p>Tips &amp; m&aacute;s</p><p>Todo.</p>", published_at: "2026-01-01", sort_order: "best-selling", products_count: 8, image: { src: "//cdn.shopify.com/c.jpg" } },
        { id: 2, handle: "frontpage", title: "Página principal", published_at: "2026-01-01", products_count: 3 },
        { id: 3, handle: "all", title: "Todos", published_at: "2026-01-01", products_count: 30 },
        { id: 4, handle: "vacia", title: "Vacía", published_at: "2026-01-01", products_count: 0 },
        { id: 5, handle: "no-publicada", title: "Oculta", published_at: null, products_count: 2 },
        { id: 6, handle: "precio", title: "Por precio", published_at: "2026-01-01", sort_order: "price-asc", products_count: null, image: null },
        { id: 7, handle: "soft-gel", title: "Repetida", published_at: "2026-01-01", products_count: 1 },
        null,
      ],
    });
    const collections = convertShopifyCollections(raw);
    expect(collections.map((c) => c.handle)).toEqual(["soft-gel", "precio"]);
    expect(collections[0]).toEqual({
      handle: "soft-gel",
      name: "Soft Gel",
      description: "Tips & más\nTodo.",
      imageUrl: "https://cdn.shopify.com/c.jpg",
      productsCount: 8,
      sortOrder: "MANUAL",
      productHandles: [],
    });
    expect(collections[1]).toMatchObject({ sortOrder: "PRICE_ASC", productsCount: null, imageUrl: null });
    expect(htmlToText("Uno<br>Dos &quot;tres&quot; &#x41;")).toBe('Uno\nDos "tres" A');
    expect(() => parseShopifyCollectionsPage({ products: [] })).toThrow(ShopifyStoreError);
    expect(collectionProductHandles({ products: [{ handle: "a" }, { handle: "b" }, { handle: "a" }, { title: "sin handle" }] })).toEqual(["a", "b"]);
  });

  it("guarda las etiquetas de cada producto para proponer categorías", () => {
    const [product] = convertShopifyProducts([
      { title: "Placa", handle: "placa", tags: ["Stamping", " stamping ", "Placas"], variants: [{ option1: "Default Title", price: "1000.00" }], options: [{ name: "Title", values: ["Default Title"] }] },
    ]).products;
    expect(product.tags).toEqual(["Stamping", "Placas"]);
    const [fromString] = convertShopifyProducts([{ title: "Esmalte", handle: "esmalte", tags: "rojo, gel", variants: [{ option1: "Default Title", price: "1000.00" }] }]).products;
    expect(fromString.tags).toEqual(["rojo", "gel"]);
  });
});

describe("fotos de variante", () => {
  it("trae la foto propia de cada variante por link", () => {
    const [product] = convertShopifyProducts([
      {
        title: "Esmalte",
        handle: "esmalte",
        variants: [
          { option1: "Rojo", price: "5000.00", featured_image: { src: "//cdn.shopify.com/s/files/rojo.jpg" } },
          { option1: "Azul", price: "5000.00", featured_image: null },
        ],
        options: [{ name: "Color", values: ["Rojo", "Azul"] }],
      },
    ]).products;
    expect(product.variants.map((v) => v.imageUrl)).toEqual(["https://cdn.shopify.com/s/files/rojo.jpg", null]);
  });
});
