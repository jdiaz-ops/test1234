import { describe, expect, it } from "vitest";
import {
  bestSellerIds,
  isMarketingName,
  isVariantLikeName,
  sameCategoryName,
  buildPlan,
  cleanProductName,
  collectionDemand,
  isSoldOutProduct,
  keepableSection,
  MENU_TOP_ITEMS,
  planMenu,
  proposeStructureByRules,
  rankProductIds,
  sanitizeHomeComposition,
  sanitizeStructure,
  scoreProducts,
  structureFromAssignments,
  summarizeExistingSection,
  type ExistingSectionSummary,
  type OrganizerCollection,
  type OrganizerProduct,
  type RawHomeSection,
} from "@/lib/store-organizer";

const NOW = new Date("2026-10-19T12:00:00Z");

function product(id: string, name: string, extra: Partial<OrganizerProduct> = {}): OrganizerProduct {
  return {
    id,
    name,
    description: "",
    price: 10000,
    compareAtPrice: null,
    imageUrl: `https://img.test/${id}.jpg`,
    images: 1,
    stock: null,
    hasVariants: false,
    variantStocks: [],
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    featured: false,
    sourcePosition: Number(id.replace(/\D/g, "")) || 0,
    collectionIds: [],
    sold90: 0,
    soldAll: 0,
    reviews: 0,
    rating: null,
    ...extra,
  };
}

function collection(id: string, name: string, productIds: string[], extra: Partial<OrganizerCollection> = {}): OrganizerCollection {
  return { id, name, slug: name.toLowerCase().replace(/\s+/g, "-"), description: null, imageUrl: null, position: 0, productIds, ...extra };
}

function section(id: string, type: string, extra: Partial<ExistingSectionSummary> = {}): ExistingSectionSummary {
  return { id, type, label: type, visual: false, hero: false, collectionIds: [], text: "", ...extra };
}

function rawSection(partial: Partial<RawHomeSection>): RawHomeSection {
  return { type: "", keepId: "", collections: [], title: "", subtitle: "", buttonText: "", body: "", ...partial };
}

describe("puntaje de demanda", () => {
  it("las ventas recientes mandan; el agotado queda de último aunque venda", () => {
    const products = [
      product("p1", "Base rubber", { sold90: 20, soldAll: 40 }),
      product("p2", "Top coat", { sold90: 2, soldAll: 50 }),
      product("p3", "Esmalte rojo", { sold90: 30, soldAll: 30, stock: 0 }),
      product("p4", "Lima", { description: "Lima de grano fino para preparar la uña antes del esmaltado, con doble cara y mango ergonómico.", images: 3 }),
    ];
    const scores = scoreProducts(products, NOW);
    expect(scores.get("p3")!.soldOut).toBe(true);
    expect(scores.get("p1")!.score).toBeGreaterThan(scores.get("p2")!.score);
    expect(scores.get("p2")!.score).toBeGreaterThan(scores.get("p4")!.score);
    const byId = new Map(products.map((p) => [p.id, p]));
    expect(rankProductIds(["p4", "p3", "p2", "p1"], scores, byId)).toEqual(["p1", "p2", "p4", "p3"]);
  });

  it("borradores al final y, sin ventas, decide la ficha, el descuento y lo reciente", () => {
    const products = [
      product("p1", "A", { active: false, sold90: 100, soldAll: 100 }),
      product("p2", "B", { compareAtPrice: 15000 }),
      product("p3", "C", { createdAt: new Date("2026-10-15T00:00:00Z") }),
      product("p4", "D", { imageUrl: null, images: 0 }),
    ];
    const scores = scoreProducts(products, NOW);
    const byId = new Map(products.map((p) => [p.id, p]));
    const ranked = rankProductIds(["p1", "p2", "p3", "p4"], scores, byId);
    expect(ranked[ranked.length - 1]).toBe("p1");
    expect(ranked.indexOf("p4")).toBeGreaterThan(ranked.indexOf("p2"));
    expect(isSoldOutProduct({ stock: null, hasVariants: true, variantStocks: [0, 0] })).toBe(true);
    expect(isSoldOutProduct({ stock: null, hasVariants: true, variantStocks: [0, null] })).toBe(false);
    expect(isSoldOutProduct({ stock: 3, hasVariants: false, variantStocks: [] })).toBe(false);
  });

  it("la demanda de una colección sube con sus mejores productos y con su tamaño", () => {
    const products = [
      product("p1", "A", { sold90: 10 }),
      product("p2", "B", { sold90: 10 }),
      product("p3", "C"),
      product("p4", "D", { stock: 0, sold90: 50 }),
    ];
    const scores = scoreProducts(products, NOW);
    const byId = new Map(products.map((p) => [p.id, p]));
    const big = collectionDemand(["p1", "p2", "p3"], scores, byId);
    const small = collectionDemand(["p3"], scores, byId);
    expect(big).toBeGreaterThan(small);
    expect(collectionDemand(["p4"], scores, byId)).toBe(0);
    expect(bestSellerIds(products, scores).title).toBe("Los más vendidos");
    expect(bestSellerIds(products, scores).ids).toEqual(["p1", "p2", "p3"]);
    expect(bestSellerIds([product("x", "X")], scoreProducts([product("x", "X")], NOW)).title).toBe("Destacados");
  });
});

describe("nombres de producto", () => {
  it("arregla mayúsculas sostenidas, unidades y espacios sin inventar", () => {
    expect(cleanProductName("VELOTERAPIA SANDIA 50GR")).toBe("Veloterapia sandia 50 g");
    expect(cleanProductName("ACEITE DE CUTICULA  COCO 30ML")).toBe("Aceite de cuticula coco 30 ml");
    expect(cleanProductName("Lampara UV led 48w")).toBe("Lampara UV LED 48w");
    expect(cleanProductName("Tips Press On X12")).toBe("Tips Press On x12");
    expect(cleanProductName("Base Rubber Nude")).toBe("Base Rubber Nude");
    expect(cleanProductName("UV")).toBe("UV");
  });
});

describe("estructura por reglas", () => {
  it("una medida, una gama o 'Más vendidos' no es una categoría", () => {
    expect(isVariantLikeName("15ml")).toBe(true);
    expect(isVariantLikeName("Gama rojos")).toBe(true);
    expect(isVariantLikeName("Decoración")).toBe(false);
    expect(isMarketingName("Mas vendidos")).toBe(true);
    expect(isMarketingName("Lo nuevo")).toBe(true);
    expect(isMarketingName("Sin categorizar")).toBe(true);
    expect(isMarketingName("Pinceles")).toBe(false);
  });

  it("reconoce la misma categoría con nombres parecidos", () => {
    expect(sameCategoryName("Herramientas", "Herramientas y equipos")).toBe(true);
    expect(sameCategoryName("Esmaltes semipermanentes", "Esmaltes")).toBe(true);
    expect(sameCategoryName("Kits de inicio", "Kits y combos")).toBe(true);
    expect(sameCategoryName("Otros productos", "Otros aromas")).toBe(false);
    expect(sameCategoryName("Pestañas", "Uñas")).toBe(false);
  });

  it("une colecciones repetidas, disuelve las de un producto y clasifica lo suelto por palabras", () => {
    const products = [
      product("p1", "Gel Polish Rojo"),
      product("p2", "Gel Polish Azul"),
      product("p3", "Gel Polish Verde"),
      product("p4", "Lima de uñas"),
      product("p5", "Pincel de pelo fino"),
      product("p6", "Esmalte semipermanente nude"),
      product("p7", "Cosa rara"),
    ];
    const collections = [
      collection("c1", "Gel Polish Rojos", ["p1"]),
      collection("c2", "Gel Polish Azules", ["p2"]),
      collection("c3", "Gel Polish Verdes", ["p3"]),
      collection("c4", "Promo", ["p4"]),
    ];
    const proposal = proposeStructureByRules(products, collections);
    const names = proposal.collections.map((c) => c.name);
    expect(names[0]).toBe("Gel Polish");
    // El esmalte suelto cae en Gel Polish (es la categoría "Esmaltes").
    expect(proposal.collections[0].productIds).toEqual(["p1", "p2", "p3", "p6"]);
    expect(names).toContain("Herramientas y equipos");
    expect(names).toContain("Otros productos");
    const all = proposal.collections.flatMap((c) => c.productIds).sort();
    expect(all).toEqual(["p1", "p2", "p3", "p4", "p5", "p6", "p7"]);
    expect(new Set(all).size).toBe(7);
    expect(proposal.collections.find((c) => c.name === "Promo")).toBeUndefined();
  });

  it("sin colecciones arma todo por palabras del nicho", () => {
    const products = [
      product("p1", "Esmalte semipermanente rojo"),
      product("p2", "Esmalte semipermanente azul"),
      product("p3", "Lima 180/240"),
      product("p4", "Pusher metálico"),
    ];
    const proposal = proposeStructureByRules(products, []);
    expect(proposal.collections.map((c) => [c.name, c.productIds.length])).toEqual([
      ["Esmaltes", 2],
      ["Herramientas y equipos", 2],
    ]);
  });
});

describe("armar la propuesta con las respuestas por pasos de la IA", () => {
  it("junta definiciones y asignaciones; lo desconocido va a Otros", () => {
    const proposal = structureFromAssignments(
      [
        { name: "Semipermanente", description: "Color que dura.", children: ["Colores", "Bases y tops"] },
        { name: "Herramientas", description: "", children: [] },
      ],
      [
        { id: "p1", collection: "semipermanente", child: "Colores" },
        { id: "p2", collection: "Semipermanente", child: "bases y tops" },
        { id: "p3", collection: "Semipermanente", child: null },
        { id: "p4", collection: "Herramientas", child: "Colores" },
        { id: "p5", collection: "Otros productos", child: null },
        { id: "p6", collection: "Inventada", child: null },
      ],
      [{ id: "p1", name: "Esmalte rojo" }],
    );
    expect(proposal.collections.map((c) => [c.name, c.productIds, c.children?.map((ch) => [ch.name, ch.productIds])])).toEqual([
      ["Semipermanente", ["p1", "p2", "p3"], [["Colores", ["p1"]], ["Bases y tops", ["p2"]]]],
      ["Herramientas", ["p4"], []],
      ["Otros productos", ["p5", "p6"], undefined],
    ]);
    expect(proposal.productNames).toEqual([{ id: "p1", name: "Esmalte rojo" }]);
  });
});

describe("limpieza de la propuesta de la IA", () => {
  it("ids reales, un producto por colección, subcolecciones dentro del padre, sobrantes a Otros", () => {
    const products = [product("p1", "A"), product("p2", "B"), product("p3", "C"), product("p4", "D"), product("p5", "E")];
    const clean = sanitizeStructure(
      {
        collections: [
          { name: "  Semipermanente ", description: "Color que dura.", productIds: ["p1", "p2", "p3", "zzz"], children: [{ name: "Colores", productIds: ["p1", "p2", "p9"] }, { name: "Bases", productIds: ["p3"] }] },
          { name: "Repetida", productIds: ["p1", "p4"] },
          { name: "Solo uno", productIds: ["p5"] },
        ],
        productNames: [{ id: "p1", name: "Esmalte A" }, { id: "p1", name: "Otro" }, { id: "nope", name: "X" }, { id: "p2", name: "B" }],
      },
      products,
    );
    expect(clean.collections.map((c) => [c.name, c.productIds, c.children?.map((ch) => ch.productIds)])).toEqual([
      ["Semipermanente", ["p1", "p2", "p3"], undefined],
      ["Otros productos", ["p4", "p5"], undefined],
    ]);
    expect(clean.collections[0].description).toBe("Color que dura.");
    expect(clean.productNames).toEqual([{ id: "p1", name: "Esmalte A" }]);
  });
});

describe("el plan", () => {
  const products = [
    product("p1", "SEMI ROJO", { sold90: 30, soldAll: 60 }),
    product("p2", "SEMI AZUL", { sold90: 10, soldAll: 20 }),
    product("p3", "Base rubber", { sold90: 5, soldAll: 5 }),
    product("p4", "Lima", { stock: 0 }),
    product("p5", "Pincel", { compareAtPrice: 20000 }),
    product("p6", "Pusher", { compareAtPrice: 20000 }),
    product("p7", "Lámpara", { compareAtPrice: 30000, imageUrl: null, images: 0 }),
    product("p8", "Borrador", { active: false }),
  ];
  const existing = [
    collection("c1", "Herramientas", ["p4", "p5", "p6", "p7"], { imageUrl: "https://img.test/herr.jpg", description: "Todo para trabajar." }),
    collection("c2", "Promociones", ["p1", "p5"]),
  ];
  const proposal = {
    collections: [
      { name: "Herramientas", description: "", productIds: ["p4", "p5", "p6", "p7"] },
      { name: "Semipermanente", description: "Color intenso que dura semanas.", productIds: ["p1", "p2", "p3"] },
      { name: "Otros productos", productIds: ["p8"] },
    ],
    productNames: [{ id: "p1", name: "Semipermanente rojo" }],
  };

  it("ordena por demanda, conserva la colección que ya existía, renombra y arma menú y portada", () => {
    const plan = buildPlan(products, existing, proposal, { source: "ia", now: NOW, instagram: true, whatsapp: true });
    expect(plan.collections.map((c) => c.name)).toEqual(["Semipermanente", "Herramientas", "Otros productos"]);
    const semi = plan.collections[0];
    expect(semi.existingId).toBeNull();
    expect(semi.productIds).toEqual(["p1", "p2", "p3"]);
    expect(semi.imageUrl).toBe("https://img.test/p1.jpg");
    expect(semi.sold).toBe(85);
    const tools = plan.collections[1];
    expect(tools.existingId).toBe("c1");
    expect(tools.slug).toBe("herramientas");
    expect(tools.imageUrl).toBe("https://img.test/herr.jpg");
    expect(tools.description).toBe("Todo para trabajar.");
    // Disponibles primero (los de descuento), el agotado al final.
    expect(tools.productIds.slice(-1)).toEqual(["p4"]);
    expect(plan.removedCollections).toEqual([{ id: "c2", name: "Promociones", slug: "promociones", count: 2, movedTo: "Semipermanente" }]);
    expect(plan.productNames).toEqual([
      { id: "p1", from: "SEMI ROJO", to: "Semipermanente rojo" },
      { id: "p2", from: "SEMI AZUL", to: "Semi azul" },
    ]);
    expect(plan.menu.map((m) => m.label)).toEqual(["Inicio", "Semipermanente", "Herramientas", "Otros productos", "Todos los productos"]);
    expect(plan.menu[1].url).toBe("/coleccion/semipermanente");
    expect(plan.home.map((s) => s.type)).toEqual([
      "BANNER",
      "CATEGORY_GRID",
      "FEATURED_PRODUCTS",
      "ON_SALE_PRODUCTS",
      "SHIPPING_INFO_BANNERS",
      "INSTAGRAM_CTA",
      "PRODUCT_CATALOG",
    ]);
    const banner = plan.home[0];
    expect(banner.type === "BANNER" && banner.collectionKey).toBe("semipermanente");
    const featured = plan.home[2];
    expect(featured.type === "FEATURED_PRODUCTS" && featured.title).toBe("Los más vendidos");
    expect(featured.type === "FEATURED_PRODUCTS" && featured.productIds.slice(0, 3)).toEqual(["p1", "p2", "p3"]);
    expect(plan.stats).toMatchObject({ products: 8, active: 7, soldOut: 1, withSales: 3, collectionsBefore: 2, collectionsAfter: 3, renamed: 2, discounted: 3 });
    expect(plan.announcement).toBeNull();
    expect(plan.notes).toBeNull();
  });

  /// Lo que la portada ya tenía (importado): un texto corto, un banner
  /// ancho, banners promocionales, banners de una categoría que
  /// desaparece y un video.
  const imported: ExistingSectionSummary[] = [
    section("s1", "TEXT", { text: "Hola", label: 'Texto: "Hola"' }),
    section("s2", "BANNER", { visual: true, hero: true, label: "Banner ancho con 3 fotos que se deslizan" }),
    section("s3", "PROMO_BANNERS", { visual: true, label: "2 banners promocionales con foto" }),
    section("s4", "CATEGORY_BANNERS", { visual: true, collectionIds: ["c2"], label: "Banners con foto de 1 categoría (Promociones)" }),
    section("s5", "VIDEO", { visual: true, label: "Video" }),
  ];
  const homeTypes = (home: { type: string; sectionId?: string }[]) => home.map((s) => (s.type === "KEEP" ? `KEEP:${s.sectionId}` : s.type));

  it("conserva el banner importado como cabecera y lo visual que aporta, y con muchas colecciones el menú deja el resto bajo Más", () => {
    const plan = buildPlan(products, existing, proposal, { source: "reglas", now: NOW, existingSections: imported });
    // Sin cabecera nueva (ya hay banner); los promocionales y el video van
    // después de los más vendidos; los banners de Promociones no (la
    // colección desaparece) y el texto "Hola" tampoco.
    expect(homeTypes(plan.home)).toEqual(["KEEP:s2", "CATEGORY_GRID", "FEATURED_PRODUCTS", "KEEP:s3", "KEEP:s5", "ON_SALE_PRODUCTS", "SHIPPING_INFO_BANNERS", "PRODUCT_CATALOG"]);
    expect(plan.home.some((s) => s.type === "INSTAGRAM_CTA")).toBe(false);
    const many = Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, existingId: null, name: `Col ${i}`, slug: `col-${i}`, description: "", imageUrl: null, productIds: ["p1"], demand: 10 - i, sold: 0, children: i === 0 ? [{ key: "c0-sub", existingId: null, name: "Sub", slug: "col-0-sub", description: "", imageUrl: null, productIds: ["p1"], demand: 1, sold: 0, children: [] }] : [] }));
    const menu = planMenu(many);
    expect(menu[0].label).toBe("Inicio");
    expect(menu.slice(1, 1 + MENU_TOP_ITEMS).map((m) => m.label)).toEqual(["Col 0", "Col 1", "Col 2", "Col 3", "Col 4", "Col 5", "Col 6"]);
    expect(menu[1].children.map((c) => c.label)).toEqual(["Sub"]);
    expect(menu[1 + MENU_TOP_ITEMS]).toMatchObject({ label: "Más", url: "#" });
    expect(menu[1 + MENU_TOP_ITEMS].children.map((c) => c.label)).toEqual(["Col 7", "Col 8", "Col 9"]);
    expect(menu[menu.length - 1]).toMatchObject({ label: "Todos los productos", url: "/coleccion" });
  });
});

describe("lo que la portada ya tiene", () => {
  const names = new Map([["c1", "Herramientas"]]);

  it("resume cada sección y marca cuál tiene foto o video propio", () => {
    expect(
      summarizeExistingSection(
        { id: "a", type: "BANNER", config: { aspectRatio: "original", slides: [{ imageUrl: "https://x/1.jpg", link: "" }, { imageUrl: "https://x/2.jpg", link: "" }], title: "Nueva colección" } },
        names,
      ),
    ).toMatchObject({ visual: true, hero: true, label: 'Banner ancho con 2 fotos que se deslizan con el título "Nueva colección"' });
    // Banner viejo (imageUrl suelto) y cuadrado: visual, pero no cabecera.
    expect(summarizeExistingSection({ id: "b", type: "BANNER", config: { imageUrl: "https://x/1.jpg", aspectRatio: "square" } }, names)).toMatchObject({ visual: true, hero: false });
    expect(summarizeExistingSection({ id: "c", type: "BANNER", config: { slides: [] } }, names)).toMatchObject({ visual: false, hero: false, label: "Banner vacío" });
    expect(
      summarizeExistingSection(
        {
          id: "d",
          type: "CATEGORY_BANNERS",
          config: { items: [{ show: true, collectionId: "c1", imageUrl: "https://x/c.jpg" }, { show: false, collectionId: "c9", imageUrl: "https://x/9.jpg" }, { show: true, collectionId: null, imageUrl: null }] },
        },
        names,
      ),
    ).toMatchObject({ visual: true, collectionIds: ["c1"], label: "Banners con foto de 1 categoría (Herramientas)" });
    expect(summarizeExistingSection({ id: "e", type: "TEXT", config: { heading: "Quiénes somos", body: "<p>Somos  una tienda</p>" } }, names)).toMatchObject({
      visual: false,
      text: "Quiénes somos — Somos una tienda",
    });
    expect(summarizeExistingSection({ id: "f", type: "VIDEO", config: { url: "https://youtube.com/watch?v=1", title: "" } }, names)).toMatchObject({ visual: true, label: "Video" });
    expect(summarizeExistingSection({ id: "g", type: "IMAGE_CAROUSEL", config: { images: ["https://x/1.jpg"] } }, names)).toMatchObject({ visual: true, hero: true, label: "Imagen de ancho completo" });
    expect(summarizeExistingSection({ id: "h", type: "FEATURED_COLLECTION", config: { collectionId: "c1", title: "" } }, names)).toMatchObject({
      visual: false,
      collectionIds: ["c1"],
      label: "Productos de la colección Herramientas",
    });
    expect(summarizeExistingSection({ id: "i", type: "SHIPPING_INFO_BANNERS", config: null }, names)).toMatchObject({ visual: false, hero: false, collectionIds: [] });
  });

  it("se conserva lo visual cuyas colecciones siguen existiendo; un texto solo si es de marca y se pide", () => {
    const surviving = new Set(["c1"]);
    expect(keepableSection(section("a", "PROMO_BANNERS", { visual: true }), surviving)).toBe(true);
    expect(keepableSection(section("b", "CATEGORY_BANNERS", { visual: true, collectionIds: ["c1", "c2"] }), surviving)).toBe(false);
    expect(keepableSection(section("c", "CATEGORY_BANNERS", { visual: true, collectionIds: ["c1"] }), surviving)).toBe(true);
    const text = section("d", "TEXT", { text: "Somos una tienda de productos para uñas en Bogotá con diez años de experiencia." });
    expect(keepableSection(text, surviving)).toBe(false);
    expect(keepableSection(text, surviving, { text: true })).toBe(true);
    expect(keepableSection(section("e", "TEXT", { text: "Hola" }), surviving, { text: true })).toBe(false);
  });
});

describe("la portada compuesta por la IA", () => {
  const products = [
    product("p1", "Semipermanente rojo", { sold90: 30, soldAll: 60 }),
    product("p2", "Semipermanente azul", { sold90: 10, soldAll: 20 }),
    product("p3", "Base rubber", { sold90: 5, soldAll: 5 }),
    product("p4", "Lima", { stock: 0 }),
    product("p5", "Pincel", { compareAtPrice: 20000 }),
    product("p6", "Pusher", { compareAtPrice: 20000 }),
    product("p7", "Lámpara", { compareAtPrice: 30000, imageUrl: null, images: 0 }),
    product("p8", "Borrador", { active: false }),
  ];
  const existing = [
    collection("c1", "Herramientas", ["p4", "p5", "p6", "p7"], { imageUrl: "https://img.test/herr.jpg" }),
    collection("c2", "Promociones", ["p1", "p5"]),
  ];
  const proposal = {
    collections: [
      { name: "Herramientas", description: "", productIds: ["p4", "p5", "p6", "p7"] },
      { name: "Semipermanente", description: "Color intenso que dura semanas.", productIds: ["p1", "p2", "p3"] },
      { name: "Otros productos", productIds: ["p8"] },
    ],
    productNames: [],
  };
  const imported: ExistingSectionSummary[] = [
    section("s1", "TEXT", { text: "Hola", label: 'Texto: "Hola"' }),
    section("s2", "BANNER", { visual: true, hero: true, label: "Banner ancho con 3 fotos que se deslizan" }),
    section("s3", "PROMO_BANNERS", { visual: true, label: "2 banners promocionales con foto" }),
    section("s4", "CATEGORY_BANNERS", { visual: true, collectionIds: ["c2"], label: "Banners con foto de 1 categoría (Promociones)" }),
    section("s5", "VIDEO", { visual: true, label: "Video" }),
  ];
  const plan = buildPlan(products, existing, proposal, { source: "ia", now: NOW, instagram: true, whatsapp: true, existingSections: imported });
  const ctx = {
    collections: plan.collections,
    products,
    scores: scoreProducts(products, NOW),
    existingSections: imported,
    instagram: true,
    whatsapp: true,
    discounted: plan.stats.discounted,
    hasAnnouncement: false,
  };
  const types = (home: { type: string; sectionId?: string }[]) => home.map((s) => (s.type === "KEEP" ? `KEEP:${s.sectionId}` : s.type));

  it("respeta lo que propone la IA cuando es válido y completa lo que no puede faltar", () => {
    const composed = sanitizeHomeComposition(
      {
        sections: [
          rawSection({ type: "KEEP", keepId: "S2" }),
          rawSection({ type: "CATEGORY_GRID", collections: ["Semipermanente", "Herramientas"], title: "Elige por categoría" }),
          rawSection({ type: "FEATURED_COLLECTION", collections: ["Herramientas"], title: "Para tu mesa de trabajo" }),
          rawSection({ type: "KEEP", keepId: "S5" }),
          rawSection({ type: "TEXT", title: "Bienvenida", body: "Esmaltes semipermanentes y herramientas para manicuristas, con envío a todo el país y asesoría por WhatsApp." }),
          rawSection({ type: "INSTAGRAM_CTA" }),
          rawSection({ type: "PRODUCT_CATALOG" }),
        ],
        announcement: "Asesoría por WhatsApp antes de comprar 💅",
        notes: "La colección estrella arriba y las categorías después.",
      },
      ctx,
    );
    expect(composed).not.toBeNull();
    // Los más vendidos se agregan después de las categorías y los sellos
    // de confianza antes de Instagram.
    expect(types(composed!.home)).toEqual([
      "KEEP:s2",
      "CATEGORY_GRID",
      "FEATURED_PRODUCTS",
      "FEATURED_COLLECTION",
      "KEEP:s5",
      "TEXT",
      "SHIPPING_INFO_BANNERS",
      "INSTAGRAM_CTA",
      "PRODUCT_CATALOG",
    ]);
    expect(composed!.home[1]).toMatchObject({ title: "Elige por categoría", collectionKeys: ["semipermanente", "herramientas"] });
    expect(composed!.home[2]).toMatchObject({ title: "Los más vendidos" });
    expect(composed!.home[3]).toMatchObject({ collectionKey: "herramientas", title: "Para tu mesa de trabajo" });
    expect(composed!.home[5]).toMatchObject({ heading: "Bienvenida" });
    expect(composed!.home[8]).toMatchObject({ title: "Todos los productos" });
    expect(composed!.announcement).toBe("Asesoría por WhatsApp antes de comprar");
    expect(composed!.notes).toBe("La colección estrella arriba y las categorías después.");
    // Con barra de anuncio ya puesta, no se propone otra.
    const withBar = sanitizeHomeComposition({ sections: [rawSection({ type: "KEEP", keepId: "S2" }), rawSection({ type: "CATEGORY_GRID" }), rawSection({ type: "TEXT", body: "x".repeat(50) })], announcement: "Novedades cada semana", notes: "" }, { ...ctx, hasAnnouncement: true });
    expect(withBar?.announcement).toBeNull();
  });

  it("descarta lo inválido: colecciones que no existen, repetidos, dos cabeceras, promesas y textos cortos; el catálogo va de último", () => {
    const composed = sanitizeHomeComposition(
      {
        sections: [
          rawSection({ type: "BANNER", collections: ["Semipermanente"], title: "Semipermanente que dura" }),
          rawSection({ type: "KEEP", keepId: "S2" }),
          rawSection({ type: "KEEP", keepId: "S4" }),
          rawSection({ type: "KEEP", keepId: "S1" }),
          rawSection({ type: "KEEP", keepId: "nope" }),
          rawSection({ type: "CATEGORY_GRID", collections: ["Inventada"] }),
          rawSection({ type: "FEATURED_PRODUCTS", title: "Favoritos" }),
          rawSection({ type: "FEATURED_PRODUCTS" }),
          rawSection({ type: "NEW_PRODUCTS" }),
          rawSection({ type: "ON_SALE_PRODUCTS", title: "Rebajas" }),
          rawSection({ type: "TEXT", body: "Corto" }),
          rawSection({ type: "SHIPPING_INFO_BANNERS" }),
          rawSection({ type: "SHIPPING_INFO_BANNERS" }),
          rawSection({ type: "PRODUCT_CATALOG" }),
          rawSection({ type: "INSTAGRAM_CTA" }),
        ],
        announcement: "Envío gratis en toda Colombia",
        notes: "",
      },
      ctx,
    );
    expect(composed).not.toBeNull();
    expect(types(composed!.home)).toEqual(["BANNER", "CATEGORY_GRID", "FEATURED_PRODUCTS", "ON_SALE_PRODUCTS", "SHIPPING_INFO_BANNERS", "INSTAGRAM_CTA", "PRODUCT_CATALOG"]);
    expect(composed!.home[0]).toMatchObject({
      collectionKey: "semipermanente",
      imageUrl: "https://img.test/p1.jpg",
      title: "Semipermanente que dura",
      subtitle: "Color intenso que dura semanas.",
      buttonText: "Ver semipermanente",
    });
    expect(composed!.home[1]).toMatchObject({ title: "Compra por categoría", collectionKeys: ["semipermanente", "herramientas"] });
    expect(composed!.home[2]).toMatchObject({ title: "Los más vendidos" });
    expect(composed!.home[3]).toMatchObject({ title: "Rebajas" });
    expect(composed!.announcement).toBeNull();
    expect(composed!.notes).toBeNull();
  });

  it("si casi nada de lo que propuso sirve, se queda la portada por reglas", () => {
    expect(sanitizeHomeComposition({ sections: [rawSection({ type: "KEEP", keepId: "S9" }), rawSection({ type: "NOPE" })], announcement: "", notes: "" }, ctx)).toBeNull();
    expect(sanitizeHomeComposition({ sections: [], announcement: "", notes: "" }, ctx)).toBeNull();
  });
});
