import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres");

export const registerCreatorSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: passwordSchema,
  displayName: z.string().min(2, "Ingresa tu username"),
  termsAccepted: z.literal(true, {
    message: "Debes aceptar los Términos y Condiciones",
  }),
  // Código de quien lo invitó (programa de referidos) — opcional, nunca
  // bloquea el registro si viene vacío o mal escrito.
  refCode: z.string().optional(),
});

export const registerBrandSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: passwordSchema,
  companyName: z.string().min(2, "Ingresa el nombre de tu marca"),
  city: z.string().optional(),
  termsAccepted: z.literal(true, {
    message: "Debes aceptar los Términos y Condiciones",
  }),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Correo inválido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: passwordSchema,
});
