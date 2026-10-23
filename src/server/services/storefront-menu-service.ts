import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isMenuPlaceholderUrl, type MenuNode } from "@/lib/menu-tree";
import { isSoldOut, stockWhere } from "@/lib/product-stock";
import { getPublishedTheme } from "@/server/services/brand-theme-store";
import { listStorefrontMenuTree } from "@/server/services/store-page-service";

/// El menú que ve el comprador: el árbol completo (ver
/// listStorefrontMenuTree) sin los ítems que llevan a un producto agotado
/// o despublicado, ni a una colección sin productos disponibles — salvo
/// que Diseño → Página de colecciones muestre los agotados, en cuyo caso
/// solo se esconden los despublicados y las colecciones vacías. Un padre
/// sin link que se queda sin hijos también se esconde; uno con link que se
/// esconde pero cuyos hijos siguen, queda como padre sin link. Pedido el
/// 2026-10-19: "si un producto o colección está agotado no aparece en el
/// menú". En Diseño → Menú se siguen viendo todos.

/// Rutas de la vitrina que no son un producto.
const RESERVED = new Set([
  "account", "api", "blogs", "buscar", "carrito", "cart", "checkout", "coleccion", "collections", "cuenta", "gracias", "pages", "pagina",
  "pago", "pedido", "policies", "politica-de-privacidad", "products", "search",
]);

export function productSlugOf(url: string): string | null {
  const m = url.trim().match(/^\/([a-z0-9-]+)\/?(?:[?#].*)?$/i);
  if (!m) return null;
  const slug = m[1].toLowerCase();
  return RESERVED.has(slug) ? null : slug;
}

export function collectionSlugOf(url: string): string | null {
  const m = url.trim().match(/^\/coleccion\/([^/?#]+)\/?(?:[?#].*)?$/i);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

/// cache: lo piden el layout y la página de la misma visita, y Prisma
/// Postgres cobra cada consulta (ver getStorefrontBrand).
export const listStorefrontMenuForShoppers = cache(menuForShoppers);

async function menuForShoppers(brandId: string, options?: { showSoldOut?: boolean }): Promise<MenuNode[]> {
  const tree = await listStorefrontMenuTree(brandId);
  if (tree.length === 0) return tree;
  // Sin opción, manda lo publicado en Diseño → Página de colecciones.
  const showSoldOut = options?.showSoldOut ?? (await getPublishedTheme(brandId)).productListing.showSoldOut;

  const productSlugs = new Set<string>();
  const collectionSlugs = new Set<string>();
  const collect = (nodes: MenuNode[]) => {
    for (const node of nodes) {
      const product = productSlugOf(node.url);
      if (product) productSlugs.add(product);
      const collection = collectionSlugOf(node.url);
      if (collection) collectionSlugs.add(collection);
      collect(node.children);
    }
  };
  collect(tree);

  const [products, collections] = await Promise.all([
    productSlugs.size > 0
      ? prisma.product.findMany({
          where: { brandId, slug: { in: [...productSlugs] } },
          select: { slug: true, status: true, available: true, stock: true, hasVariants: true, variants: { select: { stock: true } } },
        })
      : [],
    collectionSlugs.size > 0
      ? prisma.brandCollection.findMany({
          where: { brandId, slug: { in: [...collectionSlugs] } },
          select: {
            slug: true,
            _count: { select: { products: { where: { product: { status: "ACTIVE", available: true, ...stockWhere({ showSoldOut }) } } } } },
          },
        })
      : [],
  ]);
  // Lo que no se encuentra se deja (puede ser un slug viejo que redirige).
  const hiddenProducts = new Set(
    products.filter((p) => p.status !== "ACTIVE" || !p.available || (!showSoldOut && isSoldOut(p))).map((p) => p.slug!.toLowerCase()),
  );
  const hiddenCollections = new Set(collections.filter((c) => c._count.products === 0).map((c) => c.slug.toLowerCase()));

  const prune = (nodes: MenuNode[]): MenuNode[] =>
    nodes.flatMap((node) => {
      const children = prune(node.children);
      const product = productSlugOf(node.url);
      const collection = collectionSlugOf(node.url);
      const hiddenTarget = (product !== null && hiddenProducts.has(product)) || (collection !== null && hiddenCollections.has(collection));
      if (isMenuPlaceholderUrl(node.url)) return children.length > 0 ? [{ ...node, children }] : [];
      if (!hiddenTarget) return [{ ...node, children }];
      // Su destino no se muestra, pero sus hijos sí: queda como padre sin link.
      return children.length > 0 ? [{ ...node, url: "#", children }] : [];
    });
  return prune(tree);
}
