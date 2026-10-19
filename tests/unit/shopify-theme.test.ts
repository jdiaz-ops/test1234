import { describe, expect, it } from "vitest";
import {
  closestFont,
  cssColorToHex,
  extractColors,
  extractFaviconUrl,
  extractFonts,
  extractLogoUrl,
  extractLogoWidth,
  extractMenu,
  extractProductImageRatio,
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
    expect(closestFont("Nunito Sans", "body")).toEqual({ value: "Nunito Sans", exact: true });
    expect(closestFont("Nunito", "body")).toEqual({ value: "Nunito Sans", exact: false });
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

  it("copia el ancho del logo y la forma de las fotos de las tarjetas", () => {
    const logo = (attrs: string, css = "") =>
      `<html><head><style>${css}</style></head><body><header><a href="/"><img src="/cdn/shop/files/logo.png" alt="Beauty Solution" class="header__heading-logo motion-reduce" ${attrs}></a></header></body></html>`;
    expect(extractLogoWidth(logo('width="250" height="62.5"'), BASE)).toBe(250);
    expect(extractLogoWidth(logo("", ".header__heading-logo { height: auto; max-width: 220px; } @media (max-width: 749px) { .header__heading-logo{max-width:140px} }"), BASE)).toBe(220);
    expect(extractLogoWidth(logo('style="max-width:180px"'), BASE)).toBe(180);
    // El tamaño del archivo no es el ancho en pantalla: manda el CSS, y el
    // atributo solo cuenta en los temas tipo Dawn.
    expect(extractLogoWidth(logo('width="1200" height="300"'), BASE)).toBeNull();
    expect(extractLogoWidth(logo('width="380" style="max-width: 150px"'), BASE)).toBe(150);
    expect(extractLogoWidth('<header><img src="/wp-content/uploads/logo.png" class="custom-logo" width="300" height="80"></header>', BASE)).toBeNull();
    expect(extractLogoWidth(DAWN, BASE)).toBeNull();

    const cards = (...ratios: number[]) =>
      ratios
        .map((r) => `<div class="card-wrapper product-card-wrapper"><div class="card card--media" style="--ratio-percent: ${r}%;"><div class="card__inner ratio" style="--ratio-percent: ${r}%;"></div></div></div>`)
        .join("");
    expect(extractProductImageRatio(cards(125, 125.0, 125))).toBe("portrait");
    expect(extractProductImageRatio(cards(100, 100))).toBe("square");
    expect(extractProductImageRatio(cards(125, 100, 133.3))).toBe("natural");
    expect(extractProductImageRatio(DAWN)).toBeNull();
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

describe("pagos, píxeles, redes y barra de anuncio de la portada", () => {
  const html = `<html><head>
<script>!function(f,b,e,v,n,t,s){}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '222817361457636');fbq('track', 'PageView');</script>
<script>ttq.load('CABC123DEF456');</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ"></script>
<script src="https://cdn.addi.com/widget.js"></script>
</head><body>
<div class="announcement-bar"><span class="announcement-bar__message">Envío gratis desde $150.000</span></div>
<div class="announcement-bar"><span class="announcement-bar__message">  Nuevos soft gel  </span></div>
<header></header>
<footer>
  <a href="https://www.instagram.com/beautysolutionshop/">IG</a>
  <a href="https://instagram.com/p/abc123/">post</a>
  <a href="https://www.tiktok.com/@beautysolution">TT</a>
  <a href="https://wa.me/573001234567?text=hola">WhatsApp</a>
  <a href="mailto:hola@beautysolutionshop.com?subject=x">correo</a>
  <ul class="list-payment">
    <li class="list-payment__item"><svg class="icon icon--full-color" aria-labelledby="pi-visa"><title id="pi-visa">Visa</title></svg></li>
    <li class="list-payment__item"><svg class="icon icon--full-color" aria-labelledby="pi-master"><title id="pi-master">Mastercard</title></svg></li>
    <li class="list-payment__item"><svg class="icon icon--full-color" aria-labelledby="pi-pse"><title id="pi-pse">PSE</title></svg></li>
    <li class="list-payment__item"><svg class="icon icon--full-color" aria-labelledby="pi-nequi"><title id="pi-nequi"></title></svg></li>
  </ul>
  <script src="https://checkout.wompi.co/widget.js"></script>
</footer></body></html>`;

  it("lista los medios de pago del pie y las pasarelas por sus scripts", async () => {
    const { extractPayments } = await import("@/lib/shopify-theme");
    expect(extractPayments(html)).toEqual({
      methods: ["Visa", "Mastercard", "PSE", "Nequi"],
      gateways: ["Wompi", "Addi"],
    });
  });

  it("saca los píxeles y las redes", async () => {
    const { extractPixels, extractSocial, extractAnnouncements } = await import("@/lib/shopify-theme");
    expect(extractPixels(html)).toEqual({ metaPixelId: "222817361457636", tiktokPixelId: "CABC123DEF456", googleAnalyticsId: "G-ABC123XYZ" });
    expect(extractSocial(html)).toEqual({
      instagram: "beautysolutionshop",
      tiktok: "beautysolution",
      facebook: null,
      whatsapp: "573001234567",
      email: "hola@beautysolutionshop.com",
      phone: null,
    });
    expect(extractAnnouncements(html)).toEqual(["Envío gratis desde $150.000", "Nuevos soft gel"]);
    expect(extractPixels("<p>nada</p>")).toEqual({ metaPixelId: null, tiktokPixelId: null, googleAnalyticsId: null });
  });
});

describe("páginas, políticas y portada de Shopify", () => {
  const HOME = `<html><body>
<div id="shopify-section-sections--1__header" class="shopify-section shopify-section-group-header-group"><header><nav><a href="/pages/quienes-somos">Quiénes somos</a></nav></header></div>
<main id="MainContent">
<div id="shopify-section-template--1__image_banner" class="shopify-section section">
  <div class="banner banner--medium">
    <div class="banner__media"><img src="//cdn.shopify.com/s/files/hero_600x.jpg" srcset="//cdn.shopify.com/s/files/hero_600x.jpg 600w, //cdn.shopify.com/s/files/hero_1500x.jpg 1500w" alt=""></div>
    <div class="banner__box"><h2 class="banner__heading">Soft gel para profesionales</h2><p>Envíos a todo el país</p><a href="/collections/soft-gel" class="button button--primary">Ver colección</a></div>
  </div>
</div>
<div id="shopify-section-template--1__featured_collection" class="shopify-section section">
  <div class="collection"><h2 class="title">Lo más vendido</h2><ul><li><a href="/products/placa-01">Placa</a></li></ul><a href="/collections/mas-vendidos" class="button">Ver todo</a></div>
</div>
<div id="shopify-section-template--1__rich_text" class="shopify-section section">
  <div class="rich-text"><h2>Hecho para técnicas de uñas</h2><p>Productos probados.</p><p>Calidad garantizada.</p></div>
</div>
<div id="shopify-section-template--1__collection_list" class="shopify-section section">
  <div class="collection-list-wrapper"><h2>Compra por categoría</h2>
    <ul><li><a href="/collections/soft-gel"><img src="//cdn.shopify.com/s/files/c1.jpg"><span>Soft Gel</span></a></li>
    <li><a href="/collections/esmaltes"><img src="//cdn.shopify.com/s/files/c2.jpg"><span>Esmaltes</span></a></li>
    <li><a href="/collections/all">Todo</a></li></ul>
  </div>
</div>
<div id="shopify-section-template--1__video" class="shopify-section section"><div class="video-section"><h2>Mira cómo se aplica</h2><iframe src="https://www.youtube.com/embed/abc123?rel=0"></iframe></div></div>
<div id="shopify-section-template--1__multicolumn" class="shopify-section section"><div class="multicolumn"><ul class="multicolumn-list">
  <li class="multicolumn-list__item"><div class="multicolumn-card"><h3>Envío gratis</h3><p>Desde $150.000</p></div></li>
  <li class="multicolumn-list__item"><div class="multicolumn-card"><h3>Pago seguro</h3><p>PSE y tarjetas</p></div></li>
</ul></div></div>
<div id="shopify-section-template--1__newsletter" class="shopify-section section"><h2>Suscríbete</h2></div>
</main>
<footer><a href="/pages/contacto">Contacto</a><a href="/policies/shipping-policy">Envíos</a><a href="/policies/refund-policy">Cambios</a><a href="/pages/quienes-somos">Nosotros</a></footer>
</body></html>`;

  it("encuentra las páginas y políticas enlazadas", async () => {
    const { extractPageLinks, extractPolicyLinks } = await import("@/lib/shopify-theme");
    expect(extractPageLinks(HOME, BASE)).toEqual([
      { handle: "quienes-somos", label: "Quiénes somos" },
      { handle: "contacto", label: "Contacto" },
    ]);
    expect(extractPolicyLinks(HOME)).toEqual(["shipping-policy", "refund-policy"]);
  });

  it("saca el título y el cuerpo de una página o política", async () => {
    const { extractPageContent } = await import("@/lib/shopify-theme");
    const policy = `<html><body><header>x</header><main><div class="shopify-policy__container"><div class="shopify-policy__title"><h1>Política de envío</h1></div><div class="shopify-policy__body"><div class="rte"><p>Enviamos a <strong>todo</strong> el país.</p><div><p>Anidado</p></div><img src="//cdn.shopify.com/s/files/mapa.jpg"></div></div></div></main><footer>y</footer></body></html>`;
    expect(extractPageContent(policy, BASE)).toEqual({
      title: "Política de envío",
      bodyHtml: `<div class="rte"><p>Enviamos a <strong>todo</strong> el país.</p><div><p>Anidado</p></div><img src="https://cdn.shopify.com/s/files/mapa.jpg"></div>`,
    });
    const page = `<html><body><main id="MainContent"><h1 class="page-title">Quiénes somos</h1><div class="rte"><p>Somos una marca.</p><script>alert(1)</script></div></main></body></html>`;
    expect(extractPageContent(page, BASE)).toEqual({ title: "Quiénes somos", bodyHtml: "<p>Somos una marca.</p>" });
    expect(extractPageContent("<html><body><main></main></body></html>", BASE)).toBeNull();
  });

  it("reconoce las secciones de la portada en orden", async () => {
    const { extractHomeSections } = await import("@/lib/shopify-theme");
    expect(extractHomeSections(HOME, BASE)).toEqual([
      {
        type: "BANNER",
        images: ["https://cdn.shopify.com/s/files/hero_1500x.jpg"],
        title: "Soft gel para profesionales",
        subtitle: "Envíos a todo el país",
        buttonText: "Ver colección",
        buttonHref: "/collections/soft-gel",
      },
      { type: "FEATURED_COLLECTION", collectionHandle: "mas-vendidos", title: "Lo más vendido" },
      { type: "TEXT", heading: "Hecho para técnicas de uñas", body: "Productos probados.\n\nCalidad garantizada." },
      {
        type: "CATEGORY_GRID",
        title: "Compra por categoría",
        items: [
          { collectionHandle: "soft-gel", imageUrl: "https://cdn.shopify.com/s/files/c1.jpg", label: "Soft Gel" },
          { collectionHandle: "esmaltes", imageUrl: "https://cdn.shopify.com/s/files/c2.jpg", label: "Esmaltes" },
        ],
      },
      { type: "VIDEO", url: "https://www.youtube.com/embed/abc123?rel=0", title: "Mira cómo se aplica" },
      {
        type: "INFO_COLUMNS",
        items: [
          { title: "Envío gratis", description: "Desde $150.000" },
          { title: "Pago seguro", description: "PSE y tarjetas" },
        ],
      },
    ]);
  });

  it("traduce los links a páginas cuando ya existen acá", async () => {
    const { mapShopifyMenuHref } = await import("@/lib/shopify-theme");
    const maps = { collectionSlugByHandle: new Map(), productSlugByHandle: new Map(), pageSlugByHandle: new Map([["contacto", "contactanos"]]) };
    expect(mapShopifyMenuHref("/pages/contacto", maps)).toBe("/pagina/contactanos");
    expect(mapShopifyMenuHref("/pages/otra", maps)).toBeNull();
  });
});

describe("diseño de tiendas WordPress (WooCommerce)", () => {
  it("lee los colores de las variables de WordPress, Astra y Elementor", async () => {
    const { extractColors, parseShopifyStorefront } = await import("@/lib/shopify-theme");
    const wp = `<html><head><style id="global-styles-inline-css">:root{--wp--preset--color--base:#fdfdfd;--wp--preset--color--contrast:#1f1f1f;--wp--preset--color--primary:#c2185b}</style></head><body></body></html>`;
    expect(extractColors(wp)).toMatchObject({ fondo: "#fdfdfd", texto: "#1f1f1f", botones: "#c2185b", principal: "#c2185b" });
    const astra = `<html><head><style>:root{--ast-global-color-0:#e91e63;--ast-global-color-3:#333333;--ast-global-color-5:#ffffff}</style></head></html>`;
    expect(extractColors(astra)).toMatchObject({ fondo: "#ffffff", texto: "#333333", botones: "#e91e63" });
    // Elementor guarda todo en su propio .css: entra como extraCss.
    const html = `<html><head><title>Rumi</title></head><body><h1>Hola</h1></body></html>`;
    const css = `.elementor-kit-7{--e-global-color-primary:#D81B60;--e-global-color-text:#222222;--e-global-typography-primary-font-family:"Playfair Display";--e-global-typography-text-font-family:"Poppins"}`;
    const theme = parseShopifyStorefront(html, "https://rumicol.com", css);
    expect(theme.colors).toMatchObject({ botones: "#d81b60", principal: "#d81b60", texto: "#222222" });
    expect(theme.fonts).toMatchObject({ headingFont: "Playfair Display", bodyFont: "Poppins" });
    expect(parseShopifyStorefront(html, "https://rumicol.com").colors).toBeNull();
  });

  it("saca las letras por selector (body y h1) y, si no, del link de Google Fonts", async () => {
    const { extractFonts, googleFontFamilies } = await import("@/lib/shopify-theme");
    const astra = `<html><head><style>body,button,input{font-family:'Poppins',sans-serif;font-size:16px}h1,.entry-title,h2{font-family:'Playfair Display',serif}</style></head></html>`;
    expect(extractFonts(astra)).toMatchObject({ bodyFamily: "Poppins", headingFamily: "Playfair Display", headingFont: "Playfair Display", bodyFont: "Poppins" });
    const linked = `<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600&amp;family=Playfair+Display:wght@700&amp;display=swap"></head></html>`;
    expect(googleFontFamilies(linked)).toEqual(["Nunito Sans", "Playfair Display"]);
    expect(extractFonts(linked)).toMatchObject({ bodyFont: "Nunito Sans", headingFont: "Playfair Display" });
    const old = `<link href="//fonts.googleapis.com/css?family=Montserrat:400,700%7CLora:400&subset=latin" rel="stylesheet">`;
    expect(googleFontFamilies(old)).toEqual(["Montserrat", "Lora"]);
    expect(extractFonts("<html><head></head></html>")).toBeNull();
  });
});

describe("portada de tiendas que no son Shopify (WooCommerce con Elementor, Gutenberg, Storefront)", () => {
  const ELEMENTOR = `<html><head><title>Rumi</title></head><body class="home">
<header id="masthead" class="site-header"><nav><a href="https://rumicol.com/product-category/esmaltes/">Esmaltes</a><a href="https://rumicol.com/tienda/">Tienda</a></nav></header>
<main id="content" class="site-main">
<div data-elementor-type="wp-page" class="elementor elementor-45">
  <section class="elementor-section elementor-top-section">
    <div class="elementor-widget elementor-widget-slides">
      <div class="elementor-swiper"><div class="elementor-main-swiper swiper-container"><div class="swiper-wrapper">
        <div class="swiper-slide"><div class="swiper-slide-bg" style="background-image: url(https://rumicol.com/wp-content/uploads/2026/01/hero-1.jpg);"></div>
          <div class="swiper-slide-contents"><div class="elementor-slide-heading">Uñas que hablan por ti</div><div class="elementor-slide-description">Esmaltes profesionales hechos en Colombia</div><a class="elementor-slide-button elementor-button" href="https://rumicol.com/product-category/esmaltes/">Ver esmaltes</a></div></div>
        <div class="swiper-slide"><div class="swiper-slide-bg" style="background-image: url(https://rumicol.com/wp-content/uploads/2026/01/hero-2.jpg);"></div></div>
      </div></div></div>
    </div>
  </section>
  <section class="elementor-section elementor-top-section">
    <div class="elementor-widget elementor-widget-heading"><h2 class="elementor-heading-title">Compra por categoría</h2></div>
    <div class="elementor-widget elementor-widget-woocommerce-product-categories"><ul class="products columns-3">
      <li class="product-category product"><a href="https://rumicol.com/product-category/esmaltes/"><img src="https://rumicol.com/wp-content/uploads/cat-esmaltes-300x300.jpg" srcset="https://rumicol.com/wp-content/uploads/cat-esmaltes-300x300.jpg 300w, https://rumicol.com/wp-content/uploads/cat-esmaltes.jpg 800w" width="300" height="300"><h2 class="woocommerce-loop-category__title">Esmaltes <mark class="count">(24)</mark></h2></a></li>
      <li class="product-category product"><a href="https://rumicol.com/product-category/decoracion/"><img data-src="https://rumicol.com/wp-content/uploads/cat-deco.jpg" src="data:image/gif;base64,R0lGOD" width="300"><h2 class="woocommerce-loop-category__title">Decoración <mark class="count">(8)</mark></h2></a></li>
    </ul></div>
  </section>
  <section class="elementor-section elementor-top-section">
    <div class="elementor-widget elementor-widget-heading"><h2 class="elementor-heading-title">Lo más vendido</h2></div>
    <div class="elementor-widget elementor-widget-woocommerce-products"><div class="woocommerce columns-4"><ul class="products columns-4">
      <li class="product"><a href="https://rumicol.com/product/esmalte-rojo-pasion/" class="woocommerce-LoopProduct-link"><img src="https://rumicol.com/wp-content/uploads/rojo-300x300.jpg" width="300"><h2 class="woocommerce-loop-product__title">Esmalte Rojo Pasión</h2><span class="price">$18.000</span></a><a href="/?add-to-cart=12" class="button add_to_cart_button">Agregar al carrito</a></li>
      <li class="product"><a href="https://rumicol.com/product/esmalte-nude/" class="woocommerce-LoopProduct-link"><h2 class="woocommerce-loop-product__title">Esmalte Nude</h2></a></li>
    </ul></div></div>
  </section>
  <section class="elementor-section elementor-top-section" data-settings="{&quot;background_background&quot;:&quot;classic&quot;,&quot;background_image&quot;:{&quot;url&quot;:&quot;https:\\/\\/rumicol.com\\/wp-content\\/uploads\\/promo.jpg&quot;,&quot;id&quot;:99}}">
    <div class="elementor-widget elementor-widget-heading"><h2 class="elementor-heading-title">Envío gratis desde $150.000</h2></div>
    <div class="elementor-widget elementor-widget-button"><a class="elementor-button" href="https://rumicol.com/tienda/"><span class="elementor-button-text">Comprar ahora</span></a></div>
  </section>
  <section class="elementor-section elementor-top-section">
    <div class="elementor-widget elementor-widget-heading"><h2>Nuestra historia</h2></div>
    <div class="elementor-widget elementor-widget-text-editor"><p>Rumi nació en Bogotá en 2019 con la idea de hacer esmaltes de calidad para técnicas de uñas.</p><p>Hoy llegamos a todo el país.</p></div>
  </section>
  <section class="elementor-section elementor-top-section">
    <div class="elementor-widget elementor-widget-heading"><h2>Mira cómo se aplica</h2></div>
    <div class="elementor-widget elementor-widget-video" data-settings="{&quot;youtube_url&quot;:&quot;https:\\/\\/www.youtube.com\\/watch?v=abc123&quot;,&quot;video_type&quot;:&quot;youtube&quot;}"><div class="elementor-wrapper"></div></div>
  </section>
  <section class="elementor-section elementor-top-section">
    <div class="elementor-column"><div class="elementor-widget elementor-widget-icon-box"><div class="elementor-icon-box-wrapper"><i class="fas fa-truck"></i><h3 class="elementor-icon-box-title">Envío a todo el país</h3><p class="elementor-icon-box-description">2 a 5 días hábiles</p></div></div></div>
    <div class="elementor-column"><div class="elementor-widget elementor-widget-icon-box"><h3 class="elementor-icon-box-title">Pago seguro</h3><p>PSE, tarjetas y Nequi</p></div></div>
    <div class="elementor-column"><div class="elementor-widget elementor-widget-icon-box"><h3 class="elementor-icon-box-title">Garantía</h3><p>Cambios hasta 30 días</p></div></div>
  </section>
  <section class="elementor-section elementor-top-section">
    <div class="elementor-widget elementor-widget-heading"><h2>Suscríbete</h2></div>
    <form class="elementor-form"><input type="email"><p>Te mandamos novedades y descuentos cada semana, sin spam ni cuentos.</p></form>
  </section>
</div>
</main>
<footer id="colophon" class="site-footer"><a href="https://rumicol.com/product-category/kits/">Kits</a><p>Rumi © 2026. Esmaltes hechos en Colombia con amor para técnicas de uñas de todo el país.</p></footer>
</body></html>`;

  it("reconoce slider, categorías, productos, banner con fondo, texto, video y columnas de Elementor", async () => {
    const { extractHomeSections } = await import("@/lib/shopify-theme");
    expect(extractHomeSections(ELEMENTOR, "https://rumicol.com")).toEqual([
      {
        type: "BANNER",
        images: ["https://rumicol.com/wp-content/uploads/2026/01/hero-1.jpg", "https://rumicol.com/wp-content/uploads/2026/01/hero-2.jpg"],
        title: "Uñas que hablan por ti",
        subtitle: "Esmaltes profesionales hechos en Colombia",
        buttonText: "Ver esmaltes",
        buttonHref: "/collections/esmaltes",
        links: ["/collections/esmaltes", ""],
      },
      {
        type: "CATEGORY_GRID",
        title: "Compra por categoría",
        items: [
          { collectionHandle: "esmaltes", imageUrl: "https://rumicol.com/wp-content/uploads/cat-esmaltes.jpg", label: "Esmaltes" },
          { collectionHandle: "decoracion", imageUrl: "https://rumicol.com/wp-content/uploads/cat-deco.jpg", label: "Decoración" },
        ],
      },
      { type: "FEATURED_PRODUCTS", productHandles: ["esmalte-rojo-pasion", "esmalte-nude"], title: "Lo más vendido" },
      {
        type: "BANNER",
        images: ["https://rumicol.com/wp-content/uploads/promo.jpg"],
        title: "Envío gratis desde $150.000",
        subtitle: "",
        buttonText: "Comprar ahora",
        buttonHref: "/collections/all",
        links: [""],
      },
      {
        type: "TEXT",
        heading: "Nuestra historia",
        body: "Rumi nació en Bogotá en 2019 con la idea de hacer esmaltes de calidad para técnicas de uñas.\n\nHoy llegamos a todo el país.",
      },
      { type: "VIDEO", url: "https://www.youtube.com/watch?v=abc123", title: "Mira cómo se aplica" },
      {
        type: "INFO_COLUMNS",
        items: [
          { title: "Envío a todo el país", description: "2 a 5 días hábiles" },
          { title: "Pago seguro", description: "PSE, tarjetas y Nequi" },
          { title: "Garantía", description: "Cambios hasta 30 días" },
        ],
      },
    ]);
  });

  const GUTENBERG = `<html><body>
<header class="site-header"><a href="/"><img src="https://amglow.co/wp-content/uploads/logo.png" width="200"></a></header>
<div id="content" class="site-content"><main id="main" class="site-main"><article class="post-2 page"><div class="entry-content">
<div class="wp-block-cover alignfull"><img class="wp-block-cover__image-background" src="https://amglow.co/wp-content/uploads/portada-1536x1024.jpg" srcset="https://amglow.co/wp-content/uploads/portada-1536x1024.jpg 1536w, https://amglow.co/wp-content/uploads/portada-scaled.jpg 2048w" width="1536" height="1024"><div class="wp-block-cover__inner-container"><h1 class="has-text-align-center">Brilla con AM Glow</h1><p>Gel polish con fórmula vegana</p><div class="wp-block-buttons"><div class="wp-block-button"><a class="wp-block-button__link" href="https://amglow.co/tienda/">Comprar</a></div></div></div></div>
<h2 class="has-text-align-center">Categorías</h2>
<div class="wp-block-columns">
  <div class="wp-block-column"><figure class="wp-block-image"><a href="https://amglow.co/categoria-producto/gel-polish/"><img src="https://amglow.co/wp-content/uploads/gel-768x768.jpg" width="768" height="768"></a></figure><p class="has-text-align-center"><a href="https://amglow.co/categoria-producto/gel-polish/">Gel polish</a></p></div>
  <div class="wp-block-column"><figure class="wp-block-image"><a href="https://amglow.co/categoria-producto/bases-y-tops/"><img src="https://amglow.co/wp-content/uploads/bases-768x768.jpg" width="768"></a></figure><p><a href="https://amglow.co/categoria-producto/bases-y-tops/">Bases y tops</a></p></div>
  <div class="wp-block-column"><figure class="wp-block-image"><a href="https://amglow.co/categoria-producto/accesorios/"><img alt="Accesorios" src="https://amglow.co/wp-content/uploads/acc-768x768.jpg" width="768"></a></figure></div>
</div>
<section class="storefront-product-section storefront-recent-products"><h2 class="section-title">Novedades</h2><ul class="products columns-4">
  <li class="product"><a href="https://amglow.co/producto/gel-polish-rosa-01/"><img src="https://amglow.co/wp-content/uploads/rosa-300x300.jpg" width="300"><h2 class="woocommerce-loop-product__title">Gel polish Rosa 01</h2></a></li>
  <li class="product"><a href="https://amglow.co/producto/top-coat-brillo/"><h2>Top coat brillo</h2></a></li>
  <li class="product"><a href="https://amglow.co/producto/base-coat/"><h2>Base coat</h2></a></li>
</ul></section>
<figure class="wp-block-embed is-type-video is-provider-youtube wp-block-embed-youtube"><div class="wp-block-embed__wrapper"><iframe title="Tutorial" src="https://www.youtube.com/embed/xyz789?feature=oembed"></iframe></div></figure>
<div class="wp-block-media-text alignwide"><figure class="wp-block-media-text__media"><img src="https://amglow.co/wp-content/uploads/lab-1024x683.jpg" width="1024" height="683"></figure><div class="wp-block-media-text__content"><h2>Hecho en Medellín</h2><p>Formulamos cada tono en nuestro laboratorio con pigmentos de alta pureza y sin ingredientes tóxicos.</p></div></div>
<figure class="wp-block-image size-full"><a href="https://amglow.co/producto/kit-inicial/"><img src="https://amglow.co/wp-content/uploads/kit-banner.jpg" width="1600" height="600"></a></figure>
</div></article></main></div>
<footer class="site-footer"><p>AM Glow</p></footer>
</body></html>`;

  it("reconoce la portada de bloques de WordPress (cover, columnas con categorías, productos, video, imagen con texto)", async () => {
    const { extractHomeSections } = await import("@/lib/shopify-theme");
    expect(extractHomeSections(GUTENBERG, "https://www.amglow.co")).toEqual([
      {
        type: "BANNER",
        images: ["https://amglow.co/wp-content/uploads/portada-scaled.jpg"],
        title: "Brilla con AM Glow",
        subtitle: "Gel polish con fórmula vegana",
        buttonText: "Comprar",
        buttonHref: "/collections/all",
        links: [""],
      },
      // Tres categorías con foto grande: banners de categoría (no la
      // cuadrícula chica). "Novedades" se arma sola acá.
      {
        type: "CATEGORY_BANNERS",
        items: [
          { collectionHandle: "gel-polish", imageUrl: "https://amglow.co/wp-content/uploads/gel-768x768.jpg", label: "Gel polish" },
          { collectionHandle: "bases-y-tops", imageUrl: "https://amglow.co/wp-content/uploads/bases-768x768.jpg", label: "Bases y tops" },
          { collectionHandle: "accesorios", imageUrl: "https://amglow.co/wp-content/uploads/acc-768x768.jpg", label: "Accesorios" },
        ],
      },
      { type: "NEW_PRODUCTS", title: "Novedades" },
      { type: "VIDEO", url: "https://www.youtube.com/embed/xyz789?feature=oembed", title: "" },
      {
        type: "BANNER",
        images: ["https://amglow.co/wp-content/uploads/lab-1024x683.jpg"],
        title: "Hecho en Medellín",
        subtitle: "Formulamos cada tono en nuestro laboratorio con pigmentos de alta pureza y sin ingredientes tóxicos.",
        buttonText: "",
        buttonHref: "",
        links: [""],
      },
      // Una foto apaisada con link: banner cuyo clic lleva al producto.
      { type: "BANNER", images: ["https://amglow.co/wp-content/uploads/kit-banner.jpg"], title: "", subtitle: "", buttonText: "", buttonHref: "", links: ["/products/kit-inicial"] },
    ]);
  });

  // Como la portada real de rumicol.com (2026-10-18): slider de Elementor
  // con las fotos en el CSS, versión para celular escondida, carrusel de
  // productos de Essential Addons, banners anchos con link a categorías,
  // fila de íconos con el texto adentro y una foto grande de
  // distribuidores.
  const RUMI = `<html><head><style>.elementor-45 .elementor-element-e75937c .elementor-repeater-item-70c8e4d .swiper-slide-bg{background-image:url("https://rumicol.com/wp-content/uploads/2026/01/slide-1.jpg");}
@media(max-width:767px){.elementor-45 .elementor-element-e75937c .elementor-repeater-item-70c8e4d .swiper-slide-bg{background-image:url("https://rumicol.com/wp-content/uploads/2026/01/slide-1-movil.jpg");}}</style></head><body>
<header class="site-header"><nav><a href="https://rumicol.com/categoria-producto/colecciones/">Colecciones</a></nav></header>
<main id="content">
<section class="elementor-section elementor-top-section elementor-element elementor-element-78c565a elementor-hidden-mobile" data-id="78c565a">
  <div class="elementor-element elementor-element-e75937c elementor-widget elementor-widget-slides"><div class="elementor-slides-wrapper elementor-main-swiper swiper"><div class="swiper-wrapper elementor-slides">
    <div class="elementor-repeater-item-70c8e4d swiper-slide"><div class="swiper-slide-bg" role="img" aria-label="Rumi"></div><a class="swiper-slide-inner" href="https://rumicol.com/semipermanente/"><div class="swiper-slide-contents"></div></a></div>
    <div class="elementor-repeater-item-1e7fdfe swiper-slide"><div class="swiper-slide-bg" role="img"></div><a class="swiper-slide-inner" href="https://rumicol.com/categoria-producto/colecciones/"><div class="swiper-slide-contents"></div></a></div>
  </div></div></div>
</section>
<section class="elementor-section elementor-top-section elementor-element elementor-element-e61c573 elementor-hidden-desktop elementor-hidden-tablet" data-id="e61c573">
  <div class="elementor-element elementor-element-b1b2b3b elementor-widget elementor-widget-slides"><div class="swiper"><div class="swiper-wrapper"><div class="elementor-repeater-item-b85af60 swiper-slide"><div class="swiper-slide-bg" style="background-image:url(https://rumicol.com/wp-content/uploads/2026/01/slide-1-movil.jpg)"></div></div></div></div></div>
</section>
<section class="elementor-section elementor-top-section elementor-element" data-id="bc2a23f">
  <div class="elementor-widget elementor-widget-eael-woo-product-carousel"><div class="swiper-container-wrap eael-woo-product-carousel-container"><div class="woocommerce eael-woo-product-carousel swiper swiper-container"><div class="products swiper-wrapper">
    <div class="product swiper-slide post-10272 type-product"><a href="https://rumicol.com/producto/linner-metallic-gel/"><img width="1000" height="1000" src="https://rumicol.com/wp-content/uploads/2026/09/METALLIC-gel-linner.jpg" alt="Linner metallic gel"><h2>Linner metallic gel</h2></a></div>
    <div class="product swiper-slide post-10262 type-product"><a href="https://rumicol.com/producto/opal-gel/"><img width="1000" height="1000" src="https://rumicol.com/wp-content/uploads/2026/09/Opal-GEL.jpg" alt="Opal gel"><h2>Opal gel</h2></a></div>
    <div class="product swiper-slide post-10252 type-product"><a href="https://rumicol.com/producto/diamond-powder/"><h2>Diamond powder</h2></a></div>
  </div></div></div></div>
  <div class="elementor-widget elementor-widget-button"><a class="elementor-button elementor-button-link" href="https://rumicol.com/categoria-producto/lo-nuevo/"><span class="elementor-button-text">LO NUEVO</span></a></div>
</section>
<section class="elementor-section elementor-top-section elementor-element" data-id="0044001">
  <div class="elementor-widget elementor-widget-image"><a href="https://rumicol.com/categoria-producto/herramientas/"><img width="1000" height="400" src="https://rumicol.com/wp-content/uploads/2025/10/Lanzamientos-profecioales.jpg" alt="Lanzamientos-profecioales"></a></div>
  <div class="elementor-widget elementor-widget-image"><a href="https://rumicol.com/colecciones/"><img width="1000" height="400" src="https://rumicol.com/wp-content/uploads/2026/04/Sin-titulo-2.jpg" alt=""></a></div>
  <div class="elementor-widget elementor-widget-image"><a href="https://rumicol.com/categoria-producto/decoracion/"><img width="1000" height="400" src="https://rumicol.com/wp-content/uploads/2025/10/Decoracion-rumi.jpg" alt=""></a></div>
</section>
<section class="elementor-section elementor-top-section elementor-element" data-id="5ce7a3b">
  <div class="elementor-widget elementor-widget-image"><img width="700" height="700" src="https://rumicol.com/wp-content/uploads/2023/02/transporte.jpg" alt="Envíos a todo el país"></div>
  <div class="elementor-widget elementor-widget-image"><img width="700" height="700" src="https://rumicol.com/wp-content/uploads/2023/02/calidad.jpg" alt=""></div>
  <div class="elementor-widget elementor-widget-image"><a href="https://wa.link/s2hjcy"><img width="700" height="700" src="https://rumicol.com/wp-content/uploads/2023/02/contacto.jpg" alt=""></a></div>
  <div class="elementor-widget elementor-widget-image"><img width="700" height="700" src="https://rumicol.com/wp-content/uploads/2023/02/pago-seguro-1.jpg" alt=""></div>
</section>
<section class="elementor-section elementor-top-section elementor-element elementor-hidden-desktop" data-id="17c1523">
  <div class="elementor-widget elementor-widget-image"><img width="300" height="300" src="https://rumicol.com/wp-content/uploads/2023/02/transporte-300x300.jpg" alt=""></div>
  <div class="elementor-widget elementor-widget-image"><img width="300" height="300" src="https://rumicol.com/wp-content/uploads/2023/02/calidad-300x300.jpg" alt=""></div>
  <div class="elementor-widget elementor-widget-image"><img width="300" height="300" src="https://rumicol.com/wp-content/uploads/2023/02/contacto-300x300.jpg" alt=""></div>
</section>
<section class="elementor-section elementor-top-section elementor-element" data-id="68d39aa">
  <div class="elementor-widget elementor-widget-image"><a href="#mapa"><img width="1254" height="1179" src="https://rumicol.com/wp-content/uploads/2026/06/Distribiodres-mapa-1.webp" alt=""></a></div>
  <div class="elementor-widget elementor-widget-html"><iframe src="https://www.google.com/maps/d/u/0/embed?mid=abc" width="100%" height="480"></iframe></div>
</section>
</main>
<footer class="site-footer"><p>Rumi</p></footer>
</body></html>`;

  it("arma la portada de rumicol.com: slider con fotos del CSS, carrusel, banners con link, íconos y foto grande", async () => {
    const { extractHomeSections } = await import("@/lib/shopify-theme");
    const sections = extractHomeSections(RUMI, "https://rumicol.com/", `.elementor-45 .elementor-element-e75937c .elementor-repeater-item-1e7fdfe .swiper-slide-bg{background-image:url(https://rumicol.com/wp-content/uploads/2026/01/slide-2.jpg)}`);
    expect(sections).toEqual([
      // La versión de computadora del slider, con la foto de cada slide
      // sacada del CSS (la de celular, escondida en computadora, no cuenta).
      {
        type: "BANNER",
        images: ["https://rumicol.com/wp-content/uploads/2026/01/slide-1.jpg", "https://rumicol.com/wp-content/uploads/2026/01/slide-2.jpg"],
        title: "",
        subtitle: "",
        buttonText: "",
        buttonHref: "",
        // El link de un slide a una página de la tienda vieja queda como
        // /pages/x: se resuelve al importar si esa página también se trajo.
        links: ["/pages/semipermanente", "/collections/colecciones"],
      },
      { type: "FEATURED_PRODUCTS", productHandles: ["linner-metallic-gel", "opal-gel", "diamond-powder"], title: "" },
      // Banners anchos: cada uno con su link; "/colecciones/" a secas no es
      // una categoría sino una página. El botón "LO NUEVO" solo no arma una
      // cuadrícula.
      { type: "BANNER", images: ["https://rumicol.com/wp-content/uploads/2025/10/Lanzamientos-profecioales.jpg"], title: "", subtitle: "", buttonText: "", buttonHref: "", links: ["/collections/herramientas"] },
      { type: "BANNER", images: ["https://rumicol.com/wp-content/uploads/2026/04/Sin-titulo-2.jpg"], title: "", subtitle: "", buttonText: "", buttonHref: "", links: ["/pages/colecciones"] },
      { type: "BANNER", images: ["https://rumicol.com/wp-content/uploads/2025/10/Decoracion-rumi.jpg"], title: "", subtitle: "", buttonText: "", buttonHref: "", links: ["/collections/decoracion"] },
      {
        type: "INFO_COLUMNS",
        items: [
          { title: "Envíos a todo el país", description: "", imageUrl: "https://rumicol.com/wp-content/uploads/2023/02/transporte.jpg", link: "" },
          { title: "", description: "", imageUrl: "https://rumicol.com/wp-content/uploads/2023/02/calidad.jpg", link: "" },
          { title: "", description: "", imageUrl: "https://rumicol.com/wp-content/uploads/2023/02/contacto.jpg", link: "https://wa.link/s2hjcy" },
          { title: "", description: "", imageUrl: "https://rumicol.com/wp-content/uploads/2023/02/pago-seguro-1.jpg", link: "" },
        ],
      },
      // Una ancla ("#mapa") no es un link.
      { type: "BANNER", images: ["https://rumicol.com/wp-content/uploads/2026/06/Distribiodres-mapa-1.webp"], title: "", subtitle: "", buttonText: "", buttonHref: "", links: [""] },
    ]);
  });

  it("una página armada con Elementor queda como contenido limpio: fotos con su URL real, sin menús, tarjetas de producto ni textos de lector de pantalla", async () => {
    const { extractPageContent } = await import("@/lib/shopify-theme");
    const page = `<html><body><header class="site-header"><nav><a href="/x/">Menú</a></nav></header><main id="content">
<h1 class="entry-title">Semipermanentes</h1>
<section class="elementor-section elementor-top-section elementor-hidden-mobile"><div class="elementor-widget elementor-widget-image"><a href="https://rumicol.com/categoria-producto/colecciones/"><img class="lazyload" src="data:image/gif;base64,R0lGOD" data-src="https://rumicol.com/wp-content/uploads/banner-semi.jpg" width="1000" height="400" alt="Colecciones"></a></div></section>
<section class="elementor-section elementor-top-section elementor-hidden-desktop"><img src="https://rumicol.com/wp-content/uploads/banner-semi-300x120.jpg" width="300" height="120" alt=""></section>
<section class="elementor-section"><div class="elementor-widget-text-editor"><h2>Esmaltes semipermanentes</h2><p>Fórmula de larga duración, <strong>hasta 21 días</strong>.</p></div></section>
<div class="woocommerce"><ul class="products columns-4"><li class="product type-product post-1"><a href="https://rumicol.com/producto/rojo/"><img src="https://rumicol.com/wp-content/uploads/rojo.jpg" width="600" height="600" alt="Rojo"><h2>Rojo</h2></a><span class="screen-reader-text">Este producto tiene múltiples variantes.</span><a class="button add_to_cart_button" href="/?add-to-cart=1">Seleccionar opciones</a></li></ul></div>
<form class="wpcf7"><input type="text"><button>Enviar</button></form>
<div class="elementor-widget-video"><iframe src="https://www.youtube.com/embed/abc"></iframe></div>
<footer class="site-footer"><p>pie</p></footer></main></body></html>`;
    const content = extractPageContent(page, "https://rumicol.com/");
    expect(content?.title).toBe("Semipermanentes");
    const body = content!.bodyHtml;
    expect(body).toContain('<img src="https://rumicol.com/wp-content/uploads/banner-semi.jpg" alt="Colecciones">');
    expect(body).toContain("<h2>Esmaltes semipermanentes</h2>");
    expect(body).toContain("<strong>hasta 21 días</strong>");
    expect(body).toContain('<iframe src="https://www.youtube.com/embed/abc">');
    for (const gone of ["banner-semi-300x120", "Seleccionar opciones", "múltiples variantes", "rojo.jpg", "wpcf7", "Menú", "<footer", "<nav"]) {
      expect(body).not.toContain(gone);
    }
  });

  it("la paleta por defecto de Elementor no cuenta como colores de la marca, y la barra superior cuenta como anuncio", async () => {
    const { extractColors, extractAnnouncements } = await import("@/lib/shopify-theme");
    const stock = `<style>.elementor-kit-7{--e-global-color-primary:#6EC1E4;--e-global-color-secondary:#54595F;--e-global-color-text:#7A7A7A;--e-global-color-accent:#61CE70}</style>`;
    expect(extractColors(stock)).toBeNull();
    const custom = `<style>.elementor-kit-7{--e-global-color-primary:#D81B60;--e-global-color-secondary:#54595F;--e-global-color-text:#222222;--e-global-color-accent:#D81B60}</style>`;
    expect(extractColors(custom)).toMatchObject({ botones: "#d81b60" });
    const bar = `<div class="top-bar"><span>Envío gratis desde $150.000</span></div><div class="promo-bar"><p>Contra entrega solo en Medellín</p></div>`;
    expect(extractAnnouncements(bar)).toEqual(["Envío gratis desde $150.000", "Contra entrega solo en Medellín"]);
  });

  it("reconoce ofertas, catálogo, galería, marcas e Instagram", async () => {
    const { extractHomeSections } = await import("@/lib/shopify-theme");
    const many = Array.from({ length: 14 }, (_, i) => `<li class="product"><a href="https://amglow.co/producto/tono-${i}/"><h2>Tono ${i}</h2></a></li>`).join("");
    const html = `<html><body><main>
<div class="wp-block-woocommerce-product-on-sale"><h2>Ofertas de la semana</h2><ul class="wc-block-grid__products"><li class="wc-block-grid__product"><a href="https://amglow.co/producto/top-coat/">Top coat</a></li><li class="wc-block-grid__product"><a href="https://amglow.co/producto/base/">Base</a></li></ul></div>
<section class="catalogo"><h2>Todos los productos</h2><ul class="products">${many}</ul></section>
<figure class="wp-block-gallery"><img src="https://amglow.co/wp-content/uploads/g1.jpg" width="600" height="600"><img src="https://amglow.co/wp-content/uploads/g2.jpg" width="600" height="600"><img src="https://amglow.co/wp-content/uploads/g3.jpg" width="600" height="600"></figure>
<div class="brands-carousel"><a href="https://marca1.com"><img src="https://amglow.co/wp-content/uploads/m1.png" width="200" height="100"></a><img src="https://amglow.co/wp-content/uploads/m2.png" width="200" height="100"><img src="https://amglow.co/wp-content/uploads/m3.png" width="200" height="100"></div>
<section><h2>Síguenos en Instagram</h2><p>@amglow.co</p></section>
</main></body></html>`;
    expect(extractHomeSections(html, "https://amglow.co/")).toEqual([
      { type: "ON_SALE_PRODUCTS", title: "Ofertas de la semana" },
      { type: "PRODUCT_CATALOG", title: "Todos los productos" },
      { type: "IMAGE_CAROUSEL", images: ["https://amglow.co/wp-content/uploads/g1.jpg", "https://amglow.co/wp-content/uploads/g2.jpg", "https://amglow.co/wp-content/uploads/g3.jpg"] },
      {
        type: "BRAND_CAROUSEL",
        items: [
          { imageUrl: "https://amglow.co/wp-content/uploads/m1.png", link: "https://marca1.com/" },
          { imageUrl: "https://amglow.co/wp-content/uploads/m2.png", link: "" },
          { imageUrl: "https://amglow.co/wp-content/uploads/m3.png", link: "" },
        ],
      },
      { type: "INSTAGRAM_CTA", title: "Síguenos en Instagram", description: "" },
    ]);
  });

  // Como amglowspa.com (tema Horizon de Shopify): el esquema de :root es
  // el rosa de la barra de anuncio, pero las secciones de la página usan el
  // esquema 2 (fondo blanco, texto y botones rosa).
  const HORIZON = `<html><head><style>:root, .color-scheme-1 { --color-background: rgb(253 86 206 / 0.92); --color-foreground: rgb(255 255 255 / 1.0); --color-primary: rgb(0 0 0 / 0.81); --color-primary-button-background: rgb(253 86 206 / 0.5); }
.color-scheme-2 { --color-background: rgb(255 255 255 / 1.0); --color-foreground: rgb(253 86 206 / 1.0); --color-primary: rgb(253 86 206 / 0.88); --color-primary-button-background: rgb(253 86 206 / 0.92); }
.color-scheme-3 { --color-background: rgb(51 51 51 / 1.0); --color-foreground: rgb(255 255 255 / 1.0); }
body, .color-scheme-1, .color-scheme-2, .color-scheme-3 { color: var(--color-foreground); background-color: var(--color-background); }</style></head>
<body class="page-width-normal">
<div id="shopify-section-sections--1__announcement-bar_x" class="shopify-section shopify-section-group-header-group"><div class="section-background color-scheme-1"><div class="announcement-bar"><div class="announcement-bar__slides"><p class="announcement-bar__message">ENVIO GRATIS POR COMPRAS SUPERIORES A $ 150.000</p></div></div></div></div>
<div id="shopify-section-sections--1__header" class="shopify-section header-section"><header><div class="header__row color-scheme-2"><nav><a href="/collections/hidratacion">Hidratación</a></nav></div></header></div>
<main id="MainContent">
<div id="shopify-section-template--1__hero_abc" class="shopify-section hero-wrapper"><div class="hero color-scheme-2"><a class="hero__link" href="/collections/all"><img src="//www.amglowspa.com/cdn/shop/files/WEB_2.png?width=3840" width="3840" height="1280"></a></div></div>
<div id="shopify-section-template--1__product_list_def" class="shopify-section ui-test-product-list"><div class="section-background color-scheme-2"><div class="section color-scheme-2"><h2>Productos</h2><a href="/collections/all">Ver todo</a><ul><li><a href="/products/aceite-de-cuticula-almendra">Aceite</a></li><li><a href="/products/aceite-de-cuticula-chocolate">Aceite 2</a></li></ul></div></div></div>
<div id="shopify-section-template--1__marquee_ghi" class="shopify-section"><div class="section-background color-scheme-1"><div class="marquee__wrapper"><p class="text-block">10% de descuento en tu primera compra</p></div></div></div>
<div id="shopify-section-template--1__logo_list_jkl" class="shopify-section"><div class="section color-scheme-2"><a href="https://marca1.com"><img src="//www.amglowspa.com/cdn/shop/files/m1.png"></a><img src="//www.amglowspa.com/cdn/shop/files/m2.png"><img src="//www.amglowspa.com/cdn/shop/files/m3.png"></div></div>
<div id="shopify-section-template--1__gallery_mno" class="shopify-section"><div class="section color-scheme-2"><img src="//www.amglowspa.com/cdn/shop/files/g1.jpg"><img src="//www.amglowspa.com/cdn/shop/files/g2.jpg"></div></div>
</main>
<div id="shopify-section-sections--1__footer" class="shopify-section shopify-section-group-footer-group"><footer class="color-scheme-3"><p>pie</p></footer></div>
</body></html>`;

  it("en Horizon toma el esquema de las secciones (fondo blanco, rosa en texto y botones) y la barra de anuncio como secundario", async () => {
    const { parseShopifyStorefront } = await import("@/lib/shopify-theme");
    const theme = parseShopifyStorefront(HORIZON, "https://www.amglowspa.com/");
    expect(theme.colors).toEqual({ fondo: "#ffffff", texto: "#fd56ce", botones: "#fd56ce", principal: "#fd56ce", secundario: "#fd56ce" });
    expect(theme.announcements).toEqual(["ENVIO GRATIS POR COMPRAS SUPERIORES A $ 150.000", "10% de descuento en tu primera compra"]);
    expect(theme.homeSections).toEqual([
      { type: "BANNER", images: ["https://www.amglowspa.com/cdn/shop/files/WEB_2.png?width=3840"], title: "", subtitle: "", buttonText: "", buttonHref: "" },
      // "Ver todo" a /collections/all: la lista se arma sola acá.
      { type: "NEW_PRODUCTS", title: "Productos" },
      {
        type: "BRAND_CAROUSEL",
        items: [
          { imageUrl: "https://www.amglowspa.com/cdn/shop/files/m1.png", link: "https://marca1.com/" },
          { imageUrl: "https://www.amglowspa.com/cdn/shop/files/m2.png", link: "" },
          { imageUrl: "https://www.amglowspa.com/cdn/shop/files/m3.png", link: "" },
        ],
      },
      { type: "IMAGE_CAROUSEL", images: ["https://www.amglowspa.com/cdn/shop/files/g1.jpg", "https://www.amglowspa.com/cdn/shop/files/g2.jpg"] },
    ]);
  });

  it("una portada vacía o solo con menú y pie no inventa secciones", async () => {
    const { extractHomeSections } = await import("@/lib/shopify-theme");
    expect(extractHomeSections("<html><body><header><nav><a href='/product-category/x/'>X</a><a href='/product-category/y/'>Y</a></nav></header><main></main><footer><h2>Síguenos</h2><p>Instagram y TikTok, todos los días con novedades y descuentos para ti.</p></footer></body></html>", "https://rumicol.com")).toEqual([]);
    expect(extractHomeSections("", "https://rumicol.com")).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// Menú con submenús (el mega menú de Rumi). Ver conversación del 2026-10-18.
// ----------------------------------------------------------------------------

const RUMI_BASE = "https://rumicol.com";

const ELEMENTOR_NAV = `<!doctype html><html><body>
<header data-elementor-type="header" class="elementor elementor-5">
<div class="elementor-element elementor-widget-nav-menu">
<nav class="elementor-nav-menu--main elementor-nav-menu__container elementor-nav-menu--layout-horizontal e--pointer-underline">
<ul id="menu-1-abc" class="elementor-nav-menu">
<li class="menu-item menu-item-type-custom menu-item-home"><a href="https://rumicol.com/" class="elementor-item">HOME</a></li>
<li class="menu-item menu-item-has-children"><a href="#" class="elementor-item elementor-item-anchor">NUESTROS PRODUCTOS</a>
<ul class="sub-menu elementor-nav-menu--dropdown">
<li class="menu-item"><a href="https://rumicol.com/semipermanente/" class="elementor-sub-item">Semipermanentes</a></li>
<li class="menu-item menu-item-has-children"><a href="https://rumicol.com/categoria-producto/colecciones/" class="elementor-sub-item">Colecciones</a>
<ul class="sub-menu">
<li class="menu-item"><a href="https://rumicol.com/producto/coleccion-capsula/" class="elementor-sub-item">Colección cápsula</a></li>
<li class="menu-item"><a href="https://rumicol.com/producto/coleccion-nude/" class="elementor-sub-item">Colección nude</a></li>
</ul>
</li>
<li class="menu-item menu-item-has-children"><a href="https://rumicol.com/categoria-producto/decoracion/" class="elementor-sub-item">Decoración</a>
<ul class="sub-menu">
<li class="menu-item menu-item-has-children"><a href="https://rumicol.com/categoria-producto/decoracion/glitter-gel/" class="elementor-sub-item">Glitter gel</a>
<ul class="sub-menu"><li class="menu-item"><a href="https://rumicol.com/producto/glitter-rosa/">Glitter rosa (cuarto nivel)</a></li></ul>
</li>
</ul>
</li>
</ul>
</li>
<li class="menu-item"><a href="https://rumicol.com/lo-nuevo/" class="elementor-item">LO NUEVO</a></li>
<li class="menu-item"><a href="#" class="elementor-item">VACÍO</a></li>
<li class="menu-item"><a href="#contacto" class="elementor-item">Ancla</a></li>
<li class="menu-item"><a href="https://rumicol.com/cart/" class="elementor-item">Carrito</a></li>
</ul>
</nav>
<nav class="elementor-nav-menu--dropdown elementor-nav-menu__container" aria-hidden="true">
<ul id="menu-2-abc" class="elementor-nav-menu">
<li class="menu-item"><a href="https://rumicol.com/" class="elementor-item" tabindex="-1">HOME</a></li>
<li class="menu-item menu-item-has-children"><a href="#" class="elementor-item" tabindex="-1">NUESTROS PRODUCTOS</a>
<ul class="sub-menu"><li class="menu-item"><a href="https://rumicol.com/semipermanente/" tabindex="-1">Semipermanentes</a></li></ul>
</li>
</ul>
</nav>
</div>
<div class="elementor-widget-button"><a class="elementor-button elementor-button-link elementor-size-xs" href="https://rumicol.com/categoria-producto/colecciones-solas/"><span class="elementor-button-text">DESCUENTOS</span></a></div>
<div class="elementor-hidden-desktop"><a class="elementor-button" href="https://rumicol.com/categoria-producto/colecciones-solas/"><span>DESCUENTOS</span></a></div>
<a class="elementor-button" href="https://wa.me/573001234567">WhatsApp</a>
<a class="elementor-button" href="https://rumicol.com/cart/">Carrito</a>
</header>
<main><p>portada</p></main>
</body></html>`;

const DAWN_MEGA = `<!doctype html><html><body>
<header class="header">
<nav class="header__inline-menu">
<ul class="list-menu list-menu--inline" role="list">
<li><a id="HeaderMenu-inicio" href="/" class="header__menu-item"><span>Inicio</span></a></li>
<li>
<header-menu><details id="Details-HeaderMenu-2" class="mega-menu">
<summary id="HeaderMenu-tienda" class="header__menu-item list-menu__item link focus-inset"><span>Tienda</span><svg class="icon icon-caret" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4"/></svg></summary>
<div id="MegaMenu-Content-2" class="mega-menu__content">
<ul class="mega-menu__list page-width" role="list">
<li><a id="HeaderMenu-tienda-esmaltes" href="/collections/esmaltes" class="mega-menu__link mega-menu__link--level-2 link">Esmaltes</a>
<ul class="list-unstyled" role="list">
<li><a href="/collections/esmaltes-gel" class="mega-menu__link link">Gel</a></li>
<li><a href="/collections/esmaltes-tradicional" class="mega-menu__link link">Tradicional</a></li>
</ul>
</li>
<li><a href="/collections/herramientas" class="mega-menu__link mega-menu__link--level-2 link">Herramientas</a></li>
</ul>
</div>
</details></header-menu>
</li>
<li><a href="/collections/marcas" class="header__menu-item">Marcas</a>
<div class="columns">
<ul><li><a href="/collections/marca-a">Marca A</a></li></ul>
<ul><li><a href="/collections/marca-b">Marca B</a></li><li><a href="/collections/marca-a">Marca A otra vez</a></li></ul>
</div>
</li>
<li><a href="/pages/contacto" class="header__menu-item"><span>Contacto</span></a></li>
</ul>
</nav>
</header>
</body></html>`;

const HORIZON_NAV = `<html><body><header class="header">
<nav class="menu__nav"><ul class="menu__list">
<li class="menu__item"><details class="menu__details"><summary class="menu__summary"><a href="/collections/all" class="menu__link">Tienda</a><span class="menu__chevron"></span></summary>
<div class="menu__panel"><ul class="menu__sublist"><li><a href="/collections/kits">Kits</a></li></ul></div></details></li>
<li class="menu__item"><a href="/pages/nosotros">Nosotros</a></li>
</ul></nav>
</header></body></html>`;

describe("menú con submenús", () => {
  it("lee los tres niveles del menú de Elementor; el padre sin link queda como '#'", () => {
    expect(extractMenu(ELEMENTOR_NAV, RUMI_BASE)).toEqual([
      { label: "HOME", href: "/" },
      {
        label: "NUESTROS PRODUCTOS",
        href: "#",
        children: [
          { label: "Semipermanentes", href: "/semipermanente" },
          {
            label: "Colecciones",
            href: "/categoria-producto/colecciones",
            children: [
              { label: "Colección cápsula", href: "/producto/coleccion-capsula" },
              { label: "Colección nude", href: "/producto/coleccion-nude" },
            ],
          },
          {
            label: "Decoración",
            href: "/categoria-producto/decoracion",
            // El cuarto nivel (Glitter rosa) se descarta.
            children: [{ label: "Glitter gel", href: "/categoria-producto/decoracion/glitter-gel" }],
          },
        ],
      },
      { label: "LO NUEVO", href: "/lo-nuevo" },
      // El botón del encabezado por fuera del menú, una sola vez.
      { label: "DESCUENTOS", href: "/categoria-producto/colecciones-solas" },
    ]);
  });

  it("lee el mega menú de Dawn (<details>/<summary>) y junta las columnas de un mismo padre sin repetidos", () => {
    expect(extractMenu(DAWN_MEGA, BASE)).toEqual([
      { label: "Inicio", href: "/" },
      {
        label: "Tienda",
        href: "#",
        children: [
          {
            label: "Esmaltes",
            href: "/collections/esmaltes",
            children: [
              { label: "Gel", href: "/collections/esmaltes-gel" },
              { label: "Tradicional", href: "/collections/esmaltes-tradicional" },
            ],
          },
          { label: "Herramientas", href: "/collections/herramientas" },
        ],
      },
      {
        label: "Marcas",
        href: "/collections/marcas",
        children: [
          { label: "Marca A", href: "/collections/marca-a" },
          { label: "Marca B", href: "/collections/marca-b" },
        ],
      },
      { label: "Contacto", href: "/pages/contacto" },
    ]);
  });

  it("un <summary> con link adentro (Horizon) es un padre con link propio", () => {
    expect(extractMenu(HORIZON_NAV, BASE)).toEqual([
      { label: "Tienda", href: "/collections/all", children: [{ label: "Kits", href: "/collections/kits" }] },
      { label: "Nosotros", href: "/pages/nosotros" },
    ]);
  });

  it("traduce '#' como ítem sin link", () => {
    const maps = { collectionSlugByHandle: new Map<string, string>(), productSlugByHandle: new Map<string, string>() };
    expect(mapShopifyMenuHref("#", maps)).toBe("#");
    expect(mapShopifyMenuHref("", maps)).toBe("#");
  });
});
