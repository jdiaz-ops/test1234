import { describe, expect, it } from "vitest";
import {
  closestFont,
  cssColorToHex,
  extractColors,
  extractFaviconUrl,
  extractFonts,
  extractLogoUrl,
  extractMenu,
  extractStoreName,
  mapShopifyMenuHref,
  parseShopifyStorefront,
  tintHex,
} from "@/lib/shopify-theme";

const BASE = "https://www.beautysolutionshop.com/";

/// Portada al estilo Dawn (el tema más común de Shopify): colores como
/// variables con tripletas RGB, fuentes por variable, logo en el
/// encabezado y menú en un <nav>.
const DAWN = `<!doctype html><html><head>
<title>Beauty Solution Shop &#8211; Todo para uñas</title>
<meta property="og:site_name" content="Beauty Solution Shop">
<link rel="icon" type="image/png" href="//www.beautysolutionshop.com/cdn/shop/files/favicon_32x32.png?v=1">
<link rel="apple-touch-icon" href="//www.beautysolutionshop.com/cdn/shop/files/favicon_180x180.png?v=1">
<style>
@font-face { font-family: Assistant; src: url(a.woff2); }
@font-face { font-family: "Playfair Display"; src: url(b.woff2); }
body, .color-scheme-1 { --color-background: 250,246,243; --color-foreground: 34, 34, 34; --color-button: 209,71,123; --color-button-text: 255,255,255; }
.color-scheme-2 { --color-background: 18,18,18; --color-foreground: 255,255,255; --color-button: 255,255,255; }
:root { --font-body-family: Assistant, sans-serif; --font-heading-family: "Playfair Display", serif; --color-base-background-2: 243, 235, 230; }
</style></head><body>
<div id="shopify-section-header"><header class="header">
  <a href="/" class="header__heading-link"><img src="//www.beautysolutionshop.com/cdn/shop/files/logo_200x.png?v=3" srcset="//www.beautysolutionshop.com/cdn/shop/files/logo_200x.png?v=3 200w, //www.beautysolutionshop.com/cdn/shop/files/logo_400x.png?v=3 400w" alt="Beauty Solution Shop" class="header__heading-logo"></a>
  <nav class="header__inline-menu"><ul>
    <li><a href="/" class="header__menu-item"><span>Inicio</span></a></li>
    <li><a href="/collections/soft-gel" class="header__menu-item"><span>Soft Gel</span></a></li>
    <li><a href="/collections/acrilicos?sort=1"><span>Acrílicos</span></a></li>
    <li><a href="/pages/contacto"><span>Contacto</span></a></li>
    <li><a href="https://instagram.com/beautysolutionshop"><span>Instagram</span></a></li>
    <li><a href="/cart">Carrito</a></li>
    <li><a href="/collections/soft-gel">Soft Gel (repetido)</a></li>
  </ul></nav>
  <menu-drawer><nav><a href="/collections/soft-gel">Soft Gel</a></nav></menu-drawer>
  <img src="//cdn.shopify.com/s/files/payment-icons/visa.svg" class="payment-icon" alt="">
</header></div>
<main><img src="/cdn/shop/files/banner.jpg"></main>
</body></html>`;

describe("leer el diseño de la portada de Shopify", () => {
  it("convierte cualquier forma de color CSS a hex", () => {
    expect(cssColorToHex("#fff")).toBe("#ffffff");
    expect(cssColorToHex("#D1477B")).toBe("#d1477b");
    expect(cssColorToHex("#d1477bcc")).toBe("#d1477b");
    expect(cssColorToHex("rgb(209, 71, 123)")).toBe("#d1477b");
    expect(cssColorToHex("rgba(209 71 123 / 0.5)")).toBe("#d1477b");
    expect(cssColorToHex("209,71,123")).toBe("#d1477b");
    expect(cssColorToHex("209, 71, 123")).toBe("#d1477b");
    expect(cssColorToHex("linear-gradient(#fff, #000)")).toBeNull();
    expect(cssColorToHex("transparent")).toBeNull();
    const props = new Map([["--base", ["#123456"]]]);
    expect(cssColorToHex("var(--base)", props)).toBe("#123456");
    expect(cssColorToHex("var(--nada, #abc)", props)).toBe("#aabbcc");
    expect(tintHex("#000000", 0.5)).toBe("#808080");
  });

  it("saca los colores del cuerpo (el primer esquema), no de los demás esquemas", () => {
    expect(extractColors(DAWN)).toEqual({
      fondo: "#faf6f3",
      texto: "#222222",
      botones: "#d1477b",
      principal: "#d1477b",
      secundario: "#f3ebe6",
    });
  });

  it("sin variables usa el theme-color, y sin nada devuelve null", () => {
    const meta = `<html><head><meta name="theme-color" content="#336699"></head><body></body></html>`;
    expect(extractColors(meta)).toMatchObject({ fondo: "#ffffff", texto: "#111111", botones: "#336699", principal: "#336699" });
    expect(extractColors("<html><body><p>hola</p></body></html>")).toBeNull();
  });

  it("lee las fuentes y las traduce a nuestro catálogo", () => {
    expect(extractFonts(DAWN)).toEqual({
      headingFamily: "Playfair Display",
      bodyFamily: "Assistant",
      headingFont: "Playfair Display",
      bodyFont: "Karla",
      headingExact: true,
      bodyExact: false,
    });
    expect(closestFont("Montserrat", "heading")).toEqual({ value: "Montserrat", exact: true });
    expect(closestFont("Cormorant Garamond", "body")).toEqual({ value: "Playfair Display", exact: false });
    expect(closestFont("Una Serif Rara", "body")).toEqual({ value: "Lora", exact: false });
    expect(closestFont("Fuente Desconocida", "heading")).toEqual({ value: "Montserrat", exact: false });
    expect(closestFont(null, "body")).toEqual({ value: "Karla", exact: false });
  });

  it("sin variables de fuente usa los @font-face en orden (cuerpo, títulos)", () => {
    const html = `<style>@font-face{font-family:"Lato";src:url(a)}@font-face{font-family:Oswald;src:url(b)}</style>`;
    expect(extractFonts(html)).toMatchObject({ bodyFamily: "Lato", headingFamily: "Oswald", bodyFont: "Karla", headingFont: "Montserrat" });
    expect(extractFonts("<p>sin estilos</p>")).toBeNull();
  });

  it("encuentra el logo (la versión más grande), el favicon y el nombre", () => {
    expect(extractLogoUrl(DAWN, BASE)).toBe("https://www.beautysolutionshop.com/cdn/shop/files/logo_400x.png?v=3");
    expect(extractFaviconUrl(DAWN, BASE)).toBe("https://www.beautysolutionshop.com/cdn/shop/files/favicon_180x180.png?v=1");
    expect(extractStoreName(DAWN)).toBe("Beauty Solution Shop");
    expect(extractStoreName("<title>Mi Tienda – Uñas</title>")).toBe("Mi Tienda");
  });

  it("arma el menú del <nav> del encabezado sin repetidos ni links de carrito", () => {
    expect(extractMenu(DAWN, BASE)).toEqual([
      { label: "Inicio", href: "/" },
      { label: "Soft Gel", href: "/collections/soft-gel" },
      { label: "Acrílicos", href: "/collections/acrilicos" },
      { label: "Contacto", href: "/pages/contacto" },
      { label: "Instagram", href: "https://instagram.com/beautysolutionshop" },
    ]);
    expect(extractMenu("<html><body><p>sin encabezado</p></body></html>", BASE)).toEqual([]);
  });

  it("traduce los links de Shopify a la vitrina de Marcolini", () => {
    const maps = {
      collectionSlugByHandle: new Map([["soft-gel", "soft-gel"], ["acrilicos", "acrilicos-2"]]),
      productSlugByHandle: new Map([["placa-01", "placa-01"]]),
    };
    expect(mapShopifyMenuHref("/", maps)).toBe("/");
    expect(mapShopifyMenuHref("/collections/all", maps)).toBe("/coleccion");
    expect(mapShopifyMenuHref("/collections/soft-gel", maps)).toBe("/coleccion/soft-gel");
    expect(mapShopifyMenuHref("/collections/acrilicos", maps)).toBe("/coleccion/acrilicos-2");
    expect(mapShopifyMenuHref("/collections/no-existe", maps)).toBeNull();
    expect(mapShopifyMenuHref("/products/placa-01", maps)).toBe("/placa-01");
    expect(mapShopifyMenuHref("/collections/soft-gel/products/placa-01", maps)).toBe("/placa-01");
    expect(mapShopifyMenuHref("/pages/contacto", maps)).toBeNull();
    expect(mapShopifyMenuHref("https://instagram.com/x", maps)).toBe("https://instagram.com/x");
  });

  it("junta todo en una sola lectura", () => {
    const info = parseShopifyStorefront(DAWN, BASE);
    expect(info.storeName).toBe("Beauty Solution Shop");
    expect(info.colors?.botones).toBe("#d1477b");
    expect(info.fonts?.headingFont).toBe("Playfair Display");
    expect(info.menu).toHaveLength(5);
    expect(info.logoUrl).toContain("logo_400x");
  });
});
