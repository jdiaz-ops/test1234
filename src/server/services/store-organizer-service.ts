import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeProductDescription, stripHtml } from "@/lib/sanitize-html";
import { slugify } from "@/lib/shopify-csv";
import { parseSectionConfig, type SectionType } from "@/lib/storefront-sections";
import { bannerImageUrl, type BannerSpec } from "@/lib/banner-image";
import type { ThemeConfig } from "@/lib/brand-theme";
import { getDraftTheme, getPublishedTheme, patchPublishedTheme, restoreThemeConfigs } from "@/server/services/brand-theme-store";
import {
  bestSellerIds,
  BEST_SELLERS_TITLE,
  buildPlan,
  collectionDemand,
  FEATURED_TITLE,
  flattenPlanned,
  proposeStructureByRules,
  rankProductIds,
  renderProductCopy,
  sanitizeHomeComposition,
  scoreProducts,
  structureFromAssignments,
  summarizeExistingSection,
  type BannerPlan,
  type ExistingSectionSummary,
  type HomeSectionPlan,
  type PlannedDescription,
  type StoreFacts,
  type StoreSettingsPlan,
  type OrganizerCollection,
  type OrganizerPlan,
  type OrganizerProduct,
  type PlannedMenuItem,
  type StructureAssignment,
  type StructureDefinition,
  type StructureProposal,
} from "@/lib/store-organizer";
import { normalizeText, OTHER_COLLECTION_NAME } from "@/lib/shopify-categorize";
import {
  aiAvailable,
  CLASSIFY_BATCH_SIZE,
  classifyWithClaude,
  composeHomeWithClaude,
  defineCollectionsWithClaude,
  DESCRIBE_BATCH_SIZE,
  describeProductsWithClaude,
  sectorFromVertical,
  type ClassifyResult,
  type DefinedCollection,
} from "@/server/services/store-organizer-ai-service";
import { replaceStorefrontMenu, type BuiltMenuItem } from "@/server/services/shopify-collections-import-service";
import { applyProductFamilies } from "@/server/services/product-family-service";
import { saveRedirects } from "@/server/services/storefront-redirect-service";

/// Organizador automático de tienda: lee el catálogo con sus señales
/// (ventas en Marcolini, reseñas, inventario, fotos, descripciones),
/// arma el plan (ver store-organizer.ts y store-organizer-ai-service.ts)
/// y lo aplica: colecciones nuevas con sus productos en orden de demanda,
/// nombres de producto limpios, menú y portada que venden. Guarda una
/// copia de cómo estaba todo (StoreOrganizerRun) para deshacerlo, y el
/// reorden nocturno (reorderStoreByDemand) mantiene lo más vendido arriba
/// con las ventas reales. Solo admin ("Entrar como") y Duplicar tienda.
/// Ver conversación del 2026-10-19.

export class StoreOrganizerError extends Error {}

const SALES_WINDOW_DAYS = 90;

type Catalog = {
  products: OrganizerProduct[];
  collections: OrganizerCollection[];
  brand: { companyName: string; instagramHandle: string | null; sector: string };
  /// Las secciones activas de la portada, resumidas (ver summarizeExistingSection).
  sections: ExistingSectionSummary[];
  /// Datos para los ajustes de conversión (ver planSettings).
  facts: StoreFacts;
  /// El tema publicado: con sus colores y letra se pintan los banners, y
  /// sobre él van los ajustes.
  theme: ThemeConfig;
};

function variantLabels(variants: { option1Value: string | null; option2Value: string | null; option3Value: string | null }[]): string[] {
  const out = new Set<string>();
  for (const v of variants) {
    for (const value of [v.option1Value, v.option2Value, v.option3Value]) if (value?.trim()) out.add(value.trim());
  }
  return Array.from(out).slice(0, 20);
}

async function loadCatalog(brandId: string): Promise<Catalog> {
  const since = new Date(Date.now() - SALES_WINDOW_DAYS * 86_400_000);
  const [brand, rows, collections, sales, reviews, sections, theme, pages] = await Promise.all([
    prisma.brandProfile.findUnique({
      where: { id: brandId },
      select: { companyName: true, instagramHandle: true, vertical: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { brandId, manual: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        compareAtPrice: true,
        imageUrl: true,
        stock: true,
        hasVariants: true,
        status: true,
        available: true,
        createdAt: true,
        featured: true,
        variants: { select: { stock: true, option1Value: true, option2Value: true, option3Value: true } },
        brandCollections: { select: { collectionId: true } },
        _count: { select: { images: true } },
      },
    }),
    prisma.brandCollection.findMany({
      where: { brandId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        bannerUrl: true,
        position: true,
        products: { orderBy: { position: "asc" }, select: { productId: true } },
      },
    }),
    prisma.storeOrderItem.findMany({
      where: { productId: { not: null }, order: { brandId, status: "PAID", kind: "PURCHASE" } },
      select: { productId: true, quantity: true, order: { select: { paidAt: true, createdAt: true } } },
    }),
    prisma.productReview.groupBy({
      by: ["productId"],
      where: { brandId, status: "APPROVED" },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.storefrontSection.findMany({ where: { brandId, enabled: true }, orderBy: { position: "asc" }, select: { id: true, type: true, config: true } }),
    getPublishedTheme(brandId),
    prisma.storePage.count({ where: { brandId } }),
  ]);
  if (!brand) throw new StoreOrganizerError("Marca no encontrada.");

  const sold90 = new Map<string, number>();
  const soldAll = new Map<string, number>();
  for (const item of sales) {
    if (!item.productId) continue;
    soldAll.set(item.productId, (soldAll.get(item.productId) ?? 0) + item.quantity);
    const when = item.order.paidAt ?? item.order.createdAt;
    if (when >= since) sold90.set(item.productId, (sold90.get(item.productId) ?? 0) + item.quantity);
  }
  const reviewsById = new Map(reviews.map((r) => [r.productId, { count: r._count._all, rating: r._avg.rating }]));

  const products: OrganizerProduct[] = rows.map((p, index) => ({
    id: p.id,
    name: p.name,
    description: p.description ? stripHtml(p.description, 5000) : "",
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice == null ? null : Number(p.compareAtPrice),
    imageUrl: p.imageUrl,
    images: Math.max(p._count.images, p.imageUrl ? 1 : 0),
    stock: p.stock,
    hasVariants: p.hasVariants,
    variantStocks: p.variants.map((v) => v.stock),
    variantLabels: variantLabels(p.variants),
    active: p.status === "ACTIVE" && p.available,
    createdAt: p.createdAt,
    featured: p.featured,
    sourcePosition: index,
    collectionIds: p.brandCollections.map((c) => c.collectionId),
    sold90: sold90.get(p.id) ?? 0,
    soldAll: soldAll.get(p.id) ?? 0,
    reviews: reviewsById.get(p.id)?.count ?? 0,
    rating: reviewsById.get(p.id)?.rating ?? null,
  }));

  const collectionNameById = new Map(collections.map((c) => [c.id, c.name]));

  return {
    products,
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      bannerUrl: c.bannerUrl,
      position: c.position,
      productIds: c.products.map((p) => p.productId),
    })),
    brand: {
      companyName: brand.companyName,
      instagramHandle: brand.instagramHandle,
      sector: sectorFromVertical(brand.vertical?.name),
    },
    sections: sections.map((s) => summarizeExistingSection(s, collectionNameById)),
    facts: {
      hasPages: pages > 0,
      hasPurchaseInfo: theme.productDetail.purchaseInfo.some((i) => i.show && Boolean(i.title || i.description)),
    },
    theme,
  };
}

export type OrganizerLastRun = { id: string; status: "APPLIED" | "REVERTED"; source: string; createdAt: Date; summary: ApplySummary } | null;

export async function lastOrganizerRun(brandId: string): Promise<OrganizerLastRun> {
  const run = await prisma.storeOrganizerRun.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" } });
  return run ? { id: run.id, status: run.status, source: run.source, createdAt: run.createdAt, summary: run.summary as ApplySummary } : null;
}

function planFrom(catalog: Catalog, proposal: StructureProposal, source: OrganizerPlan["source"]): OrganizerPlan {
  return buildPlan(catalog.products, catalog.collections, proposal, {
    source,
    instagram: Boolean(catalog.brand.instagramHandle),
    existingSections: catalog.sections,
    store: catalog.facts,
  });
}

async function loadCatalogOrThrow(brandId: string) {
  const catalog = await loadCatalog(brandId);
  if (catalog.products.length === 0) throw new StoreOrganizerError("La tienda no tiene productos todavía.");
  return catalog;
}

/// Paso 1 del navegador: con IA, define las colecciones y devuelve las
/// tandas de productos por clasificar; sin IA (o si falla), devuelve de
/// una vez el plan por reglas.
export type PrepareResult =
  | { mode: "ia"; collections: DefinedCollection[]; batches: string[][]; total: number }
  | { mode: "reglas"; plan: OrganizerPlan };

export async function prepareStoreOrganizer(brandId: string): Promise<PrepareResult> {
  const catalog = await loadCatalogOrThrow(brandId);
  if (aiAvailable()) {
    try {
      const collections = await defineCollectionsWithClaude({
        products: catalog.products,
        collections: catalog.collections,
        storeName: catalog.brand.companyName,
        sector: catalog.brand.sector,
      });
      if (collections) {
        const ids = catalog.products.map((p) => p.id);
        const batches: string[][] = [];
        for (let i = 0; i < ids.length; i += CLASSIFY_BATCH_SIZE) batches.push(ids.slice(i, i + CLASSIFY_BATCH_SIZE));
        return { mode: "ia", collections, batches, total: ids.length };
      }
    } catch (err) {
      console.error("[organizador] definir con IA falló, se usan las reglas:", err instanceof Error ? err.message : err);
    }
  }
  return { mode: "reglas", plan: planFrom(catalog, proposeStructureByRules(catalog.products, catalog.collections), "reglas") };
}

/// Paso 2: clasifica una tanda (ids de productos de la marca) en las
/// colecciones definidas. null si la IA no respondió.
export async function classifyStoreOrganizer(brandId: string, input: { collections: DefinedCollection[]; ids: string[] }): Promise<ClassifyResult | null> {
  const catalog = await loadCatalogOrThrow(brandId);
  const wanted = new Set(input.ids);
  const products = catalog.products.filter((p) => wanted.has(p.id)).slice(0, CLASSIFY_BATCH_SIZE);
  if (products.length === 0) return { assignments: [], productNames: [] };
  const currentNames = new Map(catalog.collections.map((c) => [c.id, c.name]));
  try {
    return await classifyWithClaude({ products, currentNames, collections: input.collections, sector: catalog.brand.sector });
  } catch (err) {
    console.error("[organizador] clasificar con IA falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

/// Paso 4 (después del plan): fichas por tandas, SOLO para productos sin
/// descripción — cada id con el nombre de la colección en la que va a
/// quedar. Las fichas que ya existen no se tocan (pedido del 2026-10-19).
/// Ver describeProductsWithClaude; acá se vuelven HTML. null si no
/// respondió.
export async function describeStoreOrganizer(
  brandId: string,
  items: { id: string; collection: string }[],
): Promise<{ descriptions: PlannedDescription[]; kept: number } | null> {
  const catalog = await loadCatalogOrThrow(brandId);
  const collectionOf = new Map(items.map((i) => [i.id, i.collection]));
  const products = catalog.products.filter((p) => collectionOf.has(p.id) && p.description.trim().length === 0).slice(0, DESCRIBE_BATCH_SIZE);
  if (products.length === 0) return { descriptions: [], kept: 0 };
  try {
    const result = await describeProductsWithClaude({ products, collectionOf, storeName: catalog.brand.companyName, sector: catalog.brand.sector });
    if (!result) return null;
    const descriptions: PlannedDescription[] = [];
    for (const p of products) {
      const r = result.get(p.id);
      if (!r || r.keep || !r.copy) continue;
      descriptions.push({ id: p.id, html: renderProductCopy(r.copy), summary: r.copy.summary });
    }
    return { descriptions, kept: products.length - descriptions.length };
  } catch (err) {
    console.error("[organizador] fichas con IA fallaron:", err instanceof Error ? err.message : err);
    return null;
  }
}

/// Paso 3: arma el plan con lo que respondió la IA (o por reglas).
export async function planStoreOrganizer(
  brandId: string,
  structure: { mode: "reglas" } | { mode: "ia"; definitions: StructureDefinition[]; assignments: StructureAssignment[]; productNames: { id: string; name: string }[] },
): Promise<OrganizerPlan> {
  const catalog = await loadCatalogOrThrow(brandId);
  if (structure.mode === "reglas") return planFrom(catalog, proposeStructureByRules(catalog.products, catalog.collections), "reglas");
  const plan = planFrom(catalog, structureFromAssignments(structure.definitions, structure.assignments, structure.productNames), "ia");
  return composeHome(brandId, catalog, plan);
}

/// La portada la compone la IA con la línea directiva de conversión (ver
/// composeHomeWithClaude) y lo que responde se valida en
/// sanitizeHomeComposition. Sin IA, o si falla, queda la portada por
/// reglas que ya trae el plan.
async function composeHome(brandId: string, catalog: Catalog, plan: OrganizerPlan): Promise<OrganizerPlan> {
  if (!aiAvailable()) return plan;
  try {
    const current = announcementText(catalog.theme);
    const instagram = Boolean(catalog.brand.instagramHandle);
    const raw = await composeHomeWithClaude({
      storeName: catalog.brand.companyName,
      sector: catalog.brand.sector,
      plan,
      products: catalog.products,
      existingSections: catalog.sections,
      instagram,
      announcement: current,
    });
    if (!raw) return plan;
    const composed = sanitizeHomeComposition(raw, {
      collections: plan.collections,
      products: catalog.products,
      scores: scoreProducts(catalog.products),
      existingSections: catalog.sections,
      instagram,
      discounted: plan.stats.discounted,
      hasAnnouncement: current !== null,
    });
    if (!composed) return plan;
    return { ...plan, home: composed.home, announcement: composed.announcement, notes: composed.notes };
  } catch (err) {
    console.error("[organizador] componer la portada con IA falló, queda la portada por reglas:", err instanceof Error ? err.message : err);
    return plan;
  }
}

/// El texto de la barra de anuncio del tema, o null si no tiene una.
function announcementText(theme: ThemeConfig): string | null {
  const bar = theme.announcementBar;
  const texts = bar.messages.map((m) => m.text.trim()).filter(Boolean);
  return bar.enabled && texts.length > 0 ? texts.join(" · ") : null;
}

/// El plan completo en una sola llamada (pruebas y scripts): con llave
/// encadena los pasos de la IA; sin llave, reglas.
export async function previewStoreOrganizer(brandId: string): Promise<OrganizerPlan> {
  const prepared = await prepareStoreOrganizer(brandId);
  if (prepared.mode === "reglas") return prepared.plan;
  const assignments: StructureAssignment[] = [];
  const productNames: { id: string; name: string }[] = [];
  for (const ids of prepared.batches) {
    const result = await classifyStoreOrganizer(brandId, { collections: prepared.collections, ids });
    if (!result) return planStoreOrganizer(brandId, { mode: "reglas" });
    assignments.push(...result.assignments);
    productNames.push(...result.productNames);
  }
  return planStoreOrganizer(brandId, { mode: "ia", definitions: prepared.collections, assignments, productNames });
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------

export type ApplySummary = {
  source: "ia" | "reglas";
  collections: { created: number; updated: number; removed: number; subcollections: number };
  products: { placed: number; renamed: number };
  menu: number;
  home: number;
  families: number;
  /// Secciones importadas que se conservaron, banners pintados con el
  /// estilo de la tienda y si se puso la barra de anuncio.
  kept: number;
  banners: number;
  announcement: boolean;
  /// Fichas de producto reescritas, banners de colección pintados y los
  /// ajustes del tema que se aplicaron (para contarlos).
  descriptions: number;
  collectionBanners: number;
  settings: string[];
};

type Snapshot = {
  collections: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    bannerUrl: string | null;
    bannerMobileUrl: string | null;
    position: number;
    sortOrder: string;
    products: { productId: string; position: number }[];
  }[];
  menu: { id: string; label: string; url: string; parentId: string | null; position: number }[];
  sections: { type: string; enabled: boolean; position: number; config: unknown }[];
  productNames: { id: string; name: string }[];
  redirects: string[];
  mobileMenuStyle: string | null;
  /// La barra de anuncio (borrador y publicada) antes de ponerle la
  /// frase del plan; null si no se tocó. (Corridas viejas: ahora se
  /// guarda el tema entero en `theme`.)
  announcementBar?: { draft: unknown; published: unknown } | null;
  /// El tema entero (borrador y publicado) antes de los ajustes; null si
  /// no se tocó.
  theme?: { draft: unknown; published: unknown } | null;
  /// Las descripciones de los productos cuya ficha reescribió la IA.
  productDescriptions?: { id: string; description: string | null }[];
};

async function snapshotStore(brandId: string, productIds: string[]): Promise<Snapshot> {
  const [collections, menu, sections, products] = await Promise.all([
    prisma.brandCollection.findMany({
      where: { brandId },
      orderBy: { position: "asc" },
      include: { products: { orderBy: { position: "asc" }, select: { productId: true, position: true } } },
    }),
    prisma.storefrontMenuItem.findMany({ where: { brandId }, orderBy: { position: "asc" } }),
    prisma.storefrontSection.findMany({ where: { brandId }, orderBy: { position: "asc" } }),
    prisma.product.findMany({ where: { brandId, id: { in: productIds } }, select: { id: true, name: true } }),
  ]);
  return {
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      bannerUrl: c.bannerUrl,
      bannerMobileUrl: c.bannerMobileUrl,
      position: c.position,
      sortOrder: c.sortOrder,
      products: c.products,
    })),
    menu: menu.map((m) => ({ id: m.id, label: m.label, url: m.url, parentId: m.parentId, position: m.position })),
    sections: sections.map((s) => ({ type: s.type, enabled: s.enabled, position: s.position, config: s.config })),
    productNames: products.map((p) => ({ id: p.id, name: p.name })),
    redirects: [],
    mobileMenuStyle: null,
    announcementBar: null,
    theme: null,
    productDescriptions: [],
  };
}

async function uniqueCollectionSlug(brandId: string, base: string, excludeId: string | null) {
  let candidate = base || "coleccion";
  for (let n = 2; ; n++) {
    const existing = await prisma.brandCollection.findUnique({ where: { brandId_slug: { brandId, slug: candidate } }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base || "coleccion"}-${n}`;
  }
}

function menuToBuilt(items: PlannedMenuItem[], slugByKey: Map<string, string>): BuiltMenuItem[] {
  return items.map((item) => {
    const match = item.url.match(/^\/coleccion\/(.+)$/);
    const url = match && slugByKey.has(match[1]) ? `/coleccion/${slugByKey.get(match[1])}` : item.url;
    return { label: item.label, url, children: menuToBuilt(item.children, slugByKey) };
  });
}

type SectionContext = {
  idByKey: Map<string, string>;
  slugByKey: Map<string, string>;
  imageByKey: Map<string, string | null>;
  /// El tema publicado, para pintar el banner con sus colores y su letra.
  theme: ThemeConfig | null;
};

/// La receta de un banner con el estilo de la tienda: los colores y la
/// letra del tema publicado más la foto (solo https).
function themeBannerSpec(theme: ThemeConfig, texts: { title: string; subtitle: string; cta: string; image: string | null }): Omit<BannerSpec, "layout"> {
  return {
    title: texts.title,
    subtitle: texts.subtitle,
    cta: texts.cta,
    image: texts.image && /^https:\/\//i.test(texts.image) ? texts.image : null,
    bg: theme.colors.fondo,
    fg: theme.colors.texto,
    accent: theme.colors.usarAcento ? theme.colors.acento : theme.colors.principal,
    font: theme.typography.headingFont,
  };
}

/// Las URLs firmadas del banner en sus dos formatos (ver banner-image.ts),
/// o null si no se pueden firmar (falta AUTH_SECRET).
function signedBanners(spec: Omit<BannerSpec, "layout">): { wide: string; mobile: string } | null {
  try {
    return { wide: bannerImageUrl({ ...spec, layout: "wide" }), mobile: bannerImageUrl({ ...spec, layout: "mobile" }) };
  } catch (err) {
    console.error("[organizador] no se pudo firmar el banner:", err instanceof Error ? err.message : err);
    return null;
  }
}

function generatedBannerUrls(section: BannerPlan, theme: ThemeConfig) {
  return signedBanners(themeBannerSpec(theme, { title: section.title, subtitle: section.subtitle, cta: section.buttonText, image: section.imageUrl }));
}

function sectionConfig(section: HomeSectionPlan, ctx: SectionContext): { type: SectionType; config: unknown; generated?: boolean } | null {
  switch (section.type) {
    case "KEEP":
      return null;
    case "BANNER": {
      const slug = ctx.slugByKey.get(section.collectionKey);
      if (!slug) return null;
      const link = `/coleccion/${slug}`;
      const generated = ctx.theme ? generatedBannerUrls(section, ctx.theme) : null;
      if (generated) {
        // Los textos van pintados dentro de la imagen: sin capa encima.
        return {
          type: "BANNER",
          generated: true,
          config: { aspectRatio: "original", slides: [{ imageUrl: generated.wide, mobileImageUrl: generated.mobile, link }], title: "", subtitle: "", buttonText: "", buttonLink: link },
        };
      }
      return {
        type: "BANNER",
        config: {
          aspectRatio: "horizontal",
          slides: [{ imageUrl: section.imageUrl, link }],
          title: section.title,
          subtitle: section.subtitle,
          buttonText: section.buttonText,
          buttonLink: link,
        },
      };
    }
    case "CATEGORY_BANNERS": {
      const keys = section.collectionKeys.filter((key) => ctx.idByKey.has(key) && ctx.imageByKey.get(key)).slice(0, 3);
      if (keys.length < 2) return null;
      return {
        type: "CATEGORY_BANNERS",
        config: {
          extendFullWidth: false,
          items: Array.from({ length: 3 }, (_, i) =>
            keys[i] ? { show: true, collectionId: ctx.idByKey.get(keys[i]), imageUrl: ctx.imageByKey.get(keys[i]) ?? null } : { show: false, collectionId: null, imageUrl: null },
          ),
        },
      };
    }
    case "FEATURED_COLLECTION": {
      const id = ctx.idByKey.get(section.collectionKey);
      if (!id) return null;
      return { type: "FEATURED_COLLECTION", config: { collectionId: id, title: section.title } };
    }
    case "TEXT":
      return { type: "TEXT", config: { heading: section.heading, body: section.body } };
    case "CATEGORY_GRID": {
      const keys = section.collectionKeys.filter((key) => ctx.idByKey.has(key)).slice(0, 6);
      if (keys.length < 2) return null;
      return {
        type: "CATEGORY_GRID",
        config: {
          title: section.title,
          subtitle: "",
          items: Array.from({ length: 6 }, (_, i) =>
            keys[i]
              ? { show: true, collectionId: ctx.idByKey.get(keys[i]), imageUrl: ctx.imageByKey.get(keys[i]) ?? null, label: "" }
              : { show: false, collectionId: null, imageUrl: null, label: "" },
          ),
        },
      };
    }
    case "FEATURED_PRODUCTS":
      return { type: "FEATURED_PRODUCTS", config: { title: section.title, display: "carousel", productIds: section.productIds.slice(0, 24) } };
    case "ON_SALE_PRODUCTS":
      return { type: "ON_SALE_PRODUCTS", config: { title: section.title, display: "carousel", source: "auto", collectionId: null, productIds: [] } };
    case "NEW_PRODUCTS":
      return { type: "NEW_PRODUCTS", config: { title: section.title, display: "carousel" } };
    case "SHIPPING_INFO_BANNERS":
      return {
        type: "SHIPPING_INFO_BANNERS",
        config: {
          items: [
            { show: true, icon: "SHIPPING", imageUrl: null, title: "Envíos a todo el país", description: "Despachamos a cualquier ciudad de Colombia.", link: "" },
            { show: true, icon: "PAYMENT", imageUrl: null, title: "Pagos seguros", description: "Tarjeta, PSE y más, con confirmación al instante.", link: "" },
            { show: true, icon: "RETURNS", imageUrl: null, title: "Cambios y garantía", description: "Si algo llega mal, lo resolvemos.", link: "" },
            { show: true, icon: "SECURITY", imageUrl: null, title: "Compra protegida", description: "Tus datos y tu pago van cifrados.", link: "" },
          ],
        },
      };
    case "INSTAGRAM_CTA":
      return { type: "INSTAGRAM_CTA", config: { title: "Síguenos en Instagram", description: "Novedades, ideas y lanzamientos primero allá." } };
    case "PRODUCT_CATALOG":
      return { type: "PRODUCT_CATALOG", config: { title: section.title } };
  }
}

/// Los ajustes del tema que ayudan a vender, solo donde falten (ver
/// planSettings): sellos de confianza en la ficha, botón de compra
/// flotante y ahorro visible, sugerencias en el carrito, buscador, y el pie con contacto y páginas. El "Nosotros" lo
/// escribe la marca, no la IA (pedido del 2026-10-19).
function settingsPatch(settings: StoreSettingsPlan, catalog: Catalog, summary: ApplySummary): Record<string, unknown> {
  const theme = catalog.theme;
  const patch: Record<string, unknown> = {};
  const productDetail: Record<string, unknown> = {};
  if (settings.purchaseInfo && !catalog.facts.hasPurchaseInfo) {
    productDetail.purchaseInfo = [
      { show: true, icon: "SHIPPING", title: "Envíos a todo el país", description: "Despachamos a cualquier ciudad de Colombia." },
      { show: true, icon: "PAYMENT", title: "Pagos seguros", description: "Tarjeta, PSE y más, con confirmación al instante." },
      { show: true, icon: "RETURNS", title: "Cambios y garantía", description: "Si algo llega mal, lo resolvemos." },
    ];
    summary.settings.push("sellos de confianza en la ficha");
  }
  if (!theme.productDetail.floatingAddToCart) {
    productDetail.floatingAddToCart = true;
    summary.settings.push("botón de compra flotante");
  }
  if (!theme.productDetail.showSavedAmount) {
    productDetail.showSavedAmount = true;
    summary.settings.push("ahorro visible en los descuentos");
  }
  if (Object.keys(productDetail).length > 0) patch.productDetail = productDetail;
  if (settings.cartSuggestions && !theme.cart.suggestComplementary) {
    patch.cart = { suggestComplementary: true };
    summary.settings.push("sugerencias en el carrito");
  }
  if (!theme.header.showSearch) {
    patch.header = { showSearch: true };
    summary.settings.push("buscador visible");
  }
  const footer: Record<string, unknown> = {};
  if (settings.footerContact && !theme.footer.contact.show) {
    footer.contact = { show: true };
    summary.settings.push("contacto en el pie de página");
  }
  if (settings.footerPages && !theme.footer.menuSecondary.show) {
    footer.menuSecondary = { show: true, title: theme.footer.menuSecondary.title || "Información" };
    summary.settings.push("páginas de información en el pie de página");
  }
  if (Object.keys(footer).length > 0) patch.footer = footer;
  return patch;
}

/// Aplica el plan tal como se mostró (el que devolvió previewStoreOrganizer),
/// guardando antes una copia para deshacer.
export async function applyStoreOrganizer(brandId: string, plan: OrganizerPlan): Promise<ApplySummary> {
  const catalog = await loadCatalog(brandId);
  const ownedProducts = new Set(catalog.products.map((p) => p.id));
  const ownedCollections = new Set(catalog.collections.map((c) => c.id));
  const planned = flattenPlanned(plan.collections).map((c) => ({
    ...c,
    existingId: c.existingId && ownedCollections.has(c.existingId) ? c.existingId : null,
    productIds: c.productIds.filter((id) => ownedProducts.has(id)),
  }));
  if (planned.every((c) => c.productIds.length === 0)) throw new StoreOrganizerError("El plan no tiene productos.");

  const snapshot = await snapshotStore(brandId, Array.from(ownedProducts));
  const summary: ApplySummary = {
    source: plan.source,
    collections: { created: 0, updated: 0, removed: 0, subcollections: plan.collections.reduce((n, c) => n + c.children.length, 0) },
    products: { placed: 0, renamed: 0 },
    menu: 0,
    home: 0,
    families: 0,
    kept: 0,
    banners: 0,
    announcement: false,
    descriptions: 0,
    collectionBanners: 0,
    settings: [],
  };
  const theme = catalog.theme;

  // 1. Las colecciones que sobran se van (quedan en la copia).
  const kept = new Set(planned.map((c) => c.existingId).filter((id): id is string => Boolean(id)));
  const removed = catalog.collections.filter((c) => !kept.has(c.id));
  if (removed.length > 0) {
    await prisma.brandCollection.deleteMany({ where: { brandId, id: { in: removed.map((c) => c.id) } } });
    summary.collections.removed = removed.length;
  }

  // 2. Colecciones del plan, en orden de demanda (principales primero,
  // después las subcolecciones), cada una con sus productos en orden.
  const idByKey = new Map<string, string>();
  const slugByKey = new Map<string, string>();
  const imageByKey = new Map<string, string | null>();
  const mains = plan.collections.map((c) => c.key);
  const ordered = [...planned.filter((c) => mains.includes(c.key)), ...planned.filter((c) => !mains.includes(c.key))];
  for (const [position, c] of ordered.entries()) {
    const data = {
      name: c.name.slice(0, 80),
      description: c.description ? c.description.slice(0, 500) : null,
      imageUrl: c.imageUrl,
      position,
      sortOrder: "MANUAL" as const,
    };
    let id: string;
    let slug: string;
    if (c.existingId) {
      const existing = catalog.collections.find((x) => x.id === c.existingId)!;
      slug = existing.slug;
      const updated = await prisma.brandCollection.update({
        where: { id: c.existingId },
        data: { ...data, imageUrl: existing.imageUrl ?? c.imageUrl, description: existing.description || data.description },
        select: { id: true, imageUrl: true },
      });
      id = updated.id;
      imageByKey.set(c.key, updated.imageUrl);
      summary.collections.updated++;
    } else {
      slug = await uniqueCollectionSlug(brandId, slugify(c.slug) || slugify(c.name), null);
      const created = await prisma.brandCollection.create({ data: { brandId, slug, ...data }, select: { id: true, imageUrl: true } });
      id = created.id;
      imageByKey.set(c.key, created.imageUrl);
      summary.collections.created++;
    }
    idByKey.set(c.key, id);
    slugByKey.set(c.key, slug);
    // Banner de la página de la colección, pintado con el estilo de la
    // tienda, para las principales que no tienen uno propio.
    const hadBanner = c.existingId ? catalog.collections.find((x) => x.id === c.existingId)?.bannerUrl : null;
    const collectionImage = imageByKey.get(c.key) ?? null;
    if (plan.collectionBanners && mains.includes(c.key) && !hadBanner && collectionImage) {
      const banners = signedBanners(themeBannerSpec(theme, { title: c.name.slice(0, 60), subtitle: c.description.slice(0, 120), cta: "", image: collectionImage }));
      if (banners) {
        await prisma.brandCollection.update({ where: { id }, data: { bannerUrl: banners.wide, bannerMobileUrl: banners.mobile } });
        summary.collectionBanners++;
      }
    }
    await prisma.$transaction([
      prisma.productBrandCollection.deleteMany({ where: { collectionId: id } }),
      ...(c.productIds.length > 0
        ? [prisma.productBrandCollection.createMany({ data: c.productIds.map((productId, i) => ({ productId, collectionId: id, position: i })) })]
        : []),
    ]);
    summary.products.placed += c.productIds.length;
  }

  // 3. Los links de las colecciones que desaparecieron llevan a la que
  // recibió sus productos (los menús viejos, Google, lo compartido).
  const redirects: { fromPath: string; toPath: string }[] = [];
  for (const r of plan.removedCollections) {
    const target = r.movedTo ? planned.find((c) => c.name === r.movedTo) : null;
    const slug = target ? slugByKey.get(target.key) : null;
    const old = catalog.collections.find((c) => c.id === r.id);
    if (!old || !slug || old.slug === slug) continue;
    redirects.push({ fromPath: `/coleccion/${old.slug}`, toPath: `/coleccion/${slug}` });
  }
  if (redirects.length > 0) {
    await saveRedirects(brandId, redirects);
    snapshot.redirects = redirects.map((r) => r.fromPath);
  }

  // 4. Nombres de producto (por tandas, en una sola ida a la base cada una).
  const renames = plan.productNames.filter((r) => ownedProducts.has(r.id) && r.to.trim().length >= 2);
  for (let i = 0; i < renames.length; i += 100) {
    const chunk = renames.slice(i, i + 100);
    await prisma.$transaction(chunk.map((r) => prisma.product.update({ where: { id: r.id }, data: { name: r.to.trim().slice(0, 255) } })));
    summary.products.renamed += chunk.length;
  }

  // 4b. Fichas escritas por la IA, solo para productos que hoy no tienen
  // ninguna (una ficha existente nunca se toca). Lo anterior queda en la
  // copia y el HTML se sanea como cualquier descripción que entra.
  const proposed = plan.productDescriptions.filter((d) => ownedProducts.has(d.id) && d.html.trim().length > 0);
  if (proposed.length > 0) {
    const current = await prisma.product.findMany({ where: { brandId, id: { in: proposed.map((d) => d.id) } }, select: { id: true, description: true } });
    const empty = new Set(current.filter((p) => stripHtml(p.description ?? "", 50).trim().length === 0).map((p) => p.id));
    const descriptions = proposed.filter((d) => empty.has(d.id));
    snapshot.productDescriptions = current.filter((p) => empty.has(p.id)).map((p) => ({ id: p.id, description: p.description }));
    for (let i = 0; i < descriptions.length; i += 50) {
      const chunk = descriptions.slice(i, i + 50);
      await prisma.$transaction(chunk.map((d) => prisma.product.update({ where: { id: d.id }, data: { description: sanitizeProductDescription(d.html).slice(0, 20000) } })));
      summary.descriptions += chunk.length;
    }
  }

  // 5. Menú.
  const menu = await replaceStorefrontMenu(brandId, menuToBuilt(plan.menu, slugByKey), true);
  summary.menu = menu.items;

  // 6. Portada: se reemplaza, conservando las secciones que el plan marcó
  // (KEEP: banners, videos o fotos importadas que aportan). El banner
  // nuevo se pinta con los colores y la letra del tema publicado.
  const ownedSections = new Set((await prisma.storefrontSection.findMany({ where: { brandId }, select: { id: true } })).map((s) => s.id));
  const keepIds = plan.home.flatMap((s) => (s.type === "KEEP" && ownedSections.has(s.sectionId) ? [s.sectionId] : []));
  await prisma.storefrontSection.deleteMany({ where: { brandId, id: { notIn: keepIds } } });
  let position = 0;
  for (const section of plan.home) {
    if (section.type === "KEEP") {
      if (!ownedSections.has(section.sectionId)) continue;
      await prisma.storefrontSection.update({ where: { id: section.sectionId }, data: { position: position++, enabled: true } });
      summary.kept++;
      summary.home++;
      continue;
    }
    const built = sectionConfig(section, { idByKey, slugByKey, imageByKey, theme });
    if (!built) continue;
    let config: unknown;
    try {
      config = parseSectionConfig(built.type, built.config);
    } catch {
      continue;
    }
    await prisma.storefrontSection.create({ data: { brandId, type: built.type, config: config as Prisma.InputJsonValue, position: position++ } });
    summary.home++;
    if (built.generated) summary.banners++;
  }

  // 7. Ajustes del tema que ayudan a vender y la barra de anuncio (solo
  // si la tienda no tiene una). Van sobre borrador y publicado; el tema
  // entero de antes queda en la copia para deshacer.
  const draft = await getDraftTheme(brandId);
  const patch = settingsPatch(plan.settings, catalog, summary);
  const announcement = plan.announcement?.trim();
  if (announcement && !announcementText(draft) && !announcementText(theme)) {
    patch.announcementBar = { enabled: true, messages: [{ text: announcement.slice(0, 200), link: "" }] };
    summary.announcement = true;
  }
  if (Object.keys(patch).length > 0) {
    snapshot.theme = { draft, published: theme };
    await patchPublishedTheme(brandId, patch);
  }

  // 8. Familias (otros tonos/aromas/tamaños) sobre los nombres nuevos.
  try {
    summary.families = (await applyProductFamilies(brandId)).families;
  } catch (err) {
    console.error("[organizador] familias:", err instanceof Error ? err.message : err);
  }

  await prisma.storeOrganizerRun.create({
    data: { brandId, source: plan.source, summary: summary as unknown as Prisma.InputJsonValue, snapshot: snapshot as unknown as Prisma.InputJsonValue },
  });
  return summary;
}

// ---------------------------------------------------------------------------
// Deshacer
// ---------------------------------------------------------------------------

/// Vuelve a dejar la tienda como estaba antes de la última organización:
/// colecciones (con sus productos y su orden), menú, portada y nombres.
export async function undoStoreOrganizer(brandId: string): Promise<{ restored: { collections: number; menu: number; sections: number; products: number; descriptions: number } }> {
  const run = await prisma.storeOrganizerRun.findFirst({ where: { brandId, status: "APPLIED" }, orderBy: { createdAt: "desc" } });
  if (!run) throw new StoreOrganizerError("No hay una organización para deshacer.");
  const snapshot = run.snapshot as unknown as Snapshot;
  const owned = new Set((await prisma.product.findMany({ where: { brandId }, select: { id: true } })).map((p) => p.id));

  await prisma.brandCollection.deleteMany({ where: { brandId } });
  for (const c of snapshot.collections) {
    const products = c.products.filter((p) => owned.has(p.productId));
    await prisma.brandCollection.create({
      data: {
        id: c.id,
        brandId,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
        bannerUrl: c.bannerUrl,
        bannerMobileUrl: c.bannerMobileUrl,
        position: c.position,
        sortOrder: c.sortOrder as "MANUAL",
        products: { create: products.map((p) => ({ productId: p.productId, position: p.position })) },
      },
    });
  }

  await prisma.storefrontMenuItem.deleteMany({ where: { brandId } });
  const pending = snapshot.menu.slice();
  const inserted = new Set<string>();
  // Los padres antes que los hijos (hasta tres niveles).
  for (let round = 0; round < 4 && pending.length > 0; round++) {
    for (const item of pending.slice()) {
      if (item.parentId && !inserted.has(item.parentId)) continue;
      await prisma.storefrontMenuItem.create({ data: { id: item.id, brandId, label: item.label, url: item.url, parentId: item.parentId, position: item.position } });
      inserted.add(item.id);
      pending.splice(pending.indexOf(item), 1);
    }
  }

  await prisma.storefrontSection.deleteMany({ where: { brandId } });
  for (const s of snapshot.sections) {
    await prisma.storefrontSection.create({
      data: { brandId, type: s.type as SectionType, enabled: s.enabled, position: s.position, config: (s.config ?? {}) as Prisma.InputJsonValue },
    });
  }

  let products = 0;
  for (const p of snapshot.productNames) {
    if (!owned.has(p.id)) continue;
    await prisma.product.update({ where: { id: p.id }, data: { name: p.name } });
    products++;
  }
  if (snapshot.redirects?.length) {
    await prisma.storefrontRedirect.deleteMany({ where: { brandId, fromPath: { in: snapshot.redirects } } });
  }
  let descriptions = 0;
  for (const d of snapshot.productDescriptions ?? []) {
    if (!owned.has(d.id)) continue;
    await prisma.product.update({ where: { id: d.id }, data: { description: d.description } });
    descriptions++;
  }
  if (snapshot.theme) {
    await restoreThemeConfigs(brandId, snapshot.theme.draft, snapshot.theme.published);
  } else if (snapshot.announcementBar) {
    await patchPublishedTheme(
      brandId,
      { announcementBar: snapshot.announcementBar.published as Record<string, unknown> },
      { announcementBar: snapshot.announcementBar.draft as Record<string, unknown> },
    );
  }
  await prisma.storeOrganizerRun.update({ where: { id: run.id }, data: { status: "REVERTED", revertedAt: new Date() } });
  return { restored: { collections: snapshot.collections.length, menu: inserted.size, sections: snapshot.sections.length, products, descriptions } };
}

// ---------------------------------------------------------------------------
// Reorden por ventas (cada noche)
// ---------------------------------------------------------------------------

export type ReorderResult = { collections: number; products: number; menu: boolean; bestSellers: boolean };

/// Con las ventas reales de Marcolini: dentro de cada colección lo más
/// vendido sube y lo agotado baja; las colecciones y el menú se ordenan
/// por demanda; la sección "Los más vendidos" se actualiza. No toca
/// nombres ni estructura.
export async function reorderStoreByDemand(brandId: string): Promise<ReorderResult> {
  const catalog = await loadCatalog(brandId);
  const byId = new Map(catalog.products.map((p) => [p.id, p]));
  const scores = scoreProducts(catalog.products);
  const result: ReorderResult = { collections: 0, products: 0, menu: false, bestSellers: false };

  const demand = new Map<string, number>();
  for (const c of catalog.collections) {
    const ranked = rankProductIds(c.productIds, scores, byId);
    demand.set(c.id, collectionDemand(ranked, scores, byId));
    const changed = ranked.map((id, position) => ({ id, position })).filter((r) => c.productIds[r.position] !== r.id);
    if (changed.length === 0) continue;
    await prisma.$transaction(
      ranked.map((productId, position) =>
        prisma.productBrandCollection.update({ where: { productId_collectionId: { productId, collectionId: c.id } }, data: { position } }),
      ),
    );
    result.collections++;
    result.products += changed.length;
  }

  // Colecciones por demanda ("Otros productos" siempre de último).
  const isOther = (name: string) => normalizeText(name) === normalizeText(OTHER_COLLECTION_NAME);
  const orderedCollections = catalog.collections
    .slice()
    .sort((a, b) => (isOther(a.name) ? 1 : 0) - (isOther(b.name) ? 1 : 0) || (demand.get(b.id) ?? 0) - (demand.get(a.id) ?? 0) || a.position - b.position);
  if (orderedCollections.some((c, position) => c.position !== position)) {
    await prisma.$transaction(orderedCollections.map((c, position) => prisma.brandCollection.update({ where: { id: c.id }, data: { position } })));
  }

  // El menú: los ítems de colección de arriba siguen el mismo orden; lo
  // que no es colección (Inicio, Más, Todos) se queda donde está.
  const demandBySlug = new Map(catalog.collections.map((c) => [c.slug, demand.get(c.id) ?? 0]));
  const top = await prisma.storefrontMenuItem.findMany({ where: { brandId, parentId: null }, orderBy: { position: "asc" } });
  const slots = top.map((m) => m.url.match(/^\/coleccion\/([^/?#]+)$/)?.[1] ?? null);
  const collectionItems = top.filter((_, i) => slots[i] && demandBySlug.has(slots[i]!));
  const sorted = collectionItems.slice().sort((a, b) => demandBySlug.get(b.url.slice("/coleccion/".length))! - demandBySlug.get(a.url.slice("/coleccion/".length))!);
  let next = 0;
  const reordered = top.map((m, i) => (slots[i] && demandBySlug.has(slots[i]!) ? sorted[next++] : m));
  if (reordered.some((m, i) => m.id !== top[i].id)) {
    await prisma.$transaction(reordered.map((m, position) => prisma.storefrontMenuItem.update({ where: { id: m.id }, data: { position } })));
    result.menu = true;
  }

  // "Los más vendidos" / "Destacados" en la portada.
  const best = bestSellerIds(catalog.products, scores);
  const sections = await prisma.storefrontSection.findMany({ where: { brandId, type: "FEATURED_PRODUCTS" } });
  for (const s of sections) {
    const config = s.config as { title?: string; display?: string; productIds?: string[] };
    if (config.title !== BEST_SELLERS_TITLE && config.title !== FEATURED_TITLE) continue;
    if (best.ids.length < 4) continue;
    if (config.title === best.title && JSON.stringify(config.productIds ?? []) === JSON.stringify(best.ids)) continue;
    await prisma.storefrontSection.update({
      where: { id: s.id },
      data: { config: { ...config, title: best.title, display: config.display ?? "carousel", productIds: best.ids } as Prisma.InputJsonValue },
    });
    result.bestSellers = true;
  }
  return result;
}

/// Todas las marcas con el organizador aplicado (su última corrida no se
/// deshizo).
export async function reorderOrganizedBrands(): Promise<{ brandId: string; result: ReorderResult | null; error?: string }[]> {
  const runs = await prisma.storeOrganizerRun.findMany({ orderBy: { createdAt: "desc" }, select: { brandId: true, status: true } });
  const latest = new Map<string, "APPLIED" | "REVERTED">();
  for (const run of runs) if (!latest.has(run.brandId)) latest.set(run.brandId, run.status);
  const out: { brandId: string; result: ReorderResult | null; error?: string }[] = [];
  for (const [brandId, status] of latest) {
    if (status !== "APPLIED") continue;
    try {
      out.push({ brandId, result: await reorderStoreByDemand(brandId) });
    } catch (err) {
      out.push({ brandId, result: null, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}
