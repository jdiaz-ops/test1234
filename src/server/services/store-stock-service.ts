import type { Prisma } from "@prisma/client";
import type { StockMovement } from "@/lib/order-math";

/// Aplica movimientos de inventario dentro de una transacción: `sign = -1`
/// descuenta (venta pagada), `sign = 1` repone (devolución). Nunca deja
/// el inventario en negativo. Un producto sin control de inventario
/// (stock null) no se toca. Ver conversación del 2026-09-30: el
/// inventario no se descontaba al vender.
export async function applyStockMovements(
  tx: Prisma.TransactionClient,
  movements: StockMovement[],
  sign: 1 | -1,
) {
  for (const m of movements) {
    const change = sign === -1 ? { decrement: m.quantity } : { increment: m.quantity };
    if (m.variantId) {
      await tx.productVariant.updateMany({ where: { id: m.variantId }, data: { stock: change } });
      if (sign === -1) {
        await tx.productVariant.updateMany({ where: { id: m.variantId, stock: { lt: 0 } }, data: { stock: 0 } });
      }
    } else {
      await tx.product.updateMany({ where: { id: m.productId, stock: { not: null } }, data: { stock: change } });
      if (sign === -1) {
        await tx.product.updateMany({ where: { id: m.productId, stock: { lt: 0 } }, data: { stock: 0 } });
      }
    }
  }
}
