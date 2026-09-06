/// Carrito de "Mi tienda" — vive solo en el navegador del comprador
/// (localStorage), separado por marca (una clave por storefrontSlug) para
/// que comprar en dos vitrinas distintas no mezcle los carritos. El
/// servidor nunca confía en los precios de acá — solo en productId +
/// quantity al armar el pedido (ver createStoreOrder).

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number; // COP, solo para mostrar — el cobro real lo recalcula el servidor
  imageUrl: string | null;
  stock: number | null;
  quantity: number;
};

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
