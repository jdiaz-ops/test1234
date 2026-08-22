import { z } from "zod";

export const brandDecisionSchema = z.object({
  brandId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT", "PAUSE", "REACTIVATE"]),
});

export const brandFeeOverrideSchema = z.object({
  brandId: z.string().min(1),
  feePercent: z.number().min(0).max(100).nullable(),
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
  amount: z.number().min(0),
  note: z.string().optional(),
});

export const adminRoleEnum = z.enum(["OWNER", "SUPPORT", "FINANCE", "BRAND_APPROVER"]);

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
