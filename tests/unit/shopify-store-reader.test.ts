import { describe, expect, it } from "vitest";
import { ShopifyStoreError, MAX_PAGES, PAGE_SIZE } from "@/lib/shopify-products-json";
import { normalizeShopifyStoreUrl, readShopifyStorePage } from "@/server/services/shopify-store-reader";

function product(i: number) {
  return {
    id: i,
    title: `Producto ${i}`,
    handle: `producto-${i}`,
    product_type: "Placas",
    published_at: "2026-01-01T00:00:00-05:00",
    variants: [{ option1: "Default Title", price: "1000.00", grams: 10 }],
    images: [],
    options: [{ name: "Title", values: ["Default Title"] }],
  };
}

function page(from: number, count: number, status = 200) {
  const products = Array.from({ length: count }, (_, i) => product(from + i));
  return new Response(JSON.stringify({ products }), { status, headers: { "content-type": "application/json" } });
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

/// fetch de mentira: anota cada URL pedida y responde según el handler.
function fakeFetch(handler: (url: URL) => Response | Promise<Response>) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    return handler(new URL(url));
  };
  return { impl, calls };
}

describe("normalizar el link de la tienda Shopify", () => {
  it("acepta el dominio pelado, con http, con ruta o con mayúsculas, y deja solo la raíz https", () => {
    expect(normalizeShopifyStoreUrl("hlacosedora.myshopify.com").href).toBe("https://hlacosedora.myshopify.com/");
    expect(normalizeShopifyStoreUrl("http://www.beautysolutionshop.com/collections/all?page=2").href).toBe(
      "https://www.beautysolutionshop.com/",
    );
    expect(normalizeShopifyStoreUrl("  HTTPS://Tienda.com/products.json ").href).toBe("https://tienda.com/");
  });

  it("rechaza todo lo que no sea una tienda pública en internet", () => {
    for (const bad of [
      "",
      "marca",
      "localhost",
      "http://localhost:3000",
      "http://127.0.0.1/products.json",
      "https://[::1]/",
      "https://10.0.0.5",
      "https://tienda.internal",
      "https://tienda.local",
      "https://tienda.com:8443",
      "ftp://tienda.com",
      "https://user:pass@tienda.com",
      "no es un link",
    ]) {
      expect(() => normalizeShopifyStoreUrl(bad), bad).toThrow(ShopifyStoreError);
    }
  });
});

describe("leer el catálogo público por páginas", () => {
  it("pide products.json con 250 por página y avisa si puede haber otra", async () => {
    const { impl, calls } = fakeFetch((url) => {
      const n = Number(url.searchParams.get("page"));
      return n === 1 ? page(1, PAGE_SIZE) : page(PAGE_SIZE + 1, 10);
    });
    const first = await readShopifyStorePage("tienda.com", 1, impl);
    expect(calls[0]).toBe(`https://tienda.com/products.json?limit=${PAGE_SIZE}&page=1`);
    expect(first.products).toHaveLength(PAGE_SIZE);
    expect(first.hasMore).toBe(true);
    expect(first.storeUrl).toBe("https://tienda.com/");

    const second = await readShopifyStorePage("tienda.com", 2, impl);
    expect(calls[1]).toBe(`https://tienda.com/products.json?limit=${PAGE_SIZE}&page=2`);
    expect(second.products).toHaveLength(10);
    expect(second.products[0].handle).toBe(`producto-${PAGE_SIZE + 1}`);
    expect(second.hasMore).toBe(false);
  });

  it("sigue el redirect de .myshopify.com al dominio propio y lo devuelve como dominio real", async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.hostname === "marca.myshopify.com"
        ? redirect(`https://www.marca.com${url.pathname}${url.search}`)
        : page(1, 3),
    );
    const result = await readShopifyStorePage("https://marca.myshopify.com", 1, impl);
    expect(calls).toEqual([
      `https://marca.myshopify.com/products.json?limit=${PAGE_SIZE}&page=1`,
      `https://www.marca.com/products.json?limit=${PAGE_SIZE}&page=1`,
    ]);
    expect(result.storeUrl).toBe("https://www.marca.com/");
    expect(result.products).toHaveLength(3);
  });

  it("una tienda con contraseña se explica con sus palabras", async () => {
    const { impl } = fakeFetch(() => redirect("/password"));
    await expect(readShopifyStorePage("tienda.com", 1, impl)).rejects.toThrow(/contraseña/);
  });

  it("no sigue un redirect hacia adentro de la red", async () => {
    const { impl, calls } = fakeFetch(() => redirect("http://10.0.0.8/products.json"));
    await expect(readShopifyStorePage("tienda.com", 1, impl)).rejects.toThrow(ShopifyStoreError);
    expect(calls).toHaveLength(1);
  });

  it("una página web, un 404 o un error del servidor dan un mensaje claro", async () => {
    const html = fakeFetch(() => new Response("<!doctype html><html><body>Hola</body></html>", { status: 200 }));
    await expect(readShopifyStorePage("tienda.com", 1, html.impl)).rejects.toThrow(/página web/);

    const notFound = fakeFetch(() => new Response("nada", { status: 404 }));
    await expect(readShopifyStorePage("tienda.com", 1, notFound.impl)).rejects.toThrow(/catálogo de Shopify/);

    const broken = fakeFetch(() => new Response("x", { status: 500 }));
    await expect(readShopifyStorePage("tienda.com", 1, broken.impl)).rejects.toThrow(/500/);

    const offline = fakeFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(readShopifyStorePage("tienda.com", 1, offline.impl)).rejects.toThrow(/conectar/);
  });

  it("sin productos en la primera página es un error; en una página posterior, el final", async () => {
    const empty = fakeFetch(() => page(1, 0));
    await expect(readShopifyStorePage("tienda.com", 1, empty.impl)).rejects.toThrow(/no tiene productos/);
    const tail = await readShopifyStorePage("tienda.com", 2, empty.impl);
    expect(tail).toMatchObject({ products: [], hasMore: false });
  });

  it("no lee más páginas que el tope", async () => {
    const { impl, calls } = fakeFetch(() => page(1, 1));
    await expect(readShopifyStorePage("tienda.com", MAX_PAGES + 1, impl)).rejects.toThrow(ShopifyStoreError);
    expect(calls).toHaveLength(0);
  });
});

describe("leer colecciones y portada", () => {
  it("lee las colecciones y los productos de cada una, y una colección borrada vuelve vacía", async () => {
    const { readShopifyCollections, readShopifyCollectionProducts } = await import("@/server/services/shopify-store-reader");
    const { impl, calls } = fakeFetch((url) => {
      if (url.pathname === "/collections.json") {
        return new Response(
          JSON.stringify({
            collections: [
              { handle: "soft-gel", title: "Soft Gel", published_at: "2026-01-01", products_count: 2 },
              { handle: "frontpage", title: "Portada", published_at: "2026-01-01", products_count: 2 },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.pathname === "/collections/soft-gel/products.json") return page(1, 2);
      if (url.pathname === "/collections/borrada/products.json") return new Response("no", { status: 404 });
      return new Response("x", { status: 500 });
    });
    const { collections, storeUrl } = await readShopifyCollections("tienda.com", impl);
    expect(storeUrl).toBe("https://tienda.com/");
    expect(collections.map((c) => c.handle)).toEqual(["soft-gel"]);
    expect(calls[0]).toBe(`https://tienda.com/collections.json?limit=${PAGE_SIZE}&page=1`);

    const products = await readShopifyCollectionProducts("tienda.com", "Soft-Gel", 1, impl);
    expect(products).toEqual({ storeUrl: "https://tienda.com/", handles: ["producto-1", "producto-2"], hasMore: false });
    expect(calls[1]).toBe(`https://tienda.com/collections/soft-gel/products.json?limit=${PAGE_SIZE}&page=1`);

    expect(await readShopifyCollectionProducts("tienda.com", "borrada", 1, impl)).toMatchObject({ handles: [], hasMore: false });
    await expect(readShopifyCollectionProducts("tienda.com", "../x", 1, impl)).rejects.toThrow(ShopifyStoreError);
  });

  it("lee la portada y saca el diseño; una portada con contraseña se explica", async () => {
    const { readShopifyStorefront } = await import("@/server/services/shopify-store-reader");
    const html = `<html><head><meta property="og:site_name" content="Tienda"><style>:root{--color-button:#ff0000;--color-background:#ffffff;--color-foreground:#111111;--font-body-family:Montserrat,sans-serif}</style></head><body><header><nav><a href="/collections/todo">Todo</a></nav></header></body></html>`;
    const { impl, calls } = fakeFetch(() => new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
    const result = await readShopifyStorefront("https://marca.myshopify.com", impl);
    expect(calls[0]).toBe("https://marca.myshopify.com/");
    expect(result.theme.storeName).toBe("Tienda");
    expect(result.theme.colors?.botones).toBe("#ff0000");
    expect(result.theme.fonts?.bodyFont).toBe("Montserrat");
    expect(result.theme.menu).toEqual([{ label: "Todo", href: "/collections/todo" }]);

    const locked = fakeFetch(() =>
      new Response(`<html><body><form action="/password" method="post"><input name="password"></form></body></html>`, { status: 200 }),
    );
    await expect(readShopifyStorefront("tienda.com", locked.impl)).rejects.toThrow(/contraseña/);
  });
});

describe("fletes probando carritos", () => {
  /// Una tienda Shopify de mentira con carrito por cookie: el producto
  /// 333 está agotado, el 111 vale $45.000 y tiene 5 de stock; Bogotá
  /// cuesta $8.000 y el resto $15.000, gratis desde $150.000. Antioquia
  /// solo entiende el código de provincia.
  function shopifyFake(opts: { noRates?: boolean } = {}) {
    const calls: { url: string; cookie: string | null }[] = [];
    let quantity = 0;
    const impl = async (url: string, init: RequestInit) => {
      const u = new URL(url);
      const headers = (init.headers ?? {}) as Record<string, string>;
      calls.push({ url, cookie: headers.cookie ?? null });
      const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
        new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...extra } });
      if (u.pathname === "/products.json") {
        return json({
          products: [
            { title: "Caro", handle: "caro", published_at: "2026-01-01", variants: [{ id: 999, price: "90000.00", available: true }] },
            { title: "Agotado", handle: "agotado", published_at: "2026-01-01", variants: [{ id: 333, price: "30000.00", available: true }] },
            { title: "Placa", handle: "placa", published_at: "2026-01-01", variants: [{ id: 111, price: "45000.00", available: true }, { id: 222, price: "20000.00", available: false }] },
          ],
        });
      }
      if (u.pathname === "/cart/add.js") {
        const body = JSON.parse(String(init.body)) as { items: { id: number }[] };
        if (body.items[0].id === 333) return json({ status: 422, message: "Cart Error", description: "Agotado" }, 422);
        quantity = 1;
        return json({ items: [{ variant_id: body.items[0].id, quantity: 1 }] }, 200, { "set-cookie": "cart=tok123; path=/; secure" });
      }
      if (!headers.cookie?.includes("cart=tok123")) return json({ error: "sin carrito" }, 400);
      if (u.pathname === "/cart/update.js") {
        const body = JSON.parse(String(init.body)) as { updates: Record<string, number> };
        quantity = Math.min(5, body.updates["111"]);
        return json({ items: [{ variant_id: 111, quantity }], item_count: quantity, items_subtotal_price: quantity * 4500000 });
      }
      if (u.pathname === "/cart/shipping_rates.json") {
        if (opts.noRates) return new Response("no", { status: 404 });
        const province = u.searchParams.get("shipping_address[province]");
        if (province === "Antioquia") return json({ province: ["no es válida"] }, 422);
        if (quantity * 45000 >= 150000) return json({ shipping_rates: [{ name: "Envío gratis", price: "0.00" }] });
        if (province === "Bogotá, D.C.") return json({ shipping_rates: [{ name: "Envío Bogotá", price: "8000.00" }] });
        return json({ shipping_rates: [{ name: "Nacional", price: "15000.00" }] });
      }
      return new Response("x", { status: 500 });
    };
    return { impl, calls };
  }

  it("arma el carrito con el producto más barato disponible y lee la tarifa de cada departamento", async () => {
    const { readShopifyShippingRates } = await import("@/server/services/shopify-store-reader");
    const { impl, calls } = shopifyFake();
    const result = await readShopifyShippingRates("tienda.com", { regions: ["Bogotá D.C.", "Antioquia", "Valle del Cauca"] }, impl);
    expect(result.variant).toEqual({ variantId: 111, unitPrice: 45000, productName: "Placa" });
    expect(result).toMatchObject({ storeUrl: "https://tienda.com/", quantity: 1, subtotal: 45000, errors: {} });
    expect(result.rates).toEqual({
      "Bogotá D.C.": [{ name: "Envío Bogotá", price: 8000 }],
      Antioquia: [{ name: "Nacional", price: 15000 }],
      "Valle del Cauca": [{ name: "Nacional", price: 15000 }],
    });
    // El 333 se intentó y Shopify lo rechazó; después todo va con la cookie del carrito.
    expect(calls.filter((c) => c.url.includes("/cart/add.js"))).toHaveLength(2);
    expect(calls.filter((c) => c.url.includes("shipping_rates")).every((c) => c.cookie === "cart=tok123")).toBe(true);
    const antioquia = calls.filter((c) => c.url.includes("shipping_rates") && /province%5D=(Antioquia|ANT)/.test(c.url));
    expect(antioquia.map((c) => decodeURIComponent(c.url).includes("province]=ANT"))).toEqual([false, true]);
  });

  it("busca el umbral del envío gratis respetando el stock", async () => {
    const { readShopifyFreeShippingThreshold } = await import("@/server/services/shopify-store-reader");
    const { impl } = shopifyFake();
    const result = await readShopifyFreeShippingThreshold(
      "tienda.com",
      { region: "Bogotá D.C.", variant: { variantId: 111, unitPrice: 45000, productName: "Placa" }, maxQuantity: 14 },
      impl,
    );
    expect(result).toMatchObject({ region: "Bogotá D.C.", threshold: 180000, paidBelow: 135000, maxSubtotal: 225000 });
  });

  it("si la tienda no deja consultar fletes, lo dice de una vez", async () => {
    const { readShopifyShippingRates, ShippingProbeUnavailable } = await import("@/server/services/shopify-store-reader");
    const { impl } = shopifyFake({ noRates: true });
    await expect(readShopifyShippingRates("tienda.com", { regions: ["Bogotá D.C."] }, impl)).rejects.toThrow(ShippingProbeUnavailable);
  });
});
