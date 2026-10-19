import { describe, expect, it } from "vitest";
import { buildHomeOutline, extractColors, type HomeOutline, type HomeOutlineItem } from "@/lib/shopify-theme";
import { homeCopyResponseSchema, homeCopyToSections, outlineForPrompt, type HomeCopyResponse } from "@/lib/home-copy";
import { buildGoogleFontsUrl, fontStack, parseThemeConfig } from "@/lib/brand-theme";

const BASE = "https://www.joyas.co/";

/// Portada al estilo Dawn: encabezado y barra de anuncio (no cuentan),
/// slideshow sobre un esquema oscuro, colección destacada con tarjetas de
/// producto, lista de colecciones, columnas con íconos, texto con botón,
/// testimonios, preguntas frecuentes y el boletín (no se copia).
const DAWN_HOME = `<!doctype html><html><head><style>
body, .color-scheme-1 { --color-background: 255,255,255; --color-foreground: 18,18,18; }
.color-scheme-2 { --color-background: 18,18,18; --color-foreground: 255,255,255; }
.color-scheme-3 { --color-background: 243,233,226; --color-foreground: 60,40,30; }
</style></head><body>
<div id="shopify-section-sections--1__announcement-bar" class="shopify-section"><p>Envío gratis</p></div>
<div id="shopify-section-sections--1__header" class="shopify-section"><header><a href="/collections/anillos">Anillos</a></header></div>
<main>
<section id="shopify-section-template--9__slideshow" class="shopify-section">
  <div class="slideshow color-scheme-2">
    <div class="slideshow__slide">
      <img src="//www.joyas.co/cdn/shop/files/hero1.jpg?v=1&width=1920" width="1920" height="800" alt="Anillos de oro">
      <h2 class="banner__heading">Nueva colección</h2>
      <div class="banner__text rte"><p>Hecha a mano en Bogotá</p></div>
      <a class="button button--primary" href="/collections/anillos">Comprar ahora</a>
    </div>
    <div class="slideshow__slide">
      <img src="//www.joyas.co/cdn/shop/files/hero2.jpg?v=1&width=1920" width="1920" height="800" alt="">
      <span class="visually-hidden">Diapositiva 2 de 2</span>
    </div>
    <div class="slick-cloned"><img src="//www.joyas.co/cdn/shop/files/hero1-copia.jpg" width="1920" height="800"></div>
  </div>
</section>
<section id="shopify-section-template--9__featured_collection" class="shopify-section">
  <div class="color-scheme-1 gradient"><h2>Lo más vendido</h2></div>
  <ul>
    <li class="grid__item"><div class="card-wrapper product-card-wrapper">
      <img src="//www.joyas.co/cdn/shop/products/a.jpg" width="600" height="600">
      <h3><a href="/products/anillo-sol">Anillo Sol</a></h3>
      <span class="price">$120.000</span>
    </div></li>
    <li class="grid__item"><div class="card-wrapper product-card-wrapper">
      <h3><a href="/collections/anillos/products/anillo-luna">Anillo Luna</a></h3>
      <span class="visually-hidden">Precio habitual</span><span class="price">$98.000</span>
    </div></li>
  </ul>
  <a href="/collections/anillos" class="button">Ver todo</a>
</section>
<section id="shopify-section-template--9__collection_list" class="shopify-section">
  <div class="collection-list-wrapper color-scheme-1"><h2>Compra por categoría</h2></div>
  <div class="card-wrapper collection-card-wrapper"><a href="/collections/anillos"><img src="//www.joyas.co/cdn/shop/collections/anillos.jpg" width="500" height="500" alt="Anillos"><h3>Anillos</h3></a></div>
  <div class="card-wrapper collection-card-wrapper"><a href="/collections/aretes"><img src="//www.joyas.co/cdn/shop/collections/aretes.jpg" width="500" height="500"><h3>Aretes</h3></a></div>
</section>
<section id="shopify-section-template--9__multicolumn_abc123" class="shopify-section color-scheme-1">
  <div class="multicolumn-card"><img src="//www.joyas.co/cdn/shop/files/envio.png" width="60" height="60"><h3>Envíos a todo el país</h3><p>Llega en 3 días</p></div>
  <div class="multicolumn-card"><img src="//www.joyas.co/cdn/shop/files/garantia.png" width="60" height="60"><h3>Garantía de por vida</h3><p>Te lo cambiamos</p></div>
</section>
<section id="shopify-section-template--9__rich_text" class="shopify-section">
  <div class="rich-text color-scheme-3">
    <h2>Nuestra historia</h2>
    <p>Somos un taller familiar.<br>Desde 1998.</p>
    <a href="/pages/nosotros" class="button">Conócenos</a>
  </div>
</section>
<section id="shopify-section-template--9__testimonials" class="shopify-section color-scheme-1">
  <h2>Lo que dicen</h2>
  <blockquote>Me encantó el anillo</blockquote><cite>Ana, Medellín</cite>
  <blockquote>Llegó rapidísimo</blockquote><cite>Luisa</cite>
</section>
<section id="shopify-section-template--9__faq" class="shopify-section">
  <details><summary>¿Hacen envíos?</summary><div><p>Sí, a todo Colombia.</p></div></details>
</section>
<section id="shopify-section-template--9__newsletter" class="shopify-section"><h2>Suscríbete</h2><form><input name="email"></form></section>
</main>
<div id="shopify-section-sections--1__footer" class="shopify-section"><footer><p>© Joyas</p></footer></div>
</body></html>`;

function byKind(outline: HomeOutline, kind: HomeOutlineItem["kind"]) {
  return outline.items.filter((i) => i.kind === kind);
}

function find(outline: HomeOutline, test: (item: HomeOutlineItem) => boolean) {
  const item = outline.items.find(test);
  if (!item) throw new Error("no está en el esquema");
  return item;
}

describe("esquema de la portada para la copia fiel", () => {
  const outline = buildHomeOutline(DAWN_HOME, BASE);

  it("deja los bloques del contenido en orden, sin encabezado, anuncio, pie ni boletín, y con sus colores", () => {
    expect(byKind(outline, "section").map((s) => (s.kind === "section" ? s.hint : ""))).toEqual([
      "slideshow",
      "featured collection",
      "collection list",
      "multicolumn",
      "rich text",
      "testimonials",
      "faq",
    ]);
    const sections = byKind(outline, "section") as Extract<HomeOutlineItem, { kind: "section" }>[];
    expect(sections[0]).toMatchObject({ background: "#121212", textColor: "#ffffff" });
    expect(sections[1]).toMatchObject({ background: null, textColor: null });
    expect(sections[4]).toMatchObject({ background: "#f3e9e2", textColor: "#3c281e" });
    expect(outline.truncated).toBe(false);
  });

  it("trae los textos tal cual, los botones con su link y las fotos sin copias de carrusel", () => {
    expect(find(outline, (i) => i.kind === "heading" && i.text === "Nueva colección")).toMatchObject({ level: 2, href: "" });
    expect(find(outline, (i) => i.kind === "text" && i.text === "Hecha a mano en Bogotá")).toBeTruthy();
    expect(find(outline, (i) => i.kind === "link" && i.text === "Comprar ahora")).toMatchObject({ href: "/collections/anillos" });
    expect(find(outline, (i) => i.kind === "text" && i.text.startsWith("Somos"))).toMatchObject({ text: "Somos un taller familiar.\nDesde 1998." });
    expect(find(outline, (i) => i.kind === "link" && i.text === "Conócenos")).toMatchObject({ href: "/pages/nosotros" });
    const images = byKind(outline, "image").map((i) => (i.kind === "image" ? i.url : ""));
    expect(images).toContain("https://www.joyas.co/cdn/shop/files/hero1.jpg?v=1&width=1920");
    expect(images.some((u) => u.includes("hero1-copia"))).toBe(false);
    expect(find(outline, (i) => i.kind === "image" && i.url.includes("hero1"))).toMatchObject({ shape: "ancha", alt: "Anillos de oro" });
    expect(find(outline, (i) => i.kind === "image" && i.url.includes("envio.png"))).toMatchObject({ shape: "pequeña" });
  });

  it("las tarjetas de producto quedan como la lista de productos, sin nombres, precios ni textos ocultos", () => {
    expect(byKind(outline, "products")).toEqual([expect.objectContaining({ handles: ["anillo-sol", "anillo-luna"] })]);
    const texts = outline.items.flatMap((i) => ("text" in i ? [i.text] : []));
    for (const noise of ["Anillo Sol", "$120.000", "Precio habitual", "Diapositiva 2 de 2", "Suscríbete", "Envío gratis", "© Joyas"]) {
      expect(texts).not.toContain(noise);
    }
  });

  it("una categoría con foto y nombre dentro del link lleva el link en los dos", () => {
    expect(find(outline, (i) => i.kind === "image" && i.url.includes("aretes.jpg"))).toMatchObject({ href: "/collections/aretes" });
    expect(find(outline, (i) => i.kind === "heading" && i.text === "Aretes")).toMatchObject({ href: "/collections/aretes" });
  });

  it("testimonios y preguntas frecuentes quedan como textos sueltos, en orden", () => {
    const texts = outline.items.flatMap((i) => (i.kind === "text" ? [i.text] : []));
    expect(texts).toEqual(expect.arrayContaining(["Me encantó el anillo", "Ana, Medellín", "Llegó rapidísimo", "Luisa", "¿Hacen envíos?", "Sí, a todo Colombia."]));
    expect(texts.indexOf("Me encantó el anillo")).toBeLessThan(texts.indexOf("Ana, Medellín"));
  });

  it("para la IA va una línea por elemento con su id, sin las URLs de las fotos", () => {
    const prompt = outlineForPrompt(outline);
    expect(prompt).toContain("BLOQUE «slideshow» (fondo #121212)");
    expect(prompt).toMatch(/L\d+ botón «Comprar ahora» → \/collections\/anillos/);
    expect(prompt).toMatch(/P\d+ productos: 2 \(anillo-sol, anillo-luna\)/);
    expect(prompt).not.toContain("cdn/shop");
  });

  it("tarjetas que dicen lo mismo pero llevan a lugares distintos van todas; un producto destacado queda solo como su producto", () => {
    const html = `<html><body><main>
      <div id="shopify-section-template--1__collection_list" class="shopify-section">
        <div class="card"><img src="//cdn.shopify.com/a.jpg" width="500" height="500"><h3><a href="/collections/acrysoft">COMPRA AQUI</a></h3></div>
        <div class="card"><img src="//cdn.shopify.com/b.jpg" width="500" height="500"><h3><a href="/collections/builder-gel">COMPRA AQUI</a></h3></div>
        <div class="card"><h3><a href="/collections/builder-gel">COMPRA AQUI</a></h3></div>
      </div>
      <div id="shopify-section-template--1__video_carousel" class="shopify-section">
        <a href="/collections/builder-gel">SMART BUILDER GEL</a><a href="/collections/builder-gel">29.750</a>
      </div>
      <div id="shopify-section-template--1__featured_product" class="shopify-section">
        <a class="skip-to-content-link button visually-hidden" href="#ProductInfo">Ir directamente a la información del producto</a>
        <media-gallery><img src="//cdn.shopify.com/p1.jpg" width="600" height="900"><img src="//cdn.shopify.com/p2.jpg" width="600" height="900"></media-gallery>
        <h2>Bases para Frances | 12 ml</h2><p>Oferta / Agotado</p><p>Impuesto incluido.</p><span>REF:#247</span>
        <a href="/products/bases-para-frances">Ver todos los detalles</a>
      </div>
    </main></body></html>`;
    const shop = buildHomeOutline(html, "https://www.beautysolutionshop.com/");
    const prompt = outlineForPrompt(shop);
    expect(byKind(shop, "heading").map((h) => (h.kind === "heading" ? h.href : ""))).toEqual(["/collections/acrysoft", "/collections/builder-gel"]);
    expect(prompt).toContain("SMART BUILDER GEL");
    expect(prompt).not.toContain("29.750");
    expect(prompt).not.toContain("Ir directamente");
    expect(shop.items.slice(-2)).toEqual([
      expect.objectContaining({ kind: "section", hint: "featured product" }),
      expect.objectContaining({ kind: "products", handles: ["bases-para-frances"] }),
    ]);
  });

  it("dos barras angostas en rojo no vuelven roja la página; la barra sí queda con su rojo (Beauty Solution)", () => {
    const filler = "<p>texto</p>".repeat(400);
    const html = `<html><head><style>:root, .color-scheme-1 { --color-background: 255,255,255; --color-foreground: 0,0,0; }
      .color-scheme-4 { --color-background: 254,0,0; --color-foreground: 255,255,255; }</style></head><body class="gradient"><main>
      <section id="shopify-section-template--1__slideshow" class="shopify-section">${filler}<div class="banner color-scheme-1"><h2>Nueva</h2></div></section>
      <section id="shopify-section-template--1__scrolling_bar_Ck73kh" class="shopify-section"><div class="marquee color-scheme-4"><p>SOMOS LA MARCA #1</p></div></section>
      <section id="shopify-section-template--1__collection_list" class="shopify-section">${filler}<div class="color-scheme-1"></div></section>
      <section id="shopify-section-template--1__scrolling_bar_ECLNdp" class="shopify-section"><div class="marquee color-scheme-4"><p>DESCUENTOS</p></div></section>
    </main></body></html>`;
    expect(extractColors(html)).toMatchObject({ fondo: "#ffffff", texto: "#000000" });
    const bars = byKind(buildHomeOutline(html, BASE), "section").filter((s) => s.kind === "section" && s.hint === "scrolling bar");
    expect(bars).toEqual([
      expect.objectContaining({ background: "#fe0000", textColor: "#ffffff" }),
      expect.objectContaining({ background: "#fe0000", textColor: "#ffffff" }),
    ]);
  });

  it("en Elementor separa por sus secciones y lee el fondo de cada una en su CSS", () => {
    const html = `<html><body><main>
      <section class="elementor-section elementor-top-section elementor-element elementor-element-a1b2c3d"><h2 class="elementor-heading-title">Hola</h2></section>
      <section class="elementor-section elementor-top-section elementor-element elementor-element-e4f5a6b"><p>Chao</p></section>
    </main></body></html>`;
    const css = `.elementor-7 .elementor-element.elementor-element-a1b2c3d:not(.elementor-motion-effects-element-type-background){background-color:#F7EDE7;}
      .elementor-7 .elementor-element.elementor-element-a1b2c3d .elementor-heading-title{color:#333}`;
    const elementor = buildHomeOutline(html, "https://rumicol.com/", css);
    expect(byKind(elementor, "section")).toEqual([
      expect.objectContaining({ background: "#f7ede7", textColor: null }),
      expect.objectContaining({ background: null }),
    ]);
    expect(byKind(elementor, "heading")).toEqual([expect.objectContaining({ text: "Hola" })]);
  });
});

describe("copia fiel: de la respuesta de la IA a las secciones", () => {
  const outline = buildHomeOutline(DAWN_HOME, BASE);
  const id = (test: (item: HomeOutlineItem) => boolean) => find(outline, test).id;
  const empty = { layout: "" as const, name: "", title: "", text: [], button: "", images: [], products: "", video: "", items: [] };
  const heading = (text: string) => id((i) => i.kind === "heading" && i.text === text);
  const text = (value: string) => id((i) => i.kind === "text" && i.text === value);
  const image = (part: string) => id((i) => i.kind === "image" && i.url.includes(part));
  const link = (value: string) => id((i) => i.kind === "link" && i.text === value);

  const plan: HomeCopyResponse = {
    // A propósito en otro orden: se ordenan como en la página original.
    sections: [
      {
        ...empty,
        type: "CUSTOM_BLOCK",
        layout: "quotes",
        name: "Testimonios",
        title: heading("Lo que dicen"),
        items: [
          { image: "", title: text("Ana, Medellín"), text: [text("Me encantó el anillo")], link: "" },
          { image: "", title: text("Luisa"), text: [text("Llegó rapidísimo")], link: "" },
        ],
      },
      {
        ...empty,
        type: "BANNER",
        title: heading("Nueva colección"),
        text: [text("Hecha a mano en Bogotá")],
        button: link("Comprar ahora"),
        images: [image("hero1.jpg"), image("hero2.jpg")],
      },
      { ...empty, type: "FEATURED_COLLECTION", title: heading("Lo más vendido"), button: link("Ver todo"), products: id((i) => i.kind === "products") },
      {
        ...empty,
        type: "CATEGORY_GRID",
        title: heading("Compra por categoría"),
        items: [
          { image: image("anillos.jpg"), title: heading("Anillos"), text: [], link: "" },
          { image: image("aretes.jpg"), title: heading("Aretes"), text: [], link: "" },
        ],
      },
      {
        ...empty,
        type: "INFO_COLUMNS",
        items: [
          { image: image("envio.png"), title: heading("Envíos a todo el país"), text: [text("Llega en 3 días")], link: "" },
          { image: image("garantia.png"), title: heading("Garantía de por vida"), text: [text("Te lo cambiamos")], link: "" },
        ],
      },
      { ...empty, type: "TEXT", title: heading("Nuestra historia"), text: [id((i) => i.kind === "text" && i.text.startsWith("Somos"))], button: link("Conócenos") },
      { ...empty, type: "CUSTOM_BLOCK", layout: "accordion", name: "Preguntas", items: [{ image: "", title: text("¿Hacen envíos?"), text: [text("Sí, a todo Colombia.")], link: "" }] },
      // Ids que no existen, del tipo equivocado o ya usados: no salen.
      { ...empty, type: "VIDEO", video: "V999" },
      { ...empty, type: "TEXT", title: heading("Nueva colección") },
      { ...empty, type: "BANNER", images: [heading("Lo más vendido")] },
    ],
  };

  it("valida la respuesta contra su esquema", () => {
    expect(homeCopyResponseSchema.safeParse(plan).success).toBe(true);
    expect(homeCopyResponseSchema.safeParse({ sections: [{ ...empty, type: "INVENTADA" }] }).success).toBe(false);
  });

  it("arma cada sección con los textos, fotos y links de la original, en su orden", () => {
    const sections = homeCopyToSections(outline, plan);
    expect(sections.map((s) => s.type)).toEqual(["BANNER", "FEATURED_COLLECTION", "CATEGORY_GRID", "INFO_COLUMNS", "CUSTOM_BLOCK", "CUSTOM_BLOCK", "CUSTOM_BLOCK"]);
    expect(sections[0]).toEqual({
      type: "BANNER",
      images: ["https://www.joyas.co/cdn/shop/files/hero1.jpg?v=1&width=1920", "https://www.joyas.co/cdn/shop/files/hero2.jpg?v=1&width=1920"],
      links: ["", ""],
      title: "Nueva colección",
      subtitle: "Hecha a mano en Bogotá",
      buttonText: "Comprar ahora",
      buttonHref: "/collections/anillos",
    });
    expect(sections[1]).toEqual({ type: "FEATURED_COLLECTION", collectionHandle: "anillos", title: "Lo más vendido" });
    expect(sections[2]).toEqual({
      type: "CATEGORY_GRID",
      title: "Compra por categoría",
      subtitle: "",
      items: [
        { collectionHandle: "anillos", imageUrl: "https://www.joyas.co/cdn/shop/collections/anillos.jpg", label: "Anillos" },
        { collectionHandle: "aretes", imageUrl: "https://www.joyas.co/cdn/shop/collections/aretes.jpg", label: "Aretes" },
      ],
    });
    expect(sections[3]).toMatchObject({
      type: "INFO_COLUMNS",
      items: [
        { title: "Envíos a todo el país", description: "Llega en 3 días", imageUrl: "https://www.joyas.co/cdn/shop/files/envio.png" },
        { title: "Garantía de por vida", description: "Te lo cambiamos" },
      ],
    });
  });

  it("un texto con botón sobre un color queda como bloque personalizado con ese color", () => {
    const story = homeCopyToSections(outline, plan)[4];
    expect(story).toMatchObject({
      type: "CUSTOM_BLOCK",
      layout: "text",
      title: "Nuestra historia",
      text: "Somos un taller familiar.\nDesde 1998.",
      buttonText: "Conócenos",
      buttonHref: "/pages/nosotros",
      background: "#f3e9e2",
      textColor: "#3c281e",
    });
  });

  it("testimonios y preguntas frecuentes son bloques personalizados que la marca edita", () => {
    const [, , , , , quotes, faq] = homeCopyToSections(outline, plan);
    expect(quotes).toMatchObject({
      type: "CUSTOM_BLOCK",
      layout: "quotes",
      name: "Testimonios",
      title: "Lo que dicen",
      items: [
        { title: "Ana, Medellín", text: "Me encantó el anillo", imageUrl: null },
        { title: "Luisa", text: "Llegó rapidísimo" },
      ],
    });
    expect(faq).toMatchObject({ type: "CUSTOM_BLOCK", layout: "accordion", items: [{ title: "¿Hacen envíos?", text: "Sí, a todo Colombia." }] });
  });

  it("si una 'categoría' lleva a otra parte, o hay fotos con links en una galería, no se pierde nada", () => {
    const sections = homeCopyToSections(outline, {
      sections: [
        {
          ...empty,
          type: "CATEGORY_GRID",
          title: heading("Compra por categoría"),
          items: [
            { image: image("anillos.jpg"), title: heading("Anillos"), text: [], link: "" },
            { image: image("hero2.jpg"), title: text("Hecha a mano en Bogotá"), text: [], link: link("Conócenos") },
          ],
        },
        { ...empty, type: "IMAGE_CAROUSEL", images: [image("aretes.jpg")] },
        { ...empty, type: "CATEGORY_BANNERS", title: heading("Lo que dicen"), items: [{ image: image("envio.png"), title: "", text: [], link: link("Ver todo") }] },
      ],
    });
    expect(sections[0]).toMatchObject({
      type: "CUSTOM_BLOCK",
      layout: "cards",
      title: "Compra por categoría",
      items: [
        { title: "Anillos", link: "/collections/anillos" },
        { title: "Hecha a mano en Bogotá", link: "/pages/nosotros", buttonText: "Conócenos" },
      ],
    });
    // La foto de la galería tenía link: banner sin texto, con su link.
    expect(sections.find((s) => s.type === "BANNER")).toMatchObject({ images: ["https://www.joyas.co/cdn/shop/collections/aretes.jpg"], links: ["/collections/aretes"] });
    // Los banners de categoría no muestran título: va en un texto justo antes.
    const at = sections.findIndex((s) => s.type === "CATEGORY_BANNERS");
    expect(sections[at - 1]).toEqual({ type: "TEXT", heading: "Lo que dicen", body: "" });
  });

  it("sin nada citable no sale ninguna sección", () => {
    expect(homeCopyToSections(outline, { sections: [{ ...empty, type: "NEW_PRODUCTS" }, { ...empty, type: "CUSTOM_BLOCK", layout: "cards" }] })).toEqual([]);
  });
});

describe("letra exacta de la tienda original", () => {
  it("una familia de Google Fonts fuera del catálogo se carga por la API clásica y con su respaldo", () => {
    expect(buildGoogleFontsUrl(["Montserrat", "Karla"])).toBe("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap");
    expect(buildGoogleFontsUrl(["Cormorant Garamond", "Montserrat"])).toBe(
      "https://fonts.googleapis.com/css?family=Montserrat:400,500,600,700|Cormorant+Garamond:400,500,600,700&display=swap",
    );
    expect(fontStack("Cormorant Garamond")).toBe("'Cormorant Garamond', Georgia, serif");
    expect(fontStack("Jost")).toBe("'Jost', -apple-system, sans-serif");
    expect(fontStack("Mala'); body{")).toBe("'Instrument Sans', -apple-system, sans-serif");
  });

  it("el tema guarda una familia con nombre seguro y descarta lo demás", () => {
    expect(parseThemeConfig({ typography: { headingFont: "Jost", bodyFont: "Karla" } }).typography).toEqual({ headingFont: "Jost", bodyFont: "Karla" });
    expect(() => parseThemeConfig({ typography: { headingFont: "x'); }", bodyFont: "Karla" } })).toThrow();
  });
});
