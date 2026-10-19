import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  ecometriImageUrl,
  ecometriProductsUrl,
  isEcometriHtml,
  isEcometriHost,
  nextFlightPayload,
  parseEcometriProduct,
  parseEcometriProductsResponse,
  parseEcometriStorePage,
} from "@/lib/ecometri";

/// Página real de una colección de janbeauty.ecometri.shop (recortada a lo
/// que importa: el "flight" de React con los datos de la tienda).
const PAGE = readFileSync(new URL("../fixtures/ecometri-collection.html", import.meta.url), "utf8");

describe("reconocer Ecometri", () => {
  it("por el HTML y por el dominio", () => {
    expect(isEcometriHtml(PAGE)).toBe(true);
    expect(isEcometriHtml("<html><body>hola</body></html>")).toBe(false);
    expect(isEcometriHost("janbeauty.ecometri.shop")).toBe(true);
    expect(isEcometriHost("ecometri.shop.falso.com")).toBe(false);
  });
});

describe("la página de la tienda", () => {
  it("une el flight de React y lee la tienda, sus colecciones y los primeros productos", () => {
    expect(nextFlightPayload(PAGE)).toContain('"initialStoreData"');
    const page = parseEcometriStorePage(PAGE)!;
    expect(page).not.toBeNull();
    expect(page.store).toMatchObject({
      basename: "janbeauty",
      phone: "573202670591",
      name: "JAN BEAUTY",
      currency: "COP",
      logoUrl: "https://d1b50uin55dq3m.cloudfront.net/cf23401e-6115-45e0-9ab7-c3b949c7aadb.jpg",
    });
    expect(page.store.description).toMatch(/Listo para crecer/);
    expect(page.store.collections.map((c) => [c.name, c.slug, c.public])).toEqual([
      ["Electricos", "electricos", false],
      ["Pestañas", "pestanas", true],
      ["Polygel/Acrílico", "polygel-acrilico", true],
      ["Semipermanente", "semipermanente", true],
      ["Todo", "todo", false],
      ["Uñas", "unas", true],
    ]);
    expect(page.store.collections[1].imageUrl).toBe(
      "https://d1b50uin55dq3m.cloudfront.net/1ff06c61-f2f1-4aa5-960d-2b2f380d6f3d.jpg",
    );
    expect(page.products).toHaveLength(12);
    expect(page.totalProducts).toBe(16);
  });

  it("devuelve null en una página que no es de Ecometri", () => {
    expect(parseEcometriStorePage("<html><body><script>self.__next_f.push([1,\"0:{}\"])</script></body></html>")).toBeNull();
    expect(parseEcometriStorePage("<html></html>")).toBeNull();
  });
});

describe("productos", () => {
  const ctx = { origin: "https://janbeauty.ecometri.shop", phone: "573202670591", currency: "COP", collectionName: "Pestañas" };

  it("convierte un producto de la página al shape del importador", () => {
    const page = parseEcometriStorePage(PAGE)!;
    const p = parseEcometriProduct(page.products[0], ctx)!;
    expect(p).toMatchObject({
      handle: "pestana-short-punto-a-punto-5e4f73",
      name: "Volumen Ruso 14MM",
      price: 0,
      compareAtPrice: null,
      currency: "COP",
      sku: "5e4f73",
      stock: null,
      collectionNames: ["Pestañas"],
      hasVariants: false,
      sourceUrl: "https://janbeauty.ecometri.shop/573202670591/pestana-short-punto-a-punto-5e4f73/",
    });
    expect(p.images).toEqual(["https://d1b50uin55dq3m.cloudfront.net/acb5d3e0-e859-4477-b766-a1061d4d774a.jpg"]);
  });

  it("lee la respuesta de la API: precio con descuento, inventario, fotos en orden, inactivos fuera", () => {
    const body = {
      id: "a81ece3b",
      name: "Todo",
      total_products: 125,
      products: [
        {
          id: "1",
          name: "Pegante Salon Pro x30 ML ",
          sku: "71fb4a",
          slug: "pegante-salon-pro-x30-ml-71fb4a",
          description: "Pegante de secado rápido.\n\nRinde 30 ml.",
          price: 45000,
          discount_price: 39900,
          quantity_available: 7,
          active: 1,
          is_hidden_by_limit: false,
          product_images: [
            { picture_url: "b.jpg", order: 1 },
            { picture_url: "a.jpg", order: 0 },
            { picture_url: "a.jpg", order: 2 },
          ],
        },
        { id: "2", name: "Oculto", slug: "oculto-1", price: 10, active: 0, product_images: [] },
        { id: "3", name: "Sin precio", slug: "sin-precio-2", price: "25000", discount_price: 0, product_images: [] },
      ],
    };
    const { products, total } = parseEcometriProductsResponse(body);
    expect(total).toBe(125);
    const parsed = products.map((p) => parseEcometriProduct(p, { ...ctx, collectionName: null })).filter(Boolean);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      name: "Pegante Salon Pro x30 ML",
      price: 39900,
      compareAtPrice: 45000,
      stock: 7,
      collectionNames: [],
      description: "<p>Pegante de secado rápido.</p><p>Rinde 30 ml.</p>",
    });
    expect(parsed[0]!.images).toEqual([
      "https://d1b50uin55dq3m.cloudfront.net/a.jpg",
      "https://d1b50uin55dq3m.cloudfront.net/b.jpg",
    ]);
    expect(parsed[1]).toMatchObject({ name: "Sin precio", price: 25000, compareAtPrice: null, stock: null });
    expect(parseEcometriProductsResponse(null)).toEqual({ products: [], total: null });
  });

  it("arma la dirección de la API y de las fotos", () => {
    expect(ecometriProductsUrl("janbeauty", "", 50)).toBe(
      "https://apiv2.ecometri.shop/api/v1/store/janbeauty/products?collection=&limit=50&offset=50",
    );
    expect(ecometriProductsUrl("jan beauty", "abc", 0, 10)).toBe(
      "https://apiv2.ecometri.shop/api/v1/store/jan%20beauty/products?collection=abc&limit=10&offset=0",
    );
    expect(ecometriImageUrl("/x.jpg")).toBe("https://d1b50uin55dq3m.cloudfront.net/x.jpg");
    expect(ecometriImageUrl("https://otro.com/y.jpg")).toBe("https://otro.com/y.jpg");
    expect(ecometriImageUrl("")).toBeNull();
  });
});
