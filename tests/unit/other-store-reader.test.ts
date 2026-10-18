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
