import { z } from "zod";

/// Opciones del formulario de lista de espera (/lista-de-espera). Se
/// guardan tal cual como texto, así que cambiar una no rompe lo ya
/// guardado. Ver waitlist-service.ts.

export const CREATOR_AUDIENCE_OPTIONS = [
  "Menos de 1.000",
  "1.000 a 10.000",
  "10.000 a 50.000",
  "50.000 a 100.000",
  "Más de 100.000",
] as const;

/// Redes extra que el creador puede agregar además de Instagram y TikTok
/// (su fuerte puede estar en otra plataforma).
export const EXTRA_SOCIAL_PLATFORMS = [
  "YouTube",
  "Facebook",
  "X (Twitter)",
  "Threads",
  "Pinterest",
  "Twitch",
  "Kwai",
  "Blog o web",
  "Otra",
] as const;

export type SocialProfile = { platform: string; handle: string };

/// "Instagram: @laura · YouTube: youtube.com/@laura" — para Admin y Excel.
export function socialsText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter((s): s is SocialProfile => typeof s?.platform === "string" && typeof s?.handle === "string")
    .map((s) => {
      // Un link o una web se muestran tal cual; un usuario, con @.
      const isLink = s.handle.includes("/") || s.platform === "Blog o web" || s.platform === "Web";
      return `${s.platform}: ${isLink ? s.handle : `@${s.handle}`}`;
    })
    .join(" · ");
}

export const CREATOR_CATEGORY_OPTIONS = [
  "Uñas",
  "Maquillaje",
  "Cuidado de la piel",
  "Cabello",
  "Moda",
  "Estilo de vida",
  "Otro",
] as const;

export const BRAND_CATEGORY_OPTIONS = [
  "Uñas",
  "Maquillaje",
  "Cuidado de la piel",
  "Cabello",
  "Moda",
  "Accesorios",
  "Otro",
] as const;

export const BRAND_SALES_CHANNEL_OPTIONS = [
  "Tienda online propia (Shopify, WooCommerce…)",
  "Solo redes sociales y WhatsApp",
  "Marketplaces (Mercado Libre, Falabella…)",
  "Tienda física",
  "Todavía no vendo",
] as const;

/// Cookie con los utm_* del primer anuncio que trajo a la persona (la
/// pauta apunta a /para-creadores, pero el formulario está en otra
/// página). La escribe <UtmCapture />, la lee la API al inscribirse.
export const UTM_COOKIE = "mc_utm";
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export type Attribution = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
};

const clip = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);

/// Lee la cookie (JSON) sin confiar en su contenido: solo textos cortos.
export function parseAttributionCookie(raw: string | undefined): Attribution {
  if (!raw) return {};
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    return {
      utmSource: clip(data.utm_source),
      utmMedium: clip(data.utm_medium),
      utmCampaign: clip(data.utm_campaign),
      utmContent: clip(data.utm_content),
      referrer: clip(data.referrer),
    };
  } catch {
    return {};
  }
}

/// Redes del formulario: descarta las vacías y pide al menos una.
const socialsSchema = z
  .array(z.object({ platform: z.string().trim().min(1).max(40), handle: z.string().trim().max(160) }))
  .max(12)
  .transform((list) =>
    list
      .map((s) => ({ platform: s.platform, handle: s.handle.replace(/^@+/, "").trim() }))
      .filter((s) => s.handle),
  )
  .refine((list) => list.length > 0, "Escribe al menos una red social o tu web");

export const creatorWaitlistSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(120),
  email: z.string().trim().email("Correo inválido").max(200),
  whatsapp: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v.replace(/\D/g, "").length >= 7, "Escribe tu número de WhatsApp"),
  socials: socialsSchema,
  audience: z.enum(CREATOR_AUDIENCE_OPTIONS, { message: "Elige cuántos seguidores tienes" }),
  category: z.enum(CREATOR_CATEGORY_OPTIONS, { message: "Elige de qué creas contenido" }),
});

export type CreatorWaitlistInput = z.infer<typeof creatorWaitlistSchema>;

export const brandWaitlistSchema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(120),
  company: z.string().trim().min(2, "Escribe el nombre de tu marca").max(120),
  email: z.string().trim().email("Correo inválido").max(200),
  whatsapp: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v.replace(/\D/g, "").length >= 7, "Escribe tu número de WhatsApp"),
  socials: socialsSchema,
  category: z.enum(BRAND_CATEGORY_OPTIONS, { message: "Elige qué vende tu marca" }),
  salesChannel: z.enum(BRAND_SALES_CHANNEL_OPTIONS, { message: "Elige dónde vendes hoy" }),
});

export type BrandWaitlistInput = z.infer<typeof brandWaitlistSchema>;
