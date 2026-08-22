import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Ingresa tu nombre"),
  bio: z.string().max(280, "Máximo 280 caracteres").optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  verticalId: z.string().nullable().optional(),
  socialLinks: z
    .array(
      z.object({
        platform: z.string().min(1),
        handle: z.string().min(1),
        approxFollowers: z.number().int().nonnegative().nullable().optional(),
      })
    )
    .max(10),
});

export const updatePaymentSchema = z.object({
  bankName: z.string().min(2, "Ingresa el nombre del banco/entidad"),
  bankAccountType: z.string().min(1, "Selecciona el tipo de cuenta"),
  bankAccountNumber: z.string().min(4, "Ingresa el número de cuenta"),
  paymentHolderName: z.string().min(2, "Ingresa el nombre del titular"),
});

export const joinOfferSchema = z.object({
  offerId: z.string().min(1),
});

export const submitContentChallengeSchema = z.object({
  challengeId: z.string().min(1),
  submissionUrl: z.string().url("Ingresa un link válido (https://...)"),
  submissionNote: z.string().max(500).optional().or(z.literal("")),
});
