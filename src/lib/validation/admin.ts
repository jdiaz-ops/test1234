import { z } from "zod";

export const brandDecisionSchema = z.object({
  brandId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT", "PAUSE", "REACTIVATE"]),
});

export const brandFeeOverrideSchema = z.object({
  brandId: z.string().min(1),
  feePercent: z.number().min(0).max(100).nullable(),
});

export const brandMarketplaceVisibilitySchema = z.object({
  brandId: z.string().min(1),
  override: z.enum(["AUTO", "FORCE_VISIBLE", "FORCE_HIDDEN"]),
});

export const creatorSuspendSchema = z.object({
  creatorId: z.string().min(1),
  suspended: z.boolean(),
});

export const platformConfigSchema = z.object({
  defaultPlatformFeePercent: z.number().min(0).max(100),
  vatPercent: z.number().min(0).max(100),
  chargeDayOfMonth: z.number().int().min(1).max(28),
  payoutDayOfMonth: z.number().int().min(1).max(28),
  refundHoldDays: z.number().int().min(0).max(90),
  instantPayoutFeePercent: z.number().min(0).max(100),
  paymentInstructions: z.string().max(2000).optional().or(z.literal("")),
  paymentGraceHours: z.number().int().min(1).max(24 * 30),
  deactivationGraceHours: z.number().int().min(1).max(24 * 30),
});

export const verifyChargeSchema = z.object({
  chargeId: z.string().min(1),
});

export const rejectChargeSchema = z.object({
  chargeId: z.string().min(1),
  reason: z.string().min(2, "Explica por qué se rechaza"),
});

export const legalContentSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

export const fraudReviewSchema = z.object({
  flagId: z.string().min(1),
  status: z.enum(["CLEARED", "CONFIRMED_FRAUD"]),
});

export const monthlyCostSchema = z.object({
  month: z.string().min(1), // ISO date, día 1 del mes
  label: z.string().min(1).max(120), // qué es el gasto — ej. "Compra del dominio"
  amount: z.number().positive(),
});

export const adminRoleEnum = z.enum(["OWNER", "SUPPORT", "FINANCE", "BRAND_APPROVER", "CREATOR_APPROVER"]);

export const createAdminSchema = z.object({
  email: z.string().email(),
  adminRole: adminRoleEnum,
  temporaryPassword: z.string().min(8, "Mínimo 8 caracteres"),
});

export const updateAdminRoleSchema = z.object({
  userId: z.string().min(1),
  adminRole: adminRoleEnum,
});

export const removeAdminSchema = z.object({
  userId: z.string().min(1),
});

export const createBrandManuallySchema = z.object({
  email: z.string().email(),
  companyName: z.string().min(2, "Ingresa el nombre de la marca"),
  city: z.string().optional().or(z.literal("")),
});

export const createCreatorManuallySchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2, "Ingresa el nombre del creador"),
  desiredCode: z.string().min(2, "Ingresa un código deseado"),
  city: z.string().optional().or(z.literal("")),
});

export const broadcastSchema = z.object({
  audience: z.enum(["BRANDS", "CREATORS"]),
  channels: z.array(z.enum(["EMAIL", "NOTIFICATION"])).min(1, "Elige al menos un canal"),
  subject: z.string().min(2, "Ingresa un asunto"),
  body: z.string().min(2, "Escribe el mensaje"),
});
