import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Ingresa tu nombre"),
  legalName: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  bio: z.string().max(280, "Máximo 280 caracteres").optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  verticalId: z.string().nullable().optional(),
  // Opcional — PaymentForm también le pega a este endpoint (para nombre
  // completo/celular/ciudad, que ahora viven en el paso de pago) sin tocar
  // las redes sociales. Ausente = no se modifica.
  socialLinks: z
    .array(
      z.object({
        platform: z.string().min(1),
        handle: z.string().min(1),
        approxFollowers: z.number().int().nonnegative().nullable().optional(),
      })
    )
    .max(10)
    .optional(),
});

export const updateInterestsSchema = z.object({
  verticalIds: z.array(z.string().min(1)).max(20),
});

export const updatePaymentSchema = z
  .object({
    documentId: z.string().optional().or(z.literal("")),
    payoutMethod: z.enum(["BANK", "BRE_B"]),
    breBKey: z.string().optional().or(z.literal("")),
    bankName: z.string().optional().or(z.literal("")),
    bankAccountType: z.string().optional().or(z.literal("")),
    bankAccountNumber: z.string().optional().or(z.literal("")),
    paymentHolderName: z.string().optional().or(z.literal("")),
  })
  .refine((data) => data.payoutMethod !== "BRE_B" || data.breBKey, {
    message: "Ingresa tu llave Bre-B",
    path: ["breBKey"],
  })
  .refine((data) => data.payoutMethod !== "BANK" || (data.bankName && data.bankAccountNumber && data.paymentHolderName), {
    message: "Completa los datos de la cuenta bancaria",
    path: ["bankName"],
  });

export const updateStorefrontSchema = z.object({
  storefrontPalette: z.string().min(1),
  storefrontFont: z.string().min(1),
  storefrontHeadline: z.string().max(120).optional().or(z.literal("")),
  bio: z.string().max(280).optional().or(z.literal("")),
});

export const updateEnrollmentDisplaySchema = z.object({
  items: z
    .array(
      z.object({
        enrollmentId: z.string().min(1),
        storefrontVisible: z.boolean(),
        storefrontOrder: z.number().int(),
      })
    )
    .max(200),
});

export const joinOfferSchema = z.object({
  offerId: z.string().min(1),
  discountCode: z
    .string()
    .min(3, "El código debe tener al menos 3 caracteres")
    .max(30, "El código es demasiado largo")
    .optional()
    .or(z.literal("")),
});

export const leaveOfferSchema = z.object({
  enrollmentId: z.string().min(1),
});

export const submitContentChallengeSchema = z.object({
  challengeId: z.string().min(1),
  submissionUrl: z.string().url("Ingresa un link válido (https://...)"),
  submissionNote: z.string().max(500).optional().or(z.literal("")),
});

export const sendMessageSchema = z.object({
  enrollmentId: z.string().min(1),
  body: z.string().min(1, "Escribe algo").max(2000, "Máximo 2000 caracteres"),
});

export const requestProductSchema = z.object({
  enrollmentId: z.string().min(1),
  description: z.string().min(2, "Describe qué producto necesitas"),
  shippingAddress: z.string().min(5, "Ingresa la dirección de envío"),
});
