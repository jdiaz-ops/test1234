import { z } from "zod";

/// Buzón de sugerencias (ver suggestion-service.ts): lo que se comparte
/// entre el formulario, la API y Admin → Sugerencias.

export const SUGGESTION_KINDS = [
  { value: "IDEA", label: "Quiero ver…", admin: "Idea" },
  { value: "IMPROVEMENT", label: "Mejora", admin: "Mejora" },
  { value: "PROBLEM", label: "Se me hace difícil", admin: "Dificultad" },
  { value: "COMPLAINT", label: "Queja", admin: "Queja" },
] as const;
export type SuggestionKindId = (typeof SUGGESTION_KINDS)[number]["value"];

export const SUGGESTION_STATUS = {
  NEW: { label: "Enviada", admin: "Nueva", chip: "bg-brand-accent-soft text-brand-accent" },
  READ: { label: "Leída", admin: "Leída", chip: "bg-sky-50 text-sky-700" },
  DONE: { label: "Resuelta", admin: "Resuelta", chip: "bg-emerald-50 text-emerald-700" },
} as const;
export type SuggestionStatusId = keyof typeof SUGGESTION_STATUS;

export const SUGGESTION_MAX_CHARS = 4000;
/// Tope de la nota de voz: 3 minutos caben con holgura en el límite de
/// subida (ver MAX_AUDIO_BYTES en file-upload.ts).
export const SUGGESTION_MAX_AUDIO_SECONDS = 180;

export const suggestionInputSchema = z.object({
  kind: z.enum(["IDEA", "IMPROVEMENT", "PROBLEM", "COMPLAINT"]).optional(),
  message: z
    .string()
    .trim()
    .max(SUGGESTION_MAX_CHARS, `Máximo ${SUGGESTION_MAX_CHARS} caracteres.`)
    .optional()
    .transform((v) => v || undefined),
  pagePath: z
    .string()
    .max(300)
    .optional()
    .transform((v) => (v?.startsWith("/") ? v : undefined)),
  audioSeconds: z.coerce.number().int().min(0).max(SUGGESTION_MAX_AUDIO_SECONDS + 5).optional(),
});
export type SuggestionInput = z.infer<typeof suggestionInputSchema>;

/// 0:42, 2:05.
export function formatAudioLength(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
