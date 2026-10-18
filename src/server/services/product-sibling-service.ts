import { prisma } from "@/lib/prisma";
import { GROUP_ATTRIBUTE, readProductAttributes, shortVariantName, variantAxisOf } from "@/lib/product-attributes";

/// "Otros tonos" de un producto que salió de separar variantes: los demás
/// productos activos de la marca con el mismo Grupo. Es la relación
/// padre/hijo de Amazon pero dentro del producto: el comprador ve en qué
/// tono está y salta a los otros sin volver a la colección. Ver
/// conversación del 2026-10-18.

export type SiblingItem = {
  id: string;
  slug: string;
  name: string;
  /// El valor del eje ("Princesa") — para el cuadrito.
  value: string;
  imageUrl: string | null;
  price: number;
  soldOut: boolean;
  current: boolean;
};

export type SiblingGroup = {
  group: string;
  /// "Tono", "Talla"… o null si el producto solo tiene grupo.
  axis: string | null;
  current: string;
  items: SiblingItem[];
};

export async function getSiblingProducts(
  brandId: string,
  product: { id: string; name: string; slug: string | null; imageUrl: string | null; price: unknown; stock: number | null; attributes: unknown },
): Promise<SiblingGroup | null> {
  const attributes = readProductAttributes(product.attributes);
  const group = attributes[GROUP_ATTRIBUTE];
  if (!group) return null;
  const axis = variantAxisOf(attributes);
  const siblings = await prisma.product.findMany({
    where: {
      brandId,
      manual: true,
      status: "ACTIVE",
      available: true,
      id: { not: product.id },
      attributes: { path: [GROUP_ATTRIBUTE], equals: group },
    },
    select: { id: true, name: true, slug: true, imageUrl: true, price: true, stock: true, attributes: true },
    orderBy: { name: "asc" },
  });
  if (siblings.length === 0) return null;
  const valueOf = (p: { name: string; attributes: unknown }) => {
    const attrs = readProductAttributes(p.attributes);
    return (axis && attrs[axis]) || shortVariantName(p.name);
  };
  const toItem = (p: typeof siblings[number] | typeof product, current: boolean): SiblingItem => ({
    id: p.id,
    slug: p.slug ?? "",
    name: p.name,
    value: valueOf(p),
    imageUrl: p.imageUrl,
    price: Number(p.price),
    soldOut: p.stock != null && p.stock <= 0,
    current,
  });
  return {
    group,
    axis,
    current: valueOf(product),
    items: [toItem(product, true), ...siblings.filter((s) => s.slug).map((s) => toItem(s, false))],
  };
}
