/// Cálculos de dinero e inventario de "Mi tienda" que comparten el
/// checkout (navegador), el servidor y las pruebas automáticas — una sola
/// fuente para que no se desincronicen (ya pasó dos veces: el envío
/// cobrado 100 veces y el IVA sumado encima del precio).

/// Parte de un precio que ya incluye IVA que corresponde al impuesto. Los
/// precios de la marca son precio al público (IVA incluido): 11.900 con
/// 19% → 1.900 de IVA. Sirve en cualquier unidad (pesos o centavos); el
/// resultado se redondea a la unidad.
export function taxIncluded(amount: number, ratePercent: number): number {
  if (!(amount > 0) || !(ratePercent > 0)) return 0;
  return Math.round(amount - amount / (1 + ratePercent / 100));
}

/// Total que paga el comprador: subtotal con descuento + envío. El IVA
/// NO se suma (ya viene dentro del precio, ver taxIncluded).
export function orderTotal(params: { subtotal: number; discount: number; shipping: number }): number {
  const afterDiscount = Math.max(0, params.subtotal - params.discount);
  return afterDiscount + Math.max(0, params.shipping);
}

export type StockLine = { productId: string | null; variantId: string | null; quantity: number };
export type StockMovement = { productId: string; variantId: string | null; quantity: number };

/// Agrupa las líneas de un pedido en movimientos de inventario por
/// producto/variante — dos líneas del mismo producto suman, las que ya no
/// tienen producto (borrado después) se ignoran.
export function stockMovements(lines: StockLine[]): StockMovement[] {
  const byKey = new Map<string, StockMovement>();
  for (const line of lines) {
    if (!line.productId || !(line.quantity > 0)) continue;
    const key = `${line.productId}:${line.variantId ?? ""}`;
    const current = byKey.get(key);
    if (current) current.quantity += line.quantity;
    else byKey.set(key, { productId: line.productId, variantId: line.variantId, quantity: line.quantity });
  }
  return Array.from(byKey.values());
}

/// Número corto del pedido que ven la marca y el comprador (los últimos 8
/// caracteres de la referencia de Wompi, en mayúsculas).
export function orderNumber(reference: string): string {
  return reference.slice(-8).toUpperCase();
}
