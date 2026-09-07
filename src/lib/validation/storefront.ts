import { z } from "zod";

/// Validación del checkout público de "Mi tienda" — todo lo que escribe el
/// comprador en marcolini.lat/t/{storefrontSlug}. Nunca se confía en
/// precios/totales del cliente acá — solo productId + quantity; el resto lo
/// recalcula el servidor (ver createStoreOrder en store-order-service.ts).

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(50),
});

export const validateDiscountCodeSchema = z.object({
  code: z.string().min(1, "Escribe un código"),
});

/// shippingAddress/shippingCity y servicePreferredAt son mutuamente
/// exclusivos según el carrito (físico vs. servicio) — acá solo se valida
/// la forma; cuál hace falta de verdad lo decide createStoreOrder, que sí
/// sabe qué hay en el carrito.
export const createStoreOrderSchema = z.object({
  items: z.array(cartItemSchema).min(1, "El carrito está vacío"),
  buyerName: z.string().min(2, "Ingresa tu nombre"),
  buyerEmail: z.string().email("Correo inválido"),
  buyerPhone: z.string().min(7, "Ingresa un teléfono válido"),
  shippingAddress: z.string().optional().or(z.literal("")),
  shippingCity: z.string().optional().or(z.literal("")),
  shippingNotes: z.string().max(300).optional().or(z.literal("")),
  servicePreferredAt: z.string().optional().or(z.literal("")),
  discountCode: z.string().max(40).optional().or(z.literal("")),
});
