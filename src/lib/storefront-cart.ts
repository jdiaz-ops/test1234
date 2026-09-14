/// Carrito de "Mi tienda" — vive solo en el navegador del comprador
/// (localStorage), separado por marca (una clave por storefrontSlug) para
/// que comprar en dos vitrinas distintas no mezcle los carritos. El
/// servidor nunca confía en los precios de acá — solo en productId +
/// quantity al armar el pedido (ver createStoreOrder).

export type CartItem = {
  productId: string;
  /// Solo si el producto tiene variantes (ver Product.hasVariants) — dos
  /// variantes del mismo producto son líneas de carrito DISTINTAS (ver
  /// cartLineKey abajo), cada una con su propio precio/stock/quantity.
  variantId: string | null;
  /// Foto de la combinación elegida (ej. "Talla: M · Color: Rojo") — solo
  /// para mostrar en el carrito/checkout.
  variantLabel: string | null;
  slug: string;
  name: string;
  price: number; // COP, solo para mostrar — el cobro real lo recalcula el servidor
  imageUrl: string | null;
  stock: number | null;
  quantity: number;
  /// Un carrito nunca mezcla PHYSICAL con SERVICE (ver addItem en
  /// cart-context.tsx) — se guarda por ítem porque el carrito es la única
  /// fuente de verdad del lado del navegador antes de llegar al checkout.
  type: "PHYSICAL" | "SERVICE";
};

/// Identifica una línea de carrito — productId solo no alcanza cuando el
/// producto tiene variantes (dos variantes del mismo producto deben ser
/// líneas separadas, no sumarse ni pisarse entre sí).
export function cartLineKey(item: { productId: string; variantId: string | null }) {
  return `${item.productId}:${item.variantId ?? ""}`;
}

function storageKey(brandSlug: string) {
  return `marcolini_cart_${brandSlug}`;
}

export function readCart(brandSlug: string): CartItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey(brandSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(brandSlug: string, items: CartItem[]) {
  try {
    window.localStorage.setItem(storageKey(brandSlug), JSON.stringify(items));
  } catch {
    // localStorage no disponible (modo privado, cuota llena) — el carrito
    // simplemente no persiste entre recargas, pero la sesión sigue andando.
  }
}
