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
