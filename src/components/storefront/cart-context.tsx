"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { readCart, writeCart, type CartItem } from "@/lib/storefront-cart";

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
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // localStorage no existe en el servidor — el primer render (servidor y
    // primer paint del cliente, para que coincidan y no rompan la
    // hidratación) siempre arranca vacío; recién acá, después de montar, se
    // lee el carrito real del navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage, solo puede leerse tras montar
    setItems(readCart(brandSlug));
    setHydrated(true);
  }, [brandSlug]);

  useEffect(() => {
    if (hydrated) writeCart(brandSlug, items);
  }, [brandSlug, items, hydrated]);

  const addItem = useCallback(
    (
      item: Omit<CartItem, "quantity">,
      quantity = 1,
    ): { ok: true } | { ok: false; error: string } => {
      const existingType = items[0]?.type;
      if (existingType && existingType !== item.type) {
        return {
          ok: false,
          error:
            item.type === "SERVICE"
              ? "Ya tienes productos en tu carrito — paga ese pedido antes de reservar un servicio."
              : "Ya tienes una reserva de servicio en tu carrito — complétala antes de agregar productos.",
        };
      }
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          const maxQty = item.stock ?? Infinity;
          return prev.map((i) =>
            i.productId === item.productId
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

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(quantity, i.stock ?? Infinity) }
          : i,
      );
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

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
    }),
    [items, count, subtotal, addItem, updateQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
