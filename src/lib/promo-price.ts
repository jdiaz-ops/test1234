/// "Precio" y "Precio de promoción", como los piensa la marca (pedido del
/// 2026-10-19: "falta el precio de promoción"). Por dentro un producto
/// guarda price (lo que paga el comprador) y compareAtPrice (el que la
/// tienda muestra tachado): con promoción, price es el de promoción y
/// compareAtPrice el normal. Solo cuenta como promoción si el tachado es
/// mayor (si no, la tienda tampoco muestra descuento).
export function splitPromo(price: number | null, compareAtPrice: number | null) {
  const onSale = price != null && compareAtPrice != null && compareAtPrice > price;
  return { regular: onSale ? compareAtPrice : price, promo: onSale ? price : null };
}

/// Lo que se guarda a partir de lo que escribió la marca.
export function joinPromo(regular: number, promo: number | null) {
  return promo != null ? { price: promo, compareAtPrice: regular } : { price: regular, compareAtPrice: null };
}

export const PROMO_NOT_LOWER = "El precio de promoción tiene que ser menor que el precio.";
