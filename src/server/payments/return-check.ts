import { prisma } from "@/lib/prisma";
import { gatewayForOrder } from "@/server/payments/credentials";
import { checkPaymentReturn } from "@/server/payments/gateway-service";
import { PaymentGatewayError } from "@/server/payments/types";
import { WompiApiError } from "@/server/integrations/wompi-client";
import { applyPaymentResult } from "@/server/services/store-order-service";

/// El comprador vuelve a la página del pedido con lo que la pasarela le
/// puso en la URL (?id= de Wompi, ?payment_id= de Mercado Pago, la firma
/// de PayU, ?ref_payco= de ePayco, ?bold-tx-status= de Bold). Casi siempre
/// llega antes que el aviso de la pasarela, así que se consulta de una vez
/// en vez de dejarlo viendo "pendiente". Si la pasarela no responde, el
/// aviso puede llegar después: no es un error para el comprador.
export async function settleOrderFromReturn(
  order: Parameters<typeof gatewayForOrder>[1] & { id: string; reference: string; gatewayReference: string | null; status: string },
  brand: Parameters<typeof gatewayForOrder>[0],
  query: Record<string, string>,
) {
  if (order.status !== "PENDING" && order.status !== "EXPIRED") return false;
  if (Object.keys(query).length === 0) return false;
  const gateway = gatewayForOrder(brand, order);
  if (!gateway) return false;
  try {
    const result = await checkPaymentReturn(gateway, order, query);
    if (!result) return false;
    await applyPaymentResult({ reference: order.reference, ...result });
    return true;
  } catch (err) {
    if (err instanceof PaymentGatewayError || err instanceof WompiApiError) return false;
    throw err;
  }
}

/// Query de la URL como un mapa plano de strings (el primer valor si
/// viene repetido).
export function flattenQuery(input: URLSearchParams | Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  if (input instanceof URLSearchParams) {
    for (const [k, v] of input.entries()) if (!(k in out)) out[k] = v;
    return out;
  }
  for (const [k, v] of Object.entries(input)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (typeof value === "string") out[k] = value;
  }
  return out;
}

export async function loadOrderForReturn(orderId: string) {
  return prisma.storeOrder.findUnique({ where: { id: orderId }, include: { brand: true } });
}
