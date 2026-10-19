import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stripHtml } from "@/lib/sanitize-html";
import { slugify } from "@/lib/shopify-csv";
import { parseSectionConfig, type SectionType } from "@/lib/storefront-sections";
import {
  bestSellerIds,
  BEST_SELLERS_TITLE,
  buildPlan,
  collectionDemand,
  FEATURED_TITLE,
  rankProductIds,
  scoreProducts,
  type HomeSectionPlan,
  type OrganizerCollection,
  type OrganizerPlan,
  type OrganizerProduct,
  type PlannedCollection,
  type PlannedMenuItem,
} from "@/lib/store-organizer";
import { normalizeText, OTHER_COLLECTION_NAME } from "@/lib/shopify-categorize";
import { proposeStructure, sectorFromVertical } from "@/server/services/store-organizer-ai-service";
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
  brand: { companyName: string; instagramHandle: string | null; phone: string | null; sector: string };
  keepsBanner: boolean;
};

async function loadCatalog(brandId: string): Promise<Catalog> {
  const since = new Date(Date.now() - SALES_WINDOW_DAYS * 86_400_000);
  const [brand, rows, collections, sales, reviews, sections] = await Promise.all([
    prisma.brandProfile.findUnique({
      where: { id: brandId },
      select: { companyName: true, instagramHandle: true, phone: true, vertical: { select: { name: true } } },
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
        variants: { select: { stock: true } },
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
    prisma.storefrontSection.findMany({ where: { brandId, enabled: true, type: "BANNER" }, select: { config: true } }),
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

  const keepsBanner = sections.some((s) => {
    const config = s.config as { slides?: { imageUrl?: string }[]; imageUrl?: string } | null;
    return Boolean(config?.slides?.some((slide) => slide.imageUrl) || config?.imageUrl);
  });

  return {
    products,
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      position: c.position,
      productIds: c.products.map((p) => p.productId),
    })),
    brand: {
      companyName: brand.companyName,
      instagramHandle: brand.instagramHandle,
      phone: brand.phone,
      sector: sectorFromVertical(brand.vertical?.name),
    },
    keepsBanner,
  };
}

export type OrganizerLastRun = { id: string; status: "APPLIED" | "REVERTED"; source: string; createdAt: Date; summary: ApplySummary } | null;

export async function lastOrganizerRun(brandId: string): Promise<OrganizerLastRun> {
  const run = await prisma.storeOrganizerRun.findFirst({ where: { brandId }, orderBy: { createdAt: "desc" } });
  return run ? { id: run.id, status: run.status, source: run.source, createdAt: run.createdAt, summary: run.summary as ApplySummary } : null;
}

/// El plan completo, sin tocar nada.
export async function previewStoreOrganizer(brandId: string): Promise<OrganizerPlan> {
  const catalog = await loadCatalog(brandId);
  if (catalog.products.length === 0) throw new StoreOrganizerError("La tienda no tiene productos todavía.");
  const { proposal, source } = await proposeStructure({
    products: catalog.products,
    collections: catalog.collections,
    storeName: catalog.brand.companyName,
    sector: catalog.brand.sector,
  });
  return buildPlan(catalog.products, catalog.collections, proposal, {
    source,
    instagram: Boolean(catalog.brand.instagramHandle),
    whatsapp: Boolean(catalog.brand.phone),
    keepsBanner: catalog.keepsBanner,
  });
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

function flatten(collections: PlannedCollection[]): PlannedCollection[] {
  return collections.flatMap((c) => [c, ...c.children]);
}

function menuToBuilt(items: PlannedMenuItem[], slugByKey: Map<string, string>): BuiltMenuItem[] {
  return items.map((item) => {
    const match = item.url.match(/^\/coleccion\/(.+)$/);
    const url = match && slugByKey.has(match[1]) ? `/coleccion/${slugByKey.get(match[1])}` : item.url;
    return { label: item.label, url, children: menuToBuilt(item.children, slugByKey) };
  });
}

function sectionConfig(section: HomeSectionPlan, ctx: { idByKey: Map<string, string>; slugByKey: Map<string, string>; imageByKey: Map<string, string | null>; whatsapp: string | null }): { type: SectionType; config: unknown } | null {
  switch (section.type) {
    case "BANNER": {
      const slug = ctx.slugByKey.get(section.collectionKey);
      if (!slug) return null;
      return {
        type: "BANNER",
        config: {
          aspectRatio: "horizontal",
          slides: [{ imageUrl: section.imageUrl, link: `/coleccion/${slug}` }],
          title: section.title,
          subtitle: section.subtitle,
          buttonText: section.buttonText,
          buttonLink: `/coleccion/${slug}`,
        },
      };
    }
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
    case "SHIPPING_INFO_BANNERS": {
      const whatsapp = section.whatsapp && ctx.whatsapp ? ctx.whatsapp.replace(/\D/g, "") : "";
      return {
        type: "SHIPPING_INFO_BANNERS",
        config: {
          items: [
            { show: true, icon: "SHIPPING", imageUrl: null, title: "Envíos a todo el país", description: "Despachamos a cualquier ciudad de Colombia.", link: "" },
            { show: true, icon: "PAYMENT", imageUrl: null, title: "Pagos seguros", description: "Tarjeta, PSE y más, con confirmación al instante.", link: "" },
            { show: true, icon: "RETURNS", imageUrl: null, title: "Cambios y garantía", description: "Si algo llega mal, lo resolvemos.", link: "" },
            whatsapp
              ? { show: true, icon: "SECURITY", imageUrl: null, title: "Asesoría por WhatsApp", description: "Te ayudamos a elegir antes de comprar.", link: `https://wa.me/${whatsapp}` }
              : { show: true, icon: "SECURITY", imageUrl: null, title: "Compra protegida", description: "Tus datos y tu pago van cifrados.", link: "" },
          ],
        },
      };
    }
    case "INSTAGRAM_CTA":
      return { type: "INSTAGRAM_CTA", config: { title: "Síguenos en Instagram", description: "Novedades, ideas y lanzamientos primero allá." } };
    case "PRODUCT_CATALOG":
      return { type: "PRODUCT_CATALOG", config: { title: section.title } };
  }
}

/// Aplica el plan tal como se mostró (el que devolvió previewStoreOrganizer),
/// guardando antes una copia para deshacer.
export async function applyStoreOrganizer(brandId: string, plan: OrganizerPlan): Promise<ApplySummary> {
  const catalog = await loadCatalog(brandId);
  const ownedProducts = new Set(catalog.products.map((p) => p.id));
  const ownedCollections = new Set(catalog.collections.map((c) => c.id));
  const planned = flatten(plan.collections).map((c) => ({
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
  };

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

  // 4. Nombres de producto.
  for (const rename of plan.productNames) {
    if (!ownedProducts.has(rename.id) || rename.to.trim().length < 2) continue;
    await prisma.product.update({ where: { id: rename.id }, data: { name: rename.to.trim().slice(0, 255) } });
    summary.products.renamed++;
  }

  // 5. Menú.
  const menu = await replaceStorefrontMenu(brandId, menuToBuilt(plan.menu, slugByKey), true);
  summary.menu = menu.items;

  // 6. Portada: se reemplaza; si la tienda tenía un banner con foto, ese
  // se conserva arriba (el plan no arma otro).
  const sections = await prisma.storefrontSection.findMany({ where: { brandId }, orderBy: { position: "asc" } });
  const keptBanner = catalog.keepsBanner
    ? sections.filter((s) => {
        const config = s.config as { slides?: { imageUrl?: string }[]; imageUrl?: string } | null;
        return s.type === "BANNER" && s.enabled && Boolean(config?.slides?.some((slide) => slide.imageUrl) || config?.imageUrl);
      }).slice(0, 1)
    : [];
  await prisma.storefrontSection.deleteMany({ where: { brandId, id: { notIn: keptBanner.map((s) => s.id) } } });
  let position = 0;
  for (const s of keptBanner) {
    await prisma.storefrontSection.update({ where: { id: s.id }, data: { position: position++ } });
  }
  for (const section of plan.home) {
    const built = sectionConfig(section, { idByKey, slugByKey, imageByKey, whatsapp: catalog.brand.phone });
    if (!built) continue;
    let config: unknown;
    try {
      config = parseSectionConfig(built.type, built.config);
    } catch {
      continue;
    }
    await prisma.storefrontSection.create({ data: { brandId, type: built.type, config: config as Prisma.InputJsonValue, position: position++ } });
    summary.home++;
  }

  // 7. Familias (otros tonos/aromas/tamaños) sobre los nombres nuevos.
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
export async function undoStoreOrganizer(brandId: string): Promise<{ restored: { collections: number; menu: number; sections: number; products: number } }> {
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
  await prisma.storeOrganizerRun.update({ where: { id: run.id }, data: { status: "REVERTED", revertedAt: new Date() } });
  return { restored: { collections: snapshot.collections.length, menu: inserted.size, sections: snapshot.sections.length, products } };
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
