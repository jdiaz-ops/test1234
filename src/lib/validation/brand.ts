import { z } from "zod";

export const updateBrandProfileSchema = z.object({
  companyName: z.string().min(2, "Ingresa el nombre de la marca"),
  legalName: z.string().optional().or(z.literal("")),
  taxId: z.string().optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
});

export const updateStoreSchema = z.object({
  storeType: z.enum(["SHOPIFY", "WOOCOMMERCE", "OTHER"]),
  storeUrl: z.string().url("Ingresa una URL válida (https://...)"),
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
