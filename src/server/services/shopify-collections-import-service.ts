import type { CollectionSortOrder } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/shopify-csv";
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

const MAX_MENU_ITEMS = 12;

function nameKey(name: string) {
  return name.trim().toLowerCase();
}

export async function importShopifyCollections(
  brandId: string,
  data: { collections: ImportCollectionInput[]; menu?: ImportMenuInput | null },
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
    // Las colecciones que ya existían también pueden estar en el menú de
    // Shopify (su slug suele ser el mismo handle).
    for (const c of existing) if (!collectionSlugByHandle.has(c.slug)) collectionSlugByHandle.set(c.slug, c.slug);
    const productSlugByHandle = new Map<string, string>();
    for (const p of products) if (p.slug) productSlugByHandle.set(handleOf(p.externalId), p.slug);
    const items: { label: string; url: string }[] = [];
    const seenUrl = new Set<string>();
    for (const link of data.menu.links) {
      const url = mapShopifyMenuHref(link.href, { collectionSlugByHandle, productSlugByHandle });
      const label = link.label.trim().slice(0, 60);
      if (!url || !label || seenUrl.has(url)) continue;
      seenUrl.add(url);
      items.push({ label, url });
      if (items.length >= MAX_MENU_ITEMS) break;
    }
    // Sin menú legible en Shopify: una entrada por colección importada.
    if (items.length === 0) {
      for (const r of results) {
        if (r.action === "error") continue;
        items.push({ label: r.name, url: `/coleccion/${r.slug}` });
        if (items.length >= MAX_MENU_ITEMS) break;
      }
    }
    if (items.length > 0) {
      const count = await prisma.storefrontMenuItem.count({ where: { brandId } });
      if (data.menu.replace && count > 0) await prisma.storefrontMenuItem.deleteMany({ where: { brandId } });
      const offset = data.menu.replace ? 0 : count;
      await prisma.storefrontMenuItem.createMany({
        data: items.map((item, i) => ({ brandId, label: item.label, url: item.url, position: offset + i })),
      });
      menu = { items: items.length, replaced: data.menu.replace && count > 0 };
    } else {
      menu = { items: 0, replaced: false };
    }
  }

  return { collections: results, menu };
}
