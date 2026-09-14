"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { readCart, writeCart, cartLineKey, type CartItem } from "@/lib/storefront-cart";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  /// Devuelve un error legible si el ítem es de un tipo distinto (físico
  /// vs. servicio) al resto del carrito — un carrito nunca mezcla los dos,
  /// porque el checkout necesita datos distintos para cada uno (envío vs.
  /// fecha/hora).
  addItem: (
    item: Omit<CartItem, "quantity">,
    quantity?: number,
  ) => { ok: true } | { ok: false; error: string };
  updateQuantity: (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => void;
  removeItem: (productId: string, variantId: string | null) => void;
  clear: () => void;
  /// Código de creador aplicado desde el carrito (ver
  /// theme.cart.allowCoupon) — se guarda acá para que sobreviva la
  /// navegación a /checkout, que lo precarga solo. No se valida acá, eso
  /// lo hace quien lo aplica (ver CartList) contra
  /// previewDiscountCode.
  discountCode: string | null;
  setDiscountCode: (code: string | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/// Un provider por marca (brandSlug) — cada vitrina tiene su propio
/// carrito aislado. Arranca vacío en el servidor/primer render y se
/// hidrata desde localStorage justo después de montar, para no romper el
/// render de servidor (localStorage no existe ahí).
export function CartProvider({
  brandSlug,
  children,
}: {
  brandSlug: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [discountCode, setDiscountCodeState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const discountKey = `marcolini_discount_${brandSlug}`;

  useEffect(() => {
    // localStorage no existe en el servidor — el primer render (servidor y
    // primer paint del cliente, para que coincidan y no rompan la
    // hidratación) siempre arranca vacío; recién acá, después de montar, se
    // lee el carrito real del navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage, solo puede leerse tras montar
    setItems(readCart(brandSlug));
    try {
      setDiscountCodeState(window.localStorage.getItem(discountKey));
    } catch {
      // localStorage no disponible — el código simplemente no persiste.
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- discountKey se deriva de brandSlug, ya está en deps
  }, [brandSlug]);

  useEffect(() => {
    if (hydrated) writeCart(brandSlug, items);
  }, [brandSlug, items, hydrated]);

  const setDiscountCode = useCallback(
    (code: string | null) => {
      setDiscountCodeState(code);
      try {
        if (code) window.localStorage.setItem(discountKey, code);
        else window.localStorage.removeItem(discountKey);
      } catch {
        // localStorage no disponible — no rompe nada, solo no persiste.
      }
    },
    [discountKey],
  );

  const addItem = useCallback(
    (
      item: Omit<CartItem, "quantity">,
      quantity = 1,
    ): { ok: true } | { ok: false; error: string } => {
      const existingType = items[0]?.type;
      if (existingType && existingType !== item.type) {
        const label: Record<CartItem["type"], string> = {
          PHYSICAL: "productos",
          SERVICE: "una reserva de servicio",
          DIGITAL: "un producto digital",
        };
        return {
          ok: false,
          error: `Ya tienes ${label[existingType]} en tu carrito — complétalo o vacíalo antes de agregar ${label[item.type]}.`,
        };
      }
      setItems((prev) => {
        const key = cartLineKey(item);
        const existing = prev.find((i) => cartLineKey(i) === key);
        if (existing) {
          const maxQty = item.stock ?? Infinity;
          return prev.map((i) =>
            cartLineKey(i) === key
              ? { ...i, quantity: Math.min(i.quantity + quantity, maxQty) }
              : i,
          );
        }
        return [...prev, { ...item, quantity }];
      });
      return { ok: true };
    },
    [items],
  );

  const updateQuantity = useCallback(
    (productId: string, variantId: string | null, quantity: number) => {
      const key = cartLineKey({ productId, variantId });
      setItems((prev) => {
        if (quantity <= 0) return prev.filter((i) => cartLineKey(i) !== key);
        return prev.map((i) =>
          cartLineKey(i) === key
            ? { ...i, quantity: Math.min(quantity, i.stock ?? Infinity) }
            : i,
        );
      });
    },
    [],
  );

  const removeItem = useCallback((productId: string, variantId: string | null) => {
    const key = cartLineKey({ productId, variantId });
    setItems((prev) => prev.filter((i) => cartLineKey(i) !== key));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setDiscountCode(null);
  }, [setDiscountCode]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const value = useMemo(
    () => ({
      items,
      count,
      subtotal,
      addItem,
      updateQuantity,
      removeItem,
      clear,
      discountCode,
      setDiscountCode,
    }),
    [items, count, subtotal, addItem, updateQuantity, removeItem, clear, discountCode, setDiscountCode],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
