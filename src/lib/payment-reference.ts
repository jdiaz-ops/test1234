import { randomUUID } from "node:crypto";

/// Prefijos de las referencias de pago. Una misma cuenta de Wompi cobra
/// para Marcolini y para Nail Fest (nailfest.lat), y su URL de eventos es
/// la de Marcolini: por el prefijo se sabe de quién es cada evento (ver
/// src/app/api/webhooks/wompi/route.ts, pedido del 2026-10-29).

/// Todo pedido de la tienda que se cobra en una pasarela.
export const STORE_ORDER_REFERENCE_PREFIX = "mt_";
/// Pedidos de $0 de Marcolini (muestras y cajas PR): nunca pasan por una
/// pasarela.
export const SAMPLE_REFERENCE_PREFIX = "sample_";
export const PR_BOX_REFERENCE_PREFIX = "prbox_";
/// Los que cobra Nail Fest con la cuenta compartida.
export const NAILFEST_REFERENCE_PREFIX = "NF-";

export const newStoreOrderReference = () => `${STORE_ORDER_REFERENCE_PREFIX}${randomUUID()}`;

/// marcolini: un pedido de la tienda. marcolini-free: una muestra o caja
/// PR (no debería llegar de Wompi). nailfest: de Nail Fest. other:
/// cualquier otra (otras tiendas con referencias al azar).
export type ReferenceOwner = "marcolini" | "marcolini-free" | "nailfest" | "other";

export function referenceOwner(reference: string): ReferenceOwner {
  if (reference.startsWith(STORE_ORDER_REFERENCE_PREFIX)) return "marcolini";
  if (reference.startsWith(SAMPLE_REFERENCE_PREFIX) || reference.startsWith(PR_BOX_REFERENCE_PREFIX)) return "marcolini-free";
  if (reference.startsWith(NAILFEST_REFERENCE_PREFIX)) return "nailfest";
  return "other";
}
