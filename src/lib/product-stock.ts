import type { Prisma } from "@prisma/client";

/// Agotado = controla inventario y no le queda nada: sin variantes, stock
/// en 0; con variantes, todas en 0 (una variante con stock null se vende
/// sin límite, así que el producto no está agotado). Pedido el 2026-10-18:
/// "por defecto esconde los productos agotados" — la vitrina no los lista
/// (catálogo, novedades, ofertas, destacados, colecciones, relacionados,
/// buscador); Diseño → Página de colecciones → "Mostrar productos
/// agotados" los vuelve a mostrar con su etiqueta. La página del producto
/// sigue abierta por link directo.
export function isSoldOut(product: { stock: number | null; hasVariants: boolean; variants?: { stock: number | null }[] | null }): boolean {
  if (product.hasVariants) {
    const variants = product.variants ?? [];
    return variants.length > 0 && variants.every((v) => v.stock != null && v.stock <= 0);
  }
  return product.stock != null && product.stock <= 0;
}

/// El mismo criterio como filtro de Prisma, para no traer los agotados.
export const IN_STOCK_WHERE: Prisma.ProductWhereInput = {
  OR: [
    { hasVariants: false, OR: [{ stock: null }, { stock: { gt: 0 } }] },
    { hasVariants: true, OR: [{ variants: { none: {} } }, { variants: { some: { OR: [{ stock: null }, { stock: { gt: 0 } }] } } }] },
  ],
};

export type StockOptions = { showSoldOut?: boolean };

export function stockWhere(options?: StockOptions): Prisma.ProductWhereInput {
  return options?.showSoldOut ? {} : IN_STOCK_WHERE;
}
