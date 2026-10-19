import type { CollectionSortOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MENU_MAX_DEPTH } from "@/lib/menu-tree";
import { slugify } from "@/lib/shopify-csv";
import { saveRedirects } from "@/server/services/storefront-redirect-service";
import { publishTheme, updateDraftTheme } from "@/server/services/brand-theme-store";
import { mapShopifyMenuHref, type ShopifyMenuLink } from "@/lib/shopify-theme";
import {
  BrandCollectionError,
  createBrandCollection,
  nextCollectionPositions,
} from "@/server/services/brand-collection-service";
import { EXTERNAL_ID_PREFIX } from "@/server/services/shopify-csv-import-service";

/// Crea (o completa) las colecciones de la marca tal como las tiene en
/// Shopify y mete cada producto importado en la suya, en el orden de la
/// colección; después arma el menú de la vitrina a partir del menú de
/// Shopify (o de las colecciones, si el menú no se pudo leer). Los
/// productos se buscan por su externalId "shopify-csv-{handle}", así que
/// se importan primero (ver shopify-importer.tsx). Ver conversación del
/// 2026-10-17.

export type ImportCollectionInput = {
  handle: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: CollectionSortOrder | null;
  productHandles: string[];
};

export type ImportCollectionResult = {
  handle: string;
  name: string;
  slug: string;
  action: "created" | "updated" | "error";
  /// Productos que quedaron en la colección / que no se encontraron acá.
  linked: number;
  missing: number;
  error?: string;
};

export type ImportMenuInput = {
  links: ShopifyMenuLink[];
  /// true = el menú actual se reemplaza; false = los links se agregan al final.
  replace: boolean;
};

/// Desde cuántas entradas el menú importado pasa al panel lateral en celular.
const HAMBURGER_FROM_ITEMS = 5;
const MAX_MENU_ITEMS = 12;
const MAX_MENU_CHILDREN = 24;

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

export async function importShopifyCollections(
  brandId: string,
  data: {
    collections: ImportCollectionInput[];
    menu?: ImportMenuInput | null;
    /// Páginas ya importadas (handle de Shopify → slug acá), para que los
    /// links "/pages/x" del menú apunten a /pagina/{slug}.
    pageLinks?: { handle: string; slug: string }[];
    /// Handles de la tienda vieja que se unieron en cada colección (ver
    /// collection-merge.ts): sus links viejos también deben llegar acá.
    aliases?: Record<string, string[]>;
  },
) {
  const products = await prisma.product.findMany({
    where: { brandId, externalId: { startsWith: EXTERNAL_ID_PREFIX } },
    select: { id: true, externalId: true, slug: true },
  });
  const handleOf = (externalId: string) => externalId.slice(EXTERNAL_ID_PREFIX.length).toLowerCase();
  const productByHandle = new Map(products.map((p) => [handleOf(p.externalId), p]));

  const existing = await prisma.brandCollection.findMany({
    where: { brandId },
    select: { id: true, name: true, slug: true, description: true, imageUrl: true },
  });
  const bySlug = new Map(existing.map((c) => [c.slug, c]));
  const byName = new Map(existing.map((c) => [nameKey(c.name), c]));
  const collectionSlugByHandle = new Map<string, string>();
  const results: ImportCollectionResult[] = [];

  for (const input of data.collections) {
    const handle = input.handle.trim().toLowerCase();
    const name = input.name.trim();
    try {
      // La misma colección puede existir ya: creada a mano, por el Tipo
      // de producto de una importación anterior, o por este mismo
      // importador. Se reconoce por slug o por nombre y se completa, no
      // se duplica.
      const found = bySlug.get(slugify(handle)) ?? bySlug.get(slugify(name)) ?? byName.get(nameKey(name));
      let collection: { id: string; name: string; slug: string };
      let action: "created" | "updated";
      if (found) {
        collection = await prisma.brandCollection.update({
          where: { id: found.id },
          data: {
            ...(!found.description && input.description ? { description: input.description.slice(0, 500) } : {}),
            ...(!found.imageUrl && input.imageUrl ? { imageUrl: input.imageUrl } : {}),
          },
          select: { id: true, name: true, slug: true },
        });
        action = "updated";
      } else {
        const created = await createBrandCollection(brandId, {
          name,
          description: input.description ?? undefined,
          imageUrl: input.imageUrl ?? undefined,
          sortOrder: input.sortOrder ?? "MANUAL",
        });
        collection = { id: created.id, name: created.name, slug: created.slug };
        const row = { ...collection, description: created.description, imageUrl: created.imageUrl };
        bySlug.set(created.slug, row);
        byName.set(nameKey(created.name), row);
        action = "created";
      }
      collectionSlugByHandle.set(handle, collection.slug);

      // Membresías: se suman las que faltan, al final y en el orden de
      // Shopify; lo que la marca ya tenía en la colección se respeta.
      const ids: string[] = [];
      const seen = new Set<string>();
      let missing = 0;
      for (const productHandle of input.productHandles) {
        const product = productByHandle.get(productHandle.trim().toLowerCase());
        if (!product) {
          missing++;
          continue;
        }
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        ids.push(product.id);
      }
      const current = await prisma.productBrandCollection.findMany({
        where: { collectionId: collection.id },
        select: { productId: true },
      });
      const currentIds = new Set(current.map((c) => c.productId));
      const toAdd = ids.filter((id) => !currentIds.has(id));
      if (toAdd.length > 0) {
        const next = (await nextCollectionPositions([collection.id])).get(collection.id) ?? 0;
        await prisma.productBrandCollection.createMany({
          data: toAdd.map((productId, i) => ({ productId, collectionId: collection.id, position: next + i })),
          skipDuplicates: true,
        });
      }
      results.push({ handle, name: collection.name, slug: collection.slug, action, linked: ids.length, missing });
      // Los links viejos de esta colección (y de las que se unieron en
      // ella) siguen funcionando — ver storefront-redirect-service.ts.
      await saveRedirects(
        brandId,
        [handle, ...(data.aliases?.[handle] ?? [])].map((h) => ({ fromPath: `/collections/${h}`, toPath: `/coleccion/${collection.slug}` })),
      );
    } catch (err) {
      console.error(`[colecciones-shopify] "${handle}":`, err);
      results.push({
        handle,
        name,
        slug: "",
        action: "error",
        linked: 0,
        missing: 0,
        error: err instanceof BrandCollectionError ? err.message : "No se pudo crear esta colección.",
      });
    }
  }

  let menu: { items: number; replaced: boolean } | null = null;
  if (data.menu) {
    const maps = await menuMapsFor(brandId, data.pageLinks ?? [], collectionSlugByHandle);
    const { items } = buildMenuItems(data.menu.links, maps);
    // Sin menú legible en la tienda vieja: una entrada por colección importada.
    if (items.length === 0) {
      for (const r of results) {
        if (r.action === "error") continue;
        items.push({ label: r.name, url: `/coleccion/${r.slug}`, children: [] });
        if (items.length >= MAX_MENU_ITEMS) break;
      }
    }
    menu = items.length > 0 ? await replaceStorefrontMenu(brandId, items, data.menu.replace) : { items: 0, replaced: false };
  }

  return { collections: results, menu };
}

// ----------------------------------------------------------------------------
// Menú: traducir los links de la tienda vieja a la vitrina y guardarlos.
// Lo usa esta importación y la herramienta "Traer el menú de la tienda
// original" (ver storefront-menu-import-service.ts).
// ----------------------------------------------------------------------------

export type MenuMaps = {
  collectionSlugByHandle: Map<string, string>;
  productSlugByHandle: Map<string, string>;
  pageSlugByHandle: Map<string, string>;
};

export type BuiltMenuItem = { label: string; url: string; children: BuiltMenuItem[] };

/// Con qué se traducen los links: los productos y colecciones que ya
/// existen en Marcolini (su slug suele ser el mismo handle), las páginas
/// importadas y, si vienen de una importación, las colecciones recién
/// creadas (handle → slug).
export async function menuMapsFor(
  brandId: string,
  pageLinks: { handle: string; slug: string }[],
  collectionSlugByHandle: Map<string, string> = new Map(),
): Promise<MenuMaps> {
  const [products, collections] = await Promise.all([
    prisma.product.findMany({ where: { brandId, externalId: { startsWith: EXTERNAL_ID_PREFIX } }, select: { externalId: true, slug: true } }),
    prisma.brandCollection.findMany({ where: { brandId }, select: { slug: true } }),
  ]);
  const collectionMap = new Map(collectionSlugByHandle);
  for (const c of collections) if (!collectionMap.has(c.slug)) collectionMap.set(c.slug, c.slug);
  const productSlugByHandle = new Map<string, string>();
  for (const p of products) if (p.slug) productSlugByHandle.set(p.externalId.slice(EXTERNAL_ID_PREFIX.length).toLowerCase(), p.slug);
  const pageSlugByHandle = new Map(pageLinks.map((l) => [l.handle.trim().toLowerCase(), l.slug]));
  return { collectionSlugByHandle: collectionMap, productSlugByHandle, pageSlugByHandle };
}

/// El menú con sus submenús (hasta tres niveles) ya apuntando a la
/// vitrina: un padre sin equivalente acá pero con submenú queda como "#"
/// (solo lo abre); un link sin equivalente y sin submenú se omite (y se
/// devuelve en `dropped` para poder mostrarlo).
export function buildMenuItems(links: ShopifyMenuLink[], maps: MenuMaps): { items: BuiltMenuItem[]; dropped: { label: string; href: string }[] } {
  const dropped: { label: string; href: string }[] = [];
  const build = (list: ShopifyMenuLink[], depth: number): BuiltMenuItem[] => {
    const out: BuiltMenuItem[] = [];
    const seenUrl = new Set<string>();
    for (const link of list) {
      const children = depth < MENU_MAX_DEPTH ? build(link.children ?? [], depth + 1) : [];
      const mapped = mapShopifyMenuHref(link.href, maps);
      const url = mapped && mapped !== "#" ? mapped : children.length > 0 ? "#" : null;
      const label = link.label.trim().slice(0, 60);
      if (!url || !label) {
        if (label) dropped.push({ label, href: link.href });
        continue;
      }
      if (url !== "#" && seenUrl.has(url)) continue;
      if (url !== "#") seenUrl.add(url);
      out.push({ label, url, children });
      if (out.length >= (depth === 1 ? MAX_MENU_ITEMS : MAX_MENU_CHILDREN)) break;
    }
    return out;
  };
  return { items: build(links, 1), dropped };
}

/// Guarda el menú (reemplazando el anterior o sumándolo al final) y, con
/// varias entradas o submenús, pasa el menú de celular al panel lateral.
export async function replaceStorefrontMenu(brandId: string, items: BuiltMenuItem[], replace: boolean): Promise<{ items: number; replaced: boolean }> {
  const count = await prisma.storefrontMenuItem.count({ where: { brandId, parentId: null } });
  if (replace && count > 0) await prisma.storefrontMenuItem.deleteMany({ where: { brandId } });
  const offset = replace ? 0 : count;
  let created = 0;
  const insert = async (list: BuiltMenuItem[], parentId: string | null, start: number) => {
    for (const [i, item] of list.entries()) {
      const row = await prisma.storefrontMenuItem.create({
        data: { brandId, label: item.label, url: item.url, parentId, position: start + i },
      });
      created++;
      if (item.children.length > 0) await insert(item.children, row.id, 0);
    }
  };
  await insert(items, null, offset);
  // Con varias entradas o submenús, en celular el menú va en el panel
  // lateral (hamburguesa): la fila deslizable no es práctica. Ver
  // conversación del 2026-10-18.
  if (items.length >= HAMBURGER_FROM_ITEMS || items.some((i) => i.children.length > 0)) {
    await updateDraftTheme(brandId, { header: { mobile: { menuStyle: "hamburger" } } });
    await publishTheme(brandId);
  }
  return { items: created, replaced: replace && count > 0 };
}
