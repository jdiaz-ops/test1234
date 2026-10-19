import { readFileSync } from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/// Escaneo completo contra tiendas simuladas: se reemplaza fetch y el DNS
/// (todas las tiendas "resuelven" a una IP pública de prueba).
vi.mock("dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import { scanStore, type ScanResult, type ScanStep } from "@/server/services/other-store-reader";

type Routes = Record<string, { status?: number; body: unknown; type?: string; location?: string }>;

function mockFetch(routes: Routes) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: URL | string) => {
      const url = input.toString();
      const route = routes[url];
      if (!route) return new Response("no", { status: 404 });
      if (route.location) return new Response(null, { status: 301, headers: { location: route.location } });
      const isText = typeof route.body === "string";
      return new Response(isText ? (route.body as string) : JSON.stringify(route.body), {
        status: route.status ?? 200,
        headers: { "content-type": route.type ?? (isText ? "text/html" : "application/json") },
      });
    }),
  );
}

async function runAll(url: string) {
  const first = await scanStore(null, { step: "detect", url });
  const results: ScanResult[] = [first];
  const queue: ScanStep[] = [...first.next];
  while (queue.length > 0) {
    const r = await scanStore(first.origin, queue.shift()!);
    results.push(r);
    queue.push(...r.next);
  }
  return results;
}

beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("una tienda Shopify", () => {
  it("sigue la redirección y la deja al lector de Shopify", async () => {
    const origin = new URL("https://www.uñas.example").origin;
    mockFetch({
      [new URL("https://uñas.example").toString()]: { body: "", location: `${origin}/` },
      [`${origin}/`]: { body: '<meta property="og:site_name" content="Uñas Bonitas">' },
      [`${origin}/products.json?limit=1`]: { body: { products: [] } },
    });
    const first = await scanStore(null, { step: "detect", url: "uñas.example" });
    expect(first).toMatchObject({ platform: "shopify", origin, storeName: "Uñas Bonitas", next: [] });
  });
});

describe("escanear una tienda sin API", () => {
  it("encuentra los productos en el sitemap y lee cada página", async () => {
    const O = "https://tienda.example";
    const product = (name: string, price: string) =>
      `<script type="application/ld+json">{"@type":"Product","name":"${name}","offers":{"price":"${price}","priceCurrency":"COP"}}</script>`;
    mockFetch({
      [`${O}/`]: { body: "<title>Tienda | Inicio</title><script>LS.store = {}</script>" },
      [`${O}/robots.txt`]: { body: "Sitemap: https://tienda.example/sitemap.xml", type: "text/plain" },
      [`${O}/sitemap.xml`]: {
        type: "application/xml",
        body: `<urlset>
          <url><loc>${O}/productos/bolso/</loc></url>
          <url><loc>${O}/productos/gorra/</loc></url>
          <url><loc>${O}/categorias/accesorios/</loc></url>
          <url><loc>${O}/contacto/</loc></url>
          <url><loc>https://otro-sitio.example/productos/x/</loc></url>
        </urlset>`,
      },
      [`${O}/productos/bolso/`]: { body: product("Bolso", "89.900") },
      [`${O}/productos/gorra/`]: { body: product("Gorra", "25000") },
    });
    const results = await runAll(O);
    expect(results[0].platform).toBe("tiendanube");
    expect(results[0].storeName).toBe("Tienda");
    expect(results[0].categories.map((c) => c.name)).toEqual(["Accesorios"]);
    const products = results.flatMap((r) => r.products);
    expect(products.map((p) => [p.name, p.price])).toEqual([
      ["Bolso", 89900],
      ["Gorra", 25000],
    ]);
  });

  it("no sigue direcciones internas", async () => {
    await expect(scanStore(null, { step: "detect", url: "http://127.0.0.1:3000" })).rejects.toThrow(/no es pública/);
    await expect(scanStore(null, { step: "detect", url: "http://localhost" })).rejects.toThrow();
  });
});

describe("una tienda Ecometri", () => {
  const O = "https://janbeauty.ecometri.shop";
  const API = "https://apiv2.ecometri.shop/api/v1/store/janbeauty/products";
  const PAGE = readFileSync(new URL("../fixtures/ecometri-collection.html", import.meta.url), "utf8");
  const product = (n: number, extra: Record<string, unknown> = {}) => ({
    id: `id-${n}`,
    name: `Producto ${n}`,
    sku: `sku${n}`,
    slug: `producto-${n}-abc${n}`,
    price: 10000 * n,
    discount_price: 0,
    quantity_available: null,
    active: 1,
    is_hidden_by_limit: false,
    product_images: [{ picture_url: `foto-${n}.jpg`, order: 0 }],
    ...extra,
  });

  it("lee la tienda de la portada y los productos de la API, por colección", async () => {
    mockFetch({
      // La portada redirige a la primera colección (dos saltos, como la real).
      [`${O}/`]: { body: "", location: `${O}/573202670591/` },
      [`${O}/573202670591/`]: { body: "", location: `${O}/573202670591/collections/pestanas/` },
      [`${O}/573202670591/collections/pestanas/`]: { body: PAGE },
      [`${API}?collection=&limit=50&offset=0`]: {
        body: { id: "todo", name: "Todo", total_products: 3, products: [product(1), product(2), product(3, { active: 0 })] },
      },
      [`${API}?collection=097c936d-800b-4fa5-9d5b-b2b970eaba7d&limit=50&offset=0`]: {
        body: { id: "097c936d-800b-4fa5-9d5b-b2b970eaba7d", name: "Pestañas ", total_products: 1, products: [product(1)] },
      },
      [`${API}?collection=88807abc-3c5b-45d0-8bdb-d47f0b7ec065&limit=50&offset=0`]: {
        body: { products: [product(2, { discount_price: 15000 })] },
      },
      [`${API}?collection=0dab6928-8a71-41ed-b3e5-4840889fbe13&limit=50&offset=0`]: { body: { products: [] } },
      [`${API}?collection=bc168297-dc20-4759-8e00-e78fb2d9fb02&limit=50&offset=0`]: { status: 500, body: "error" },
    });
    const results = await runAll("janbeauty.ecometri.shop/573202670591/collections/pestanas/");
    const first = results[0];
    expect(first.platform).toBe("ecometri");
    expect(first.origin).toBe(O);
    expect(first.storeName).toBe("JAN BEAUTY");
    expect(first.storeInfo).toEqual({
      name: "JAN BEAUTY",
      description: "¡Listo para crecer! Descarga nuestro catálogo y encuentra oportunidades de negocio.",
      logoUrl: "https://d1b50uin55dq3m.cloudfront.net/cf23401e-6115-45e0-9ab7-c3b949c7aadb.jpg",
      whatsapp: "573202670591",
    });
    // Solo las colecciones visibles (ni "Todo" ni "Electricos"), con foto y link.
    expect(first.categories.map((c) => c.name)).toEqual(["Pestañas", "Polygel/Acrílico", "Semipermanente", "Uñas"]);
    expect(first.categories[0]).toEqual({
      name: "Pestañas",
      url: `${O}/573202670591/collections/pestanas/`,
      imageUrl: "https://d1b50uin55dq3m.cloudfront.net/1ff06c61-f2f1-4aa5-960d-2b2f380d6f3d.jpg",
    });
    // Un paso para todos los productos y uno por colección visible.
    expect(first.next.map((s) => (s.step === "ecometri-products" ? [s.collection, s.name] : s.step))).toEqual([
      ["", null],
      ["097c936d-800b-4fa5-9d5b-b2b970eaba7d", "Pestañas"],
      ["88807abc-3c5b-45d0-8bdb-d47f0b7ec065", "Polygel/Acrílico"],
      ["0dab6928-8a71-41ed-b3e5-4840889fbe13", "Semipermanente"],
      ["bc168297-dc20-4759-8e00-e78fb2d9fb02", "Uñas"],
    ]);
    const steps = results.slice(1);
    // Todos: los activos, sin colección; por colección: con su nombre.
    expect(steps[0].products.map((p) => [p.handle, p.price, p.collectionNames])).toEqual([
      ["producto-1-abc1", 10000, []],
      ["producto-2-abc2", 20000, []],
    ]);
    expect(steps[0].products[0]).toMatchObject({
      currency: "COP",
      images: ["https://d1b50uin55dq3m.cloudfront.net/foto-1.jpg"],
      sourceUrl: `${O}/573202670591/producto-1-abc1/`,
      sku: "sku1",
    });
    expect(steps[1].products.map((p) => [p.handle, p.collectionNames])).toEqual([["producto-1-abc1", ["Pestañas"]]]);
    expect(steps[2].products[0]).toMatchObject({ price: 15000, compareAtPrice: 20000, collectionNames: ["Polygel/Acrílico"] });
    expect(steps[3].products).toEqual([]);
    // La colección que falló deja un aviso y no frena el resto.
    expect(steps[4].products).toEqual([]);
    expect(steps[4].warnings).toEqual(['No se pudo leer la colección "Uñas".']);
    // Ningún paso pidió más páginas: todo cupo en la primera.
    expect(results.slice(1).flatMap((r) => r.next)).toEqual([]);
  });

  it("pide la página siguiente mientras la API devuelva páginas llenas", async () => {
    const full = Array.from({ length: 50 }, (_, i) => product(i + 1));
    mockFetch({
      [`${O}/`]: { body: PAGE },
      [`${API}?collection=&limit=50&offset=0`]: { body: { total_products: 60, products: full } },
      [`${API}?collection=&limit=50&offset=50`]: { body: { total_products: 60, products: full.slice(0, 10) } },
    });
    const first = await scanStore(null, { step: "detect", url: O });
    const page1 = await scanStore(O, first.next[0]);
    expect(page1.products).toHaveLength(50);
    expect(page1.next).toEqual([{ ...first.next[0], offset: 50 }]);
    const page2 = await scanStore(O, page1.next[0]);
    expect(page2.products).toHaveLength(10);
    expect(page2.next).toEqual([]);
  });

  it("rechaza un paso con identificadores raros", async () => {
    mockFetch({});
    await expect(
      scanStore(O, { step: "ecometri-products", store: "../otra", collection: "", name: null, offset: 0, phone: "1", currency: null }),
    ).rejects.toThrow(/inválido/);
  });
});
