import { prisma } from "@/lib/prisma";
import { stockWhere, type StockOptions } from "@/lib/product-stock";
import { GROUP_ATTRIBUTE, readProductAttributes, shortVariantName, variantAxisOf } from "@/lib/product-attributes";
import { buildSiblingGroups, familyOf } from "@/lib/product-families";

/// "Otros tonos" / "otros aromas" / "otros tamaños" de un producto: los
/// demás productos de su familia, como la relación padre/hijo de Amazon
/// pero dentro del producto, para saltar entre opciones sin volver a la
/// colección. La familia sale de dos lados:
/// - el atributo Grupo que guardan "Separar variantes" y "Familias" (ver
///   product-family-service.ts), o
/// - si el producto no tiene grupo, el nombre: se arma al vuelo con los
///   productos de sus mismas colecciones (ver product-families.ts). Así
///   funciona en cualquier tienda, importada como sea — pedido el
///   2026-10-18 con los aromas de amglow.
/// Un producto con dos ejes (aroma y tamaño) devuelve dos grupos.

export type SiblingItem = {
  id: string;
  slug: string;
  name: string;
  /// El valor del eje ("Princesa", "SANDIA", "500ML") — para el cuadrito.
  value: string;
  imageUrl: string | null;
  price: number;
  soldOut: boolean;
  current: boolean;
};

export type SiblingGroup = {
  /// "Rosados", "VELOTERAPIA SANDIA" — el grupo más lo que comparte el
  /// producto con los de este eje.
  group: string;
  /// "Tono", "Aroma", "Tamaño"…
  axis: string;
  current: string;
  items: SiblingItem[];
};

type ProductLike = {
  id: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  price: unknown;
  stock: number | null;
  attributes: unknown;
};

type Member = { id: string; name: string; slug: string; imageUrl: string | null; price: number; stock: number | null; attrs: Record<string, string> };

const SELECT = { id: true, name: true, slug: true, imageUrl: true, price: true, stock: true, attributes: true } as const;
/// Hasta cuántos productos se miran para armar la familia por el nombre.
const MAX_CANDIDATES = 600;

function toMember(p: ProductLike, attrs: Record<string, string>): Member {
  return { id: p.id, name: p.name, slug: p.slug ?? "", imageUrl: p.imageUrl, price: Number(p.price), stock: p.stock, attrs };
}

function toGroups(group: string, current: Member, members: Member[]): SiblingGroup[] {
  const toItem = (axis: string, m: Member): SiblingItem => ({
    id: m.id,
    slug: m.slug,
    name: m.name,
    value: m.attrs[axis] || shortVariantName(m.name),
    imageUrl: m.imageUrl,
    price: m.price,
    soldOut: m.stock != null && m.stock <= 0,
    current: m.id === current.id,
  });
  const groups = buildSiblingGroups(group, current, members).map((g) => ({
    group: g.label,
    axis: g.axis,
    current: g.current,
    items: g.items.map((m) => toItem(g.axis, m)),
  }));
  if (groups.length > 0 || members.length < 2) return groups;
  // Grupo guardado sin eje (datos viejos): un solo grupo con el nombre corto.
  const axis = variantAxisOf(current.attrs) ?? "Opción";
  return [{ group, axis, current: shortVariantName(current.name), items: members.map((m) => toItem(axis, m)) }];
}

export async function getSiblingProducts(brandId: string, product: ProductLike, options?: StockOptions): Promise<SiblingGroup[]> {
  const attributes = readProductAttributes(product.attributes);
  const group = attributes[GROUP_ATTRIBUTE];
  const where = {
    brandId,
    manual: true,
    status: "ACTIVE" as const,
    available: true,
    id: { not: product.id },
    ...stockWhere(options),
  };

  if (group) {
    const rows = await prisma.product.findMany({
      where: { ...where, attributes: { path: [GROUP_ATTRIBUTE], equals: group } },
      select: SELECT,
      orderBy: { name: "asc" },
    });
    const current = toMember(product, attributes);
    const members = [current, ...rows.filter((r) => r.slug).map((r) => toMember(r, readProductAttributes(r.attributes)))];
    return toGroups(group, current, members);
  }

  // Sin grupo guardado: la familia se arma por los nombres, entre los
  // productos de sus mismas colecciones (o de todo el catálogo si no
  // está en ninguna).
  const collections = await prisma.productBrandCollection.findMany({ where: { productId: product.id }, select: { collectionId: true } });
  const collectionIds = collections.map((c) => c.collectionId);
  const rows = await prisma.product.findMany({
    where: {
      ...where,
      ...(collectionIds.length > 0 ? { brandCollections: { some: { collectionId: { in: collectionIds } } } } : {}),
    },
    select: SELECT,
    orderBy: { name: "asc" },
    take: MAX_CANDIDATES,
  });
  const family = familyOf([{ id: product.id, name: product.name }, ...rows.map((r) => ({ id: r.id, name: r.name }))], product.id);
  if (!family) return [];
  const attrsById = new Map(family.members.map((m) => [m.id, m.attrs]));
  const current = toMember(product, attrsById.get(product.id) ?? {});
  const members = [current, ...rows.filter((r) => r.slug && attrsById.has(r.id)).map((r) => toMember(r, attrsById.get(r.id)!))];
  return toGroups(family.group, current, members);
}
