import { z } from "zod";

export const updateBrandProfileSchema = z.object({
  companyName: z.string().min(2, "Ingresa el nombre de la marca"),
  legalName: z.string().optional().or(z.literal("")),
  taxId: z.string().optional().or(z.literal("")),
  description: z.string().max(150).optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  websiteUrl: z.string().url("Ingresa una URL válida (https://...)").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  fiscalAddress: z.string().optional().or(z.literal("")),
  taxRegime: z.string().optional().or(z.literal("")),
  legalRepName: z.string().optional().or(z.literal("")),
  legalRepId: z.string().optional().or(z.literal("")),
  instagramHandle: z.string().optional().or(z.literal("")),
  tiktokHandle: z.string().optional().or(z.literal("")),
});

export const updateStoreSchema = z.object({
  storeType: z.enum(["SHOPIFY", "WOOCOMMERCE", "OTHER"]),
  storeUrl: z.string().url("Ingresa una URL válida (https://...)"),
  shopifyAccessToken: z.string().optional().or(z.literal("")),
  wooConsumerKey: z.string().optional().or(z.literal("")),
  wooConsumerSecret: z.string().optional().or(z.literal("")),
});

export const saveCardSchema = z.object({
  cardNumber: z.string().min(13, "Número de tarjeta inválido").max(19),
  expMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Mes inválido"),
  expYear: z.string().regex(/^\d{4}$/, "Año inválido"),
  cvc: z.string().regex(/^\d{3,4}$/, "CVC inválido"),
  holderName: z.string().min(2, "Ingresa el nombre del titular"),
  holderEmail: z.string().email("Ingresa un correo válido"),
});

const percent = z.number().min(0, "Debe ser 0 o más").max(100, "No puede superar 100");

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
  z.object({ type: z.literal("GOAL_BONUS"), goalAmount: money, bonusAmount: money }),
  z.object({ type: z.literal("TEMP_COMMISSION_BOOST"), newCommissionPercent: percent }),
  z.object({
    type: z.literal("LEADERBOARD"),
    winnersCount: z.number().int().min(1).max(20),
    prizes: z.array(money).min(1).max(20),
  }),
  z.object({ type: z.literal("WELCOME_BONUS"), slotsCount: z.number().int().min(1), bonusPerSlot: money }),
  z.object({
    type: z.literal("CONTENT_CHALLENGE"),
    instructions: z.string().min(5, "Describe qué debe hacer el creador"),
    bonusAmount: money,
  }),
]);

export const challengeSchema = z
  .object({
    offerId: z.string().min(1),
    name: z.string().min(2, "Ingresa un nombre para el reto"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    config: challengeConfigSchema,
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "La fecha de fin debe ser después del inicio",
    path: ["endDate"],
  })
  .refine(
    (data) => data.config.type !== "LEADERBOARD" || data.config.prizes.length === data.config.winnersCount,
    { message: "Debes poner un premio por cada ganador", path: ["config"] }
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
