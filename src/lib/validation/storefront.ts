import { z } from "zod";

/// Validación del checkout público de "Mi tienda" — todo lo que escribe el
/// comprador en marcolini.lat/t/{storefrontSlug}. Nunca se confía en
/// precios/totales del cliente acá — solo productId + quantity; el resto lo
/// recalcula el servidor (ver createStoreOrder en store-order-service.ts).

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  /// Solo si el producto tiene variantes (ver Product.hasVariants) — el
  /// servidor decide si hacía falta o no, acá solo se valida la forma.
  variantId: z.string().min(1).optional(),
  quantity: z.coerce.number().int().min(1).max(50),
});

export const validateDiscountCodeSchema = z.object({
  code: z.string().min(1, "Escribe un código"),
});

/// Cotización de envío en vivo durante el checkout (ver quoteShipping en
/// store-order-service.ts) — orderAmountCents/weightKg vienen del carrito
/// del navegador, solo para elegir la tarifa; el monto real que se cobra
/// siempre lo recalcula el servidor en createStoreOrder.
export const quoteShippingSchema = z.object({
  region: z.string().min(1, "Elige tu departamento"),
  orderAmountCents: z.coerce.number().min(0),
  weightKg: z.coerce.number().min(0),
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
  shippingRegion: z.string().optional().or(z.literal("")),
  shippingNotes: z.string().max(300).optional().or(z.literal("")),
  servicePreferredAt: z.string().optional().or(z.literal("")),
  discountCode: z.string().max(40).optional().or(z.literal("")),
  /// Factura electrónica a nombre del comprador (opcional; solo se pide
  /// cuando la tienda tiene Dataico conectado). Sin esto, consumidor final.
  billingIdType: z.enum(["CC", "NIT", "CE", "PASAPORTE", "PPT"]).optional().or(z.literal("")),
  billingIdNumber: z
    .string()
    .trim()
    .max(20, "El número de documento es muy largo")
    .regex(/^[0-9A-Za-z.\- ]*$/, "Escribe el número de documento sin letras raras")
    .optional()
    .or(z.literal("")),
  billingName: z.string().trim().max(200).optional().or(z.literal("")),
  billingAddress: z.string().trim().max(300).optional().or(z.literal("")),
  billingCity: z.string().trim().max(100).optional().or(z.literal("")),
  billingRegion: z.string().trim().max(100).optional().or(z.literal("")),
  /// Checkout de una página: nombre y apellidos por separado (buyerName
  /// sigue llegando con el nombre completo).
  buyerFirstName: z.string().trim().max(100).optional().or(z.literal("")),
  buyerLastName: z.string().trim().max(100).optional().or(z.literal("")),
  shippingPostalCode: z.string().trim().max(12).optional().or(z.literal("")),
  /// "Enviarme novedades y ofertas por correo".
  acceptsMarketing: z.boolean().optional(),
  /// Autorización de tratamiento de datos personales (Ley 1581): sin ella
  /// no se crea el pedido.
  dataConsent: z.literal(true, {
    message: "Para continuar, autoriza el tratamiento de tus datos personales.",
  }),
});

/// Reseña que deja un comprador en la ficha del producto (ver
/// product-review-service.ts). El correo tiene que ser el de un pedido
/// pagado que incluya ese producto.
export const submitReviewSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2, "Escribe tu nombre").max(60, "Máximo 60 caracteres"),
  email: z.string().trim().email("Escribe el correo con el que compraste"),
  rating: z.coerce.number().int().min(1, "Elige de 1 a 5 estrellas").max(5, "Elige de 1 a 5 estrellas"),
  body: z.string().trim().min(5, "Cuéntanos un poco más").max(1000, "Máximo 1000 caracteres"),
});
