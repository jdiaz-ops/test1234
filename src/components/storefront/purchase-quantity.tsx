"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type QuantityState = [number, Dispatch<SetStateAction<number>>];

const PurchaseQuantityContext = createContext<QuantityState | null>(null);

/// La cantidad elegida en la ficha de producto, compartida entre la fila
/// de compra y la barra flotante: si el comprador pone 3 arriba y baja, la
/// barra también dice 3 (y al revés). Ver conversación del 2026-10-19.
export function PurchaseQuantityProvider({ children }: { children: ReactNode }) {
  const state = useState(1);
  return <PurchaseQuantityContext.Provider value={state}>{children}</PurchaseQuantityContext.Provider>;
}

/// Fuera del provider cada selector lleva su propia cantidad.
export function usePurchaseQuantity(): QuantityState {
  const shared = useContext(PurchaseQuantityContext);
  const local = useState(1);
  return shared ?? local;
}
