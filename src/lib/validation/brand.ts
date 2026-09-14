import { z } from "zod";

export const updateBrandProfileSchema = z.object({
  companyName: z.string().min(2, "Ingresa el nombre de la marca"),
  legalName: z.string().optional().or(z.literal("")),
  taxId: z.string().optional().or(z.literal("")),
  description: z.string().max(150).optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  websiteUrl: z
    .string()
    .url("Ingresa una URL válida (https://...)")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  fiscalAddress: z.string().optional().or(z.literal("")),
  taxRegime: z.string().optional().or(z.literal("")),
  legalRepName: z.string().optional().or(z.literal("")),
  legalRepId: z.string().optional().or(z.literal("")),
  instagramHandle: z.string().optional().or(z.literal("")),
  tiktokHandle: z.string().optional().or(z.literal("")),
});

export const setProductFeaturedSchema = z.object({
  productId: z.string().min(1),
  featured: z.boolean(),
});

export const updateStoreSchema = z.object({
  storeType: z.enum(["SHOPIFY", "WOOCOMMERCE", "OTHER"]),
  storeUrl: z.string().url("Ingresa una URL válida (https://...)"),
  shopifyAccessToken: z.string().optional().or(z.literal("")),
  wooConsumerKey: z.string().optional().or(z.literal("")),
  wooConsumerSecret: z.string().optional().or(z.literal("")),
});

// ----------------------------------------------------------------------------
// "Mi tienda" — catálogo, pagos y envíos propios de Marcolini (ver
// conversación del 2026-09-06). Independiente de tener o no una tienda
// Shopify/WooCommerce conectada.
// ----------------------------------------------------------------------------

/// slug: minúsculas, números y guiones — nada de espacios ni acentos, para
/// que sirva directo en una URL (marcolini.lat/{slug} o
/// marcolini.lat/{storefrontSlug}/{slug}).
const slugField = z
  .string()
  .min(2, "Mínimo 2 caracteres")
  .max(60, "Máximo 60 caracteres")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Solo minúsculas, números y guiones — sin espacios ni acentos",
  );

/// Una variante (talla/color/etc.) — precio null = usa el precio base del
/// producto. Ver ProductVariant en el schema y product-variants-editor.tsx.
const variantInputSchema = z.object({
  option1Value: z.string().min(1).nullable(),
  option2Value: z.string().min(1).nullable(),
  option3Value: z.string().min(1).nullable(),
  price: z.number().positive().nullable(),
  sku: z.string().max(120).optional().or(z.literal("")),
  barcode: z.string().max(120).optional().or(z.literal("")),
  stock: z.coerce.number().int().min(0, "No puede ser negativo"),
  weight: z.number().min(0, "No puede ser negativo").nullable(),
});

const productBaseSchema = z.object({
  name: z.string().min(2, "Ingresa el nombre del producto"),
  description: z
    .string()
    .max(1000, "Máximo 1000 caracteres")
    .optional()
    .or(z.literal("")),
  /// Cuando hasVariants = true este valor no se usa (cada variante trae el
  /// suyo) — por eso la cota es solo "no negativo" acá; que sea > 0 de
  /// verdad se exige en requireStockOrVariants, condicionado a
  /// !hasVariants.
  price: z.coerce.number().min(0, "No puede ser negativo"),
  compareAtPrice: z.coerce.number().positive().optional().nullable(),
  /// Galería — la primera es la portada (ver ProductImage.position). Antes
  /// era un solo imageUrl; ver conversación del 2026-09-14.
  images: z.array(z.string().min(1)).default([]),
  slug: slugField,
  sku: z.string().max(120).optional().or(z.literal("")),
  barcode: z.string().max(120).optional().or(z.literal("")),
  /// Kilogramos — opcional, solo hace falta si la marca configuró una
  /// regla de envío por peso (ver ShippingZoneRate).
  weight: z.coerce.number().min(0, "No puede ser negativo").optional().nullable(),
  /// En un producto SERVICE, esto son "cupos disponibles" — mismo campo,
  /// otro nombre en la interfaz. Obligatorio desde el 2026-09-14 salvo con
  /// variantes (ahí null, el stock real vive por variante) — antes era
  /// opcional del todo, confundía a las marcas.
  stock: z.coerce
    .number()
    .int()
    .min(0, "No puede ser negativo")
    .optional()
    .nullable(),
  available: z.boolean(),
  type: z.enum(["PHYSICAL", "SERVICE"]).default("PHYSICAL"),
  serviceModality: z.enum(["VIRTUAL", "PRESENCIAL"]).optional().nullable(),
  serviceDurationMinutes: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 minuto")
    .max(600, "Máximo 600 minutos")
    .optional()
    .nullable(),
  serviceLocation: z.string().max(300).optional().or(z.literal("")),
  collectionIds: z.array(z.string().min(1)).default([]),
  hasVariants: z.boolean().default(false),
  optionNames: z.array(z.string().min(1).max(40)).max(3).default([]),
  variants: z.array(variantInputSchema).default([]),
});

/// Un producto SERVICE necesita decir si es virtual o presencial, y dónde
/// (dirección, o el link/instrucciones de la videollamada) — se valida acá
/// en vez de con campos requeridos en el schema base porque solo aplica
/// cuando type = SERVICE.
function requireServiceFields(
  data: z.infer<typeof productBaseSchema>,
  ctx: z.RefinementCtx,
) {
  if (data.type !== "SERVICE") return;
  if (!data.serviceModality) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["serviceModality"],
      message: "Elige si es virtual o presencial",
    });
  }
  if (!data.serviceLocation || !data.serviceLocation.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["serviceLocation"],
      message: "Ingresa la dirección o el link de la videollamada",
    });
  }
}

/// Sin variantes: precio > 0 y stock puesto (ya no es opcional — ver
/// conversación del 2026-09-14: "Stock no puede ser opcional"). Con
/// variantes: precio/stock del producto no se usan, pero hace falta al
/// menos una variante generada.
function requireStockOrVariants(
  data: z.infer<typeof productBaseSchema>,
  ctx: z.RefinementCtx,
) {
  if (data.hasVariants) {
    if (data.variants.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["variants"],
        message: "Agrega al menos una opción con valores para generar variantes.",
      });
    }
    return;
  }
  if (data.price <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["price"],
      message: "El precio debe ser mayor a cero",
    });
  }
  if (data.stock == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["stock"],
      message: "Ingresa el stock",
    });
  }
}

export const createProductSchema = productBaseSchema
  .superRefine(requireServiceFields)
  .superRefine(requireStockOrVariants);

export const updateProductSchema = productBaseSchema
  .extend({ productId: z.string().min(1) })
  .superRefine(requireServiceFields)
  .superRefine(requireStockOrVariants);

export const deleteManualProductSchema = z.object({
  productId: z.string().min(1),
});

/// Todos los campos opcionales — la marca puede guardar solo las llaves de
/// prueba primero, y agregar las de producción después sin perder nada.
export const wompiCredentialsSchema = z.object({
  paymentMode: z.enum(["TEST", "PRODUCTION"]),
  wompiPublicKeyTest: z.string().optional().or(z.literal("")),
  wompiPrivateKeyTest: z.string().optional().or(z.literal("")),
  wompiEventsKeyTest: z.string().optional().or(z.literal("")),
  wompiIntegrityKeyTest: z.string().optional().or(z.literal("")),
  wompiPublicKeyProd: z.string().optional().or(z.literal("")),
  wompiPrivateKeyProd: z.string().optional().or(z.literal("")),
  wompiEventsKeyProd: z.string().optional().or(z.literal("")),
  wompiIntegrityKeyProd: z.string().optional().or(z.literal("")),
});

export const shippingConfigSchema = z.object({
  shippingFlatRate: z.coerce
    .number()
    .min(0, "No puede ser negativo")
    .optional()
    .nullable(),
  freeShippingThreshold: z.coerce
    .number()
    .min(0, "No puede ser negativo")
    .optional()
    .nullable(),
  shippingNotes: z
    .string()
    .max(500, "Máximo 500 caracteres")
    .optional()
    .or(z.literal("")),
});

export const storeConfigSchema = z.object({
  storefrontSlug: slugField,
});

/// Zonas de envío por región (ver shipping-zone-service.ts) — regions se
/// valida de verdad (contra COLOMBIA_REGIONS) en el servicio, acá solo se
/// exige que no venga vacío.
/// Una tarifa dentro de una zona — NONE siempre aplica; MIN_ORDER_AMOUNT/
/// MIN_WEIGHT necesitan su umbral (ver pickShippingRate en
/// shipping-zone-service.ts, que elige la más barata entre las que
/// aplican al pedido).
const shippingRateSchema = z.object({
  name: z.string().min(2, "Ingresa un nombre para la tarifa").max(80),
  price: z.coerce.number().min(0, "No puede ser negativo"),
  condition: z.enum(["NONE", "MIN_ORDER_AMOUNT", "MIN_WEIGHT"]),
  conditionValue: z.coerce
    .number()
    .positive("Ingresa un umbral mayor a cero")
    .optional()
    .nullable(),
});

export const shippingZoneSchema = z.object({
  name: z.string().min(2, "Ingresa un nombre para la zona").max(80),
  regions: z.array(z.string().min(1)).min(1, "Elige al menos una región"),
  rates: z.array(shippingRateSchema).min(1, "Agrega al menos una tarifa"),
});

export const deleteShippingZoneSchema = z.object({
  zoneId: z.string().min(1),
});

export const setCustomDomainSchema = z.object({
  domain: z.string().min(3, "Ingresa un dominio").max(255),
});

export const setStorefrontTemplateSchema = z.object({
  template: z.enum(["CLASICA", "MINIMAL", "EDITORIAL"]),
});

/// La marca confirma (o ajusta) la fecha/hora real de una reserva de
/// servicio ya pagada, desde Pedidos — ver confirmServiceBooking en
/// store-order-service.ts.
export const confirmServiceBookingSchema = z.object({
  orderId: z.string().min(1),
  itemId: z.string().min(1),
  confirmedAt: z.string().min(1, "Elige fecha y hora"),
  meetingInfo: z.string().max(300).optional().or(z.literal("")),
});

const percent = z
  .number()
  .min(0, "Debe ser 0 o más")
  .max(100, "No puede superar 100");

export const offerSchema = z.object({
  name: z.string().min(2, "Ingresa un nombre para la oferta"),
  description: z.string().optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
  defaultCommissionPercent: percent,
  defaultDiscountPercent: percent,
  joinMode: z.enum(["OPEN", "APPROVAL"]),
});

export const updateOfferSchema = offerSchema.extend({
  status: z.enum(["ACTIVE", "PAUSED"]),
});

export const enrollmentOverrideSchema = z.object({
  enrollmentId: z.string().min(1),
  commissionPercentOverride: z.number().min(0).max(100).nullable(),
  discountPercentOverride: z.number().min(0).max(100).nullable(),
});

export const enrollmentDecisionSchema = z.object({
  enrollmentId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
});

const money = z.number().positive("Debe ser mayor a 0");

const challengeConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("GOAL_BONUS"),
    goalAmount: money,
    bonusAmount: money,
  }),
  // FLASH_SALE y MIX traen los dos campos como opcionales — la validación de
  // "al menos uno de los dos" va en los .refine() de abajo, porque
  // discriminatedUnion necesita que cada rama sea un z.object() plano.
  z.object({
    type: z.literal("FLASH_SALE"),
    newCommissionPercent: percent.optional(),
    newDiscountPercent: percent.optional(),
  }),
  z.object({
    type: z.literal("MIX"),
    goalAmount: money,
    bonusAmount: money,
    newCommissionPercent: percent.optional(),
    newDiscountPercent: percent.optional(),
  }),
  z.object({
    type: z.literal("LEADERBOARD"),
    winnersCount: z.number().int().min(1).max(20),
    prizes: z.array(money).min(1).max(20),
  }),
  z.object({
    type: z.literal("WELCOME_BONUS"),
    slotsCount: z.number().int().min(1),
    bonusPerSlot: money,
  }),
  z.object({
    type: z.literal("CONTENT_CHALLENGE"),
    instructions: z.string().min(5, "Describe qué debe hacer el creador"),
    bonusAmount: money,
  }),
]);

export const challengeSchema = z
  .object({
    offerId: z.string().min(1),
    name: z.string().min(2, "Ingresa un nombre para la campaña"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    config: challengeConfigSchema,
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "La fecha de fin debe ser después del inicio",
    path: ["endDate"],
  })
  .refine(
    (data) =>
      data.config.type !== "LEADERBOARD" ||
      data.config.prizes.length === data.config.winnersCount,
    { message: "Debes poner un premio por cada ganador", path: ["config"] },
  )
  .refine(
    (data) =>
      (data.config.type !== "FLASH_SALE" && data.config.type !== "MIX") ||
      data.config.newCommissionPercent != null ||
      data.config.newDiscountPercent != null,
    { message: "Sube la comisión, el descuento, o ambos", path: ["config"] },
  );

export const reviewSubmissionSchema = z.object({
  rewardId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
});

export const sendMessageSchema = z.object({
  enrollmentId: z.string().min(1),
  body: z.string().min(1, "Escribe algo").max(2000, "Máximo 2000 caracteres"),
});

export const sendProductSchema = z.object({
  enrollmentId: z.string().min(1),
  description: z.string().min(2, "Describe qué le estás enviando"),
  shippingAddress: z.string().min(5, "Ingresa la dirección de envío"),
  carrier: z.string().optional().or(z.literal("")),
  trackingNumber: z.string().optional().or(z.literal("")),
});

export const markShipmentSentSchema = z.object({
  shipmentId: z.string().min(1),
  carrier: z.string().optional().or(z.literal("")),
  trackingNumber: z.string().optional().or(z.literal("")),
});

/// occurredAt viene como string ISO desde un <input type="date"> del
/// formulario — no puede ser futura ni más vieja que 90 días (evita cargar
/// "ventas" que en realidad son un error de digitación de años).
export const recordManualSaleSchema = z.object({
  discountCode: z.string().min(1, "Elige el código de la venta"),
  grossAmount: z.coerce.number().positive("El monto debe ser mayor a cero"),
  occurredAt: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Fecha inválida")
    .refine(
      (v) => new Date(v).getTime() <= Date.now() + 24 * 60 * 60 * 1000,
      "La fecha no puede ser futura",
    )
    .refine(
      (v) => new Date(v).getTime() >= Date.now() - 90 * 24 * 60 * 60 * 1000,
      "La fecha es demasiado vieja — revisa que sea correcta",
    ),
  note: z
    .string()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  /// Opcional — si la marca lo sabe (ej. lo tiene en el pedido de
  /// WhatsApp/Instagram), ayuda al detector de fraude "comprador =
  /// creador" (ver checkBuyerIsCreator en attribution-service.ts).
  customerEmail: z
    .string()
    .email("Correo inválido")
    .optional()
    .or(z.literal("")),
});

/// Muestras (ver sample-service.ts) — el toggle rápido en Mi tienda →
/// Muestras se aplica a cualquier producto del catálogo (manual o
/// sincronizado), no solo a los creados a mano.
export const sampleSettingsSchema = z.object({
  productId: z.string().min(1),
  sampleEnabled: z.boolean(),
  sampleStock: z.coerce.number().int().min(0, "No puede ser negativo"),
  /// Instrucciones para quien pida la muestra — el creador las ve ANTES de
  /// pedirla, en su tarjeta de producto.
  sampleContentType: z.string().max(80).optional().or(z.literal("")),
  sampleInstructions: z.string().max(500).optional().or(z.literal("")),
  sampleDeadlineDays: z
    .preprocess(
      (val) => (val === "" || val == null ? undefined : val),
      z.coerce.number().int().min(1, "Mínimo 1 día").max(90, "Máximo 90 días"),
    )
    .optional(),
});

export const respondSampleRequestSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  rejectedReason: z.string().max(300).optional().or(z.literal("")),
});

// ----------------------------------------------------------------------------
// Buscador de creadores — la marca "recluta" en vez de solo esperar (ver
// conversación del 2026-09-06).
// ----------------------------------------------------------------------------

const overridePercent = z.coerce
  .number()
  .min(0, "Debe ser 0 o más")
  .max(100, "No puede superar 100")
  .optional()
  .nullable();

export const inviteCreatorSchema = z.object({
  offerId: z.string().min(1),
  creatorId: z.string().min(1),
  commissionPercentOverride: overridePercent,
  discountPercentOverride: overridePercent,
  message: z.string().max(300).optional().or(z.literal("")),
});

export const offerSampleToCreatorSchema = z.object({
  creatorId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(5),
  message: z.string().max(300).optional().or(z.literal("")),
});

// ----------------------------------------------------------------------------
// Licenciamiento de contenido — la marca alquila un post ya publicado de un
// creador vinculado para reusarlo como pauta paga (ver
// content-license-service.ts).
// ----------------------------------------------------------------------------

export const rentContentLicenseSchema = z.object({
  contentId: z.string().min(1),
  durationDays: z.coerce.number().int().refine((n) => [30, 60, 90].includes(n), {
    message: "Elige 30, 60 o 90 días",
  }),
});

// ----------------------------------------------------------------------------
// Contenido pagado encargado — la marca le pide a un creador vinculado que
// haga algo nuevo por un fee fijo (ver paid-content-service.ts).
// ----------------------------------------------------------------------------

export const requestPaidContentSchema = z.object({
  creatorId: z.string().min(1),
  briefing: z.string().min(10, "Cuéntale al creador qué necesitas (mínimo 10 caracteres)").max(1000),
  feeAmount: z.coerce.number().positive("Debe ser mayor a 0"),
  deadlineDays: z.coerce.number().int().min(1).max(90).optional().nullable(),
});

export const cancelPaidContentSchema = z.object({
  requestId: z.string().min(1),
});
