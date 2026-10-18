/// Lee la portada de una tienda tal como la ve el importador (ver
/// shopify-theme.ts) y muestra qué secciones reconoce, más el HTML
/// comprimido para poder reproducir la lectura. Se corre en GitHub Actions
/// ("Diagnóstico de portada", .github/workflows/diagnostico-portada.yml)
/// porque el entorno donde se programa no tiene salida a internet. Pedido
/// el 2026-10-18: Rumi y amglow (WooCommerce) se importaron sin portada.
///
/// Uso: npx tsx scripts/diagnostico-portada.ts https://tienda.com
import { gzipSync } from "node:zlib";
import { extractGenericHomeSections, parseShopifyStorefront } from "@/lib/shopify-theme";

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

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Falta el link de la tienda.");
    process.exit(1);
  }
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
      "accept-language": "es-CO,es;q=0.9",
    },
  });
  const html = await res.text();
  console.log(`Estado ${res.status} · ${html.length} caracteres · URL final ${res.url}`);
  console.log("---- marcadores ----");
  for (const [name, re] of Object.entries(MARKERS)) console.log(`${name}: ${(html.match(re) ?? []).length}`);

  const theme = parseShopifyStorefront(html, res.url);
  console.log("---- tema ----");
  console.log(JSON.stringify({ storeName: theme.storeName, logoUrl: theme.logoUrl, colors: theme.colors, fonts: theme.fonts, menu: theme.menu, announcements: theme.announcements }, null, 1));
  console.log("---- secciones (extractHomeSections) ----");
  console.log(JSON.stringify(theme.homeSections, null, 1));
  console.log("---- secciones (solo lector genérico) ----");
  console.log(JSON.stringify(extractGenericHomeSections(html, res.url), null, 1));

  console.log("---- HTML gzip base64 ----");
  const b64 = gzipSync(Buffer.from(html, "utf8")).toString("base64");
  for (let i = 0; i < b64.length; i += 4000) console.log(b64.slice(i, i + 4000));
  console.log("---- fin ----");
}

main().catch((err) => {
  console.error("Falló la lectura:", err);
  process.exit(1);
});
