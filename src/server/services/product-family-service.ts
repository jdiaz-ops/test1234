import { prisma } from "@/lib/prisma";
import { GROUP_ATTRIBUTE, readProductAttributes } from "@/lib/product-attributes";
import { detectProductFamilies, SIZE_AXES, type ProductFamily } from "@/lib/product-families";

/// "Familias": deja guardado en cada producto (Product.attributes) el
/// grupo y los ejes que la detección por nombre encuentra (ver
/// product-families.ts), para que los "otros aromas / tamaños" de la
/// página del producto y los filtros de la colección no dependan de
/// calcularlo cada vez y la marca pueda corregirlos. Corre sola al
/// importar y, para lo que ya estaba, desde Productos (solo admin).
/// Nunca toca un grupo que ya existe (los de "Separar variantes" o
/// puestos a mano): un producto nuevo que cae en una familia ya agrupada
/// toma su Grupo y el nombre de su eje. Ver conversación del 2026-10-18.

export type FamilyPlanMember = { id: string; name: string; attrs: Record<string, string>; already: boolean };
export type FamilyPlan = { group: string; axes: string[]; members: FamilyPlanMember[]; how: ProductFamily["how"] };
export type FamilyUpdate = { id: string; attributes: Record<string, string> };

export function planFamilyUpdates(products: { id: string; name: string; attributes: unknown }[]): {
  families: FamilyPlan[];
  updates: FamilyUpdate[];
  /// Familias que no se tocan porque sus miembros ya tienen grupos distintos.
  skipped: number;
} {
  const current = new Map(products.map((p) => [p.id, readProductAttributes(p.attributes)]));
  const families: FamilyPlan[] = [];
  const updates: FamilyUpdate[] = [];
  let skipped = 0;
  for (const family of detectProductFamilies(products)) {
    const existing = family.members.map((m) => current.get(m.id) ?? {}).filter((a) => a[GROUP_ATTRIBUTE]);
    const labels = new Set(existing.map((a) => a[GROUP_ATTRIBUTE]));
    if (labels.size > 1) {
      skipped++;
      continue;
    }
    const label = labels.size === 1 ? [...labels][0] : family.group;
    const ourVariantAxis = family.axes.find((a) => !SIZE_AXES.has(a)) ?? null;
    const ourSizeAxis = family.axes.find((a) => SIZE_AXES.has(a)) ?? null;
    const existingVariantAxis = existing.flatMap((a) => Object.keys(a)).find((k) => k !== GROUP_ATTRIBUTE && !SIZE_AXES.has(k)) ?? null;
    const variantAxis = ourVariantAxis ? (existingVariantAxis ?? ourVariantAxis) : null;
    const members: FamilyPlanMember[] = [];
    for (const m of family.members) {
      const before = current.get(m.id) ?? {};
      const after = { ...before };
      if (!after[GROUP_ATTRIBUTE]) after[GROUP_ATTRIBUTE] = label;
      if (variantAxis && ourVariantAxis && m.attrs[ourVariantAxis] && !after[variantAxis]) after[variantAxis] = m.attrs[ourVariantAxis];
      if (ourSizeAxis && m.attrs[ourSizeAxis] && !after[ourSizeAxis]) after[ourSizeAxis] = m.attrs[ourSizeAxis];
      if (JSON.stringify(after) !== JSON.stringify(before)) updates.push({ id: m.id, attributes: after });
      members.push({ id: m.id, name: m.name, attrs: after, already: Boolean(before[GROUP_ATTRIBUTE]) });
    }
    families.push({ group: label, axes: [variantAxis, ourSizeAxis].filter((a): a is string => Boolean(a)), members, how: family.how });
  }
  return { families, updates, skipped };
}

async function loadProducts(brandId: string) {
  return prisma.product.findMany({
    where: { brandId, manual: true, status: { not: "DRAFT" } },
    select: { id: true, name: true, attributes: true },
    orderBy: { name: "asc" },
  });
}

export async function previewProductFamilies(brandId: string) {
  const products = await loadProducts(brandId);
  const plan = planFamilyUpdates(products);
  return {
    total: products.length,
    grouped: products.filter((p) => readProductAttributes(p.attributes)[GROUP_ATTRIBUTE]).length,
    ...plan,
  };
}

export async function applyProductFamilies(brandId: string) {
  const products = await loadProducts(brandId);
  const plan = planFamilyUpdates(products);
  for (const update of plan.updates) {
    await prisma.product.update({ where: { id: update.id }, data: { attributes: update.attributes } });
  }
  return { families: plan.families.length, products: plan.updates.length, skipped: plan.skipped };
}
