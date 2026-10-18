import { useSyncExternalStore } from "react";

/// La foto de la variante elegida en la ficha de producto: la elige el
/// selector (variant-picker.tsx) y la muestra la galería
/// (product-gallery.tsx), que son componentes hermanos. Un almacén
/// mínimo por producto, sin contexto ni eventos del navegador. Ver
/// conversación del 2026-10-18 ("cuando le doy clic a una variante no
/// carga la imagen correspondiente").

const images = new Map<string, string | null>();
const listeners = new Set<() => void>();

export function setSelectedVariantImage(productId: string, url: string | null) {
  if ((images.get(productId) ?? null) === url) return;
  images.set(productId, url);
  for (const listener of listeners) listener();
}

export function getSelectedVariantImage(productId: string): string | null {
  return images.get(productId) ?? null;
}

export function subscribeSelectedVariantImage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSelectedVariantImage(productId: string | undefined): string | null {
  return useSyncExternalStore(
    subscribeSelectedVariantImage,
    () => (productId ? getSelectedVariantImage(productId) : null),
    () => null,
  );
}
