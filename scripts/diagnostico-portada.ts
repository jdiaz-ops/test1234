/// Lee la portada de una tienda tal como la ve el importador (ver
/// shopify-theme.ts) y muestra qué secciones reconoce, más el HTML
/// comprimido para poder reproducir la lectura. Se corre en GitHub Actions
/// ("Diagnóstico de portada", .github/workflows/diagnostico-portada.yml)
/// porque el entorno donde se programa no tiene salida a internet. Pedido
/// el 2026-10-18: Rumi y amglow (WooCommerce) se importaron sin portada.
///
/// Uso: npx tsx scripts/diagnostico-portada.ts https://tienda.com [productos]
/// Con "productos" baja el catálogo (products.json / Store API) en vez de
/// la portada; con "url" solo muestra lo que responde esa dirección.
import { gzipSync } from "node:zlib";
import { parseShopifyStorefront } from "@/lib/shopify-theme";
import { readShopifyStorefront } from "@/server/services/shopify-store-reader";

const MARKERS: Record<string, RegExp> = {
  main: /<main\b/gi,
  elementor: /elementor-widget/gi,
  "elementor-section": /elementor-top-section|e-con\b/gi,
  woocommerce: /woocommerce/gi,
  "ul.products": /<ul\b[^>]*class=["'][^"']*\bproducts\b/gi,
  swiper: /swiper/gi,
  revslider: /rev_slider|rs-slide/gi,
  slick: /slick-/gi,
  owl: /owl-carousel/gi,
  smartslider: /n2-ss-/gi,
  "wp-block": /wp-block-/gi,
  divi: /et_pb_/gi,
  flatsome: /\bux-|flatsome/gi,
  wpbakery: /vc_row/gi,
  "links a categoría": /href=["'][^"']*(?:product-category|categoria-producto|\/categoria\/|\/collections\/)/gi,
  "links a producto": /href=["'][^"']*\/(?:product|producto|products|productos)\//gi,
  iframes: /<iframe\b/gi,
  "imágenes": /<img\b/gi,
  "fondos css": /background(?:-image)?\s*:\s*url\(/gi,
};

const headers = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/json",
  "accept-language": "es-CO,es;q=0.9",
};

/// Un dominio pelado que no responde se prueba con "www." adelante.
async function fetchWithWww(url: string) {
  return fetch(url, { redirect: "follow", headers }).catch(async (err) => {
    const parsed = new URL(url);
    if (/^www\./i.test(parsed.hostname)) throw err;
    parsed.hostname = `www.${parsed.hostname}`;
    console.log(`Sin respuesta en ${url}; probando ${parsed.href}`);
    return fetch(parsed.href, { redirect: "follow", headers });
  });
}

function printGzip(label: string, data: unknown) {
  console.log(`---- ${label} gzip base64 ----`);
  const b64 = gzipSync(Buffer.from(typeof data === "string" ? data : JSON.stringify(data), "utf8")).toString("base64");
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetchWithWww(url);
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/// Modo "productos": baja el catálogo tal como lo publica la tienda
/// (products.json en Shopify, la Store API en WooCommerce) con lo justo
/// para estudiar su estructura — nombres, variantes, categorías,
/// descripciones, fotos, inventario. Pedido el 2026-10-18 para ver cómo
/// están armadas Rumi y amglow antes de diseñar las herramientas de
/// catálogo.
async function diagnoseProducts(url: string) {
  const origin = new URL(url).origin;
  const shopify = (await getJson(`${origin}/products.json?limit=250&page=1`)) as { products?: unknown[] } | null;
  if (shopify?.products) {
    console.log("Plataforma: Shopify");
    type P = {
      id: number; handle: string; title: string; product_type: string; tags: string[]; vendor: string;
      body_html: string; options: { name: string; values: string[] }[];
      variants: { id: number; title: string; price: string; compare_at_price: string | null; available: boolean; grams: number; sku: string; featured_image?: unknown }[];
      images: unknown[];
    };
    const products: P[] = [];
    for (let page = 1; page <= 8; page++) {
      const data = (page === 1 ? shopify : await getJson(`${origin}/products.json?limit=250&page=${page}`)) as { products?: P[] } | null;
      const batch = data?.products ?? [];
      products.push(...batch);
      if (batch.length < 250) break;
    }
    console.log(`Productos: ${products.length}`);
    const collections = ((await getJson(`${origin}/collections.json?limit=250`)) as { collections?: { handle: string; title: string; products_count: number }[] } | null)?.collections ?? [];
    console.log(`Colecciones: ${collections.length}`);
    const members: Record<string, string[]> = {};
    for (const c of collections.slice(0, 60)) {
      const data = (await getJson(`${origin}/collections/${c.handle}/products.json?limit=250`)) as { products?: { handle: string }[] } | null;
      members[c.handle] = (data?.products ?? []).map((p) => p.handle);
    }
    for (const p of products) {
      const avail = p.variants.filter((v) => v.available).length;
      const prices = p.variants.map((v) => Number(v.price));
      console.log(
        `· ${p.title} | tipo=${p.product_type || "-"} | tags=${(p.tags ?? []).join(",") || "-"} | opciones=${p.options.map((o) => `${o.name}(${o.values.length})`).join(" ") || "-"} | variantes=${p.variants.length} disp=${avail} | $${Math.min(...prices)}-${Math.max(...prices)} | fotos=${p.images.length} | desc=${(p.body_html ?? "").replace(/<[^>]+>/g, " ").trim().length}`,
      );
    }
    printGzip("catálogo", {
      platform: "shopify",
      products: products.map((p) => ({
        handle: p.handle, title: p.title, type: p.product_type, tags: p.tags, vendor: p.vendor,
        options: p.options, images: p.images.length,
        description: (p.body_html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
        variants: p.variants.map((v) => ({ title: v.title, price: v.price, compareAt: v.compare_at_price, available: v.available, grams: v.grams, sku: v.sku, image: Boolean(v.featured_image) })),
      })),
      collections: collections.map((c) => ({ handle: c.handle, title: c.title, count: c.products_count, products: members[c.handle] ?? null })),
    });
    return;
  }
  type W = {
    id: number; name: string; slug: string; type: string; description: string; short_description: string;
    categories: { id: number; name: string; slug: string }[]; tags: { name: string }[];
    images: unknown[]; variations: unknown[]; is_in_stock: boolean; is_purchasable: boolean;
    prices: { price: string; regular_price: string; sale_price: string; currency_code: string };
    attributes: { name: string; terms: { name: string }[] }[];
  };
  const first = (await getJson(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=1`)) as W[] | null;
  if (!Array.isArray(first)) {
    console.log("No se encontró products.json (Shopify) ni la Store API (WooCommerce).");
    return;
  }
  console.log("Plataforma: WooCommerce");
  const products: W[] = [...first];
  for (let page = 2; page <= 15 && products.length % 100 === 0 && products.length > 0; page++) {
    const batch = (await getJson(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`)) as W[] | null;
    if (!Array.isArray(batch) || batch.length === 0) break;
    products.push(...batch);
  }
  console.log(`Productos: ${products.length}`);
  const categories = ((await getJson(`${origin}/wp-json/wc/store/v1/products/categories?per_page=100`)) as { id: number; name: string; slug: string; parent: number; count: number }[] | null) ?? [];
  console.log(`Categorías: ${categories.length}`);
  for (const p of products) {
    console.log(
      `· ${p.name} | tipo=${p.type} | cat=${p.categories.map((c) => c.name).join(",") || "-"} | atributos=${(p.attributes ?? []).map((a) => `${a.name}(${a.terms.length})`).join(" ") || "-"} | variaciones=${(p.variations ?? []).length} | stock=${p.is_in_stock ? "sí" : "no"} | $${p.prices?.price} | fotos=${p.images.length} | desc=${(p.description ?? "").replace(/<[^>]+>/g, " ").trim().length}/${(p.short_description ?? "").replace(/<[^>]+>/g, " ").trim().length}`,
    );
  }
  printGzip("catálogo", {
    platform: "woocommerce",
    products: products.map((p) => ({
      id: p.id, slug: p.slug, name: p.name, type: p.type,
      categories: p.categories.map((c) => c.slug), tags: (p.tags ?? []).map((t) => t.name),
      attributes: (p.attributes ?? []).map((a) => ({ name: a.name, terms: a.terms.map((t) => t.name) })),
      variations: (p.variations ?? []).length, inStock: p.is_in_stock, purchasable: p.is_purchasable,
      price: p.prices?.price, regular: p.prices?.regular_price, sale: p.prices?.sale_price, currency: p.prices?.currency_code,
      images: p.images.length,
      description: (p.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
      short: (p.short_description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
    })),
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, parent: c.parent, count: c.count })),
  });
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Falta el link de la tienda.");
    process.exit(1);
  }
  if (process.argv[3] === "productos") {
    await diagnoseProducts(url);
    console.log("---- fin ----");
    return;
  }
  if (process.argv[3] === "buscar") {
    // Modo "buscar": baja una o varias direcciones (separadas por espacios
    // o comas — por ejemplo los archivos JavaScript de una tienda) y muestra
    // solo los pedazos que coinciden con un patrón (expresión regular, en
    // PATRON), con contexto. Sirve para descubrir cómo una plataforma llama
    // a su API sin tener que leer todo el archivo.
    const pattern = new RegExp(process.env.PATRON || "apiv2|/api/|fetch\\(", "gi");
    for (const target of url.split(/[\s,]+/).filter(Boolean)) {
      const res = await fetchWithWww(target);
      const text = await res.text();
      console.log(`==== ${target} · Estado ${res.status} · ${text.length} caracteres`);
      let shown = 0;
      for (const m of text.matchAll(pattern)) {
        if (shown++ >= 150) break;
        // Una coincidencia larga (por ejemplo "query X[\s\S]{0,2000}") se
        // muestra completa; una corta, con 260 caracteres de contexto.
        const start = Math.max(0, m.index - 220);
        console.log(`@${m.index}: ${text.slice(start, m.index + Math.max(260, m[0].length + 40)).replace(/\s+/g, " ")}`);
      }
    }
    console.log("---- fin ----");
    return;
  }
  if (process.argv[3] === "post") {
    // Modo "post": manda PATRON como cuerpo JSON a la dirección (por ejemplo
    // una consulta GraphQL de otra plataforma) y muestra la respuesta.
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { ...headers, "content-type": "application/json", accept: "application/json" },
      body: process.env.PATRON || "{}",
    });
    const text = await res.text();
    console.log(`Estado ${res.status} · ${res.headers.get("content-type") ?? "?"} · ${text.length} caracteres · URL final ${res.url}`);
    console.log(text.slice(0, 300_000));
    console.log("---- fin ----");
    return;
  }
  if (process.argv[3] === "url") {
    // Modo "url": muestra lo que responde una dirección cualquiera (por
    // ejemplo /api/salud de la plataforma), sin interpretar nada.
    const res = await fetchWithWww(url);
    const text = await res.text();
    console.log(`Estado ${res.status} · ${res.headers.get("content-type") ?? "?"} · ${text.length} caracteres · URL final ${res.url}`);
    // Completo (hasta 300 000 caracteres) para poder estudiar el HTML de
    // una vitrina de Marcolini desde afuera.
    console.log(text.slice(0, 300_000));
    console.log("---- fin ----");
    return;
  }
  const res = await fetchWithWww(url);
  const html = await res.text();
  console.log(`Estado ${res.status} · ${html.length} caracteres · URL final ${res.url}`);
  console.log("---- marcadores ----");
  for (const [name, re] of Object.entries(MARKERS)) console.log(`${name}: ${(html.match(re) ?? []).length}`);

  // Tal como lo lee el importador (baja también las hojas de estilo que
  // hagan falta para colores, letra y fotos de sliders).
  const { theme } = await readShopifyStorefront(url);
  console.log("---- tema ----");
  console.log(JSON.stringify({ storeName: theme.storeName, logoUrl: theme.logoUrl, colors: theme.colors, fonts: theme.fonts, menu: theme.menu, announcements: theme.announcements }, null, 1));
  console.log("---- secciones (como las lee el importador) ----");
  console.log(JSON.stringify(theme.homeSections, null, 1));
  console.log("---- secciones (solo con el HTML, sin hojas de estilo) ----");
  console.log(JSON.stringify(parseShopifyStorefront(html, res.url).homeSections, null, 1));

  printGzip("HTML", html);
  console.log("---- fin ----");
}

main().catch((err) => {
  console.error("Falló la lectura:", err);
  process.exit(1);
});
