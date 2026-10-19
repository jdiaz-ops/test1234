import { prisma } from "@/lib/prisma";
import { lineProductName, productLines, splitLineName } from "@/lib/product-lines";

/// Nombres por línea (ver product-lines.ts): lista las líneas de la tienda
/// y les cambia el comienzo del nombre a todos sus productos de una vez.
/// Solo cambia el nombre: el link de cada producto, sus atributos (Grupo,
/// Referencias…) y los pedidos viejos quedan igual.

async function loadProducts(brandId: string) {
  return prisma.product.findMany({
    where: { brandId, manual: true, status: { not: "DRAFT" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function listProductLines(brandId: string) {
  return productLines(await loadProducts(brandId)).map((l) => ({
    line: l.line,
    count: l.products.length,
    samples: l.products.slice(0, 3).map((p) => p.rest),
  }));
}

export async function renameProductLines(brandId: string, changes: { line: string; newLine: string }[], titleCase: boolean) {
  const wanted = new Map(changes.map((c) => [c.line, c.newLine.trim()]));
  let renamed = 0;
  for (const product of await loadProducts(brandId)) {
    const parts = splitLineName(product.name);
    if (!parts || !wanted.has(parts.line)) continue;
    const name = lineProductName(wanted.get(parts.line) || parts.line, parts.rest, titleCase);
    if (name === product.name) continue;
    await prisma.product.update({ where: { id: product.id }, data: { name } });
    renamed++;
  }
  return { renamed };
}
