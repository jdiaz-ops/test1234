import crypto from "node:crypto";

/// Banners generados con el estilo de la tienda: cuando el organizador
/// necesita un banner ancho (la portada) y la marca solo tiene fotos de
/// producto cuadradas, se compone uno con los colores y la letra del tema
/// más la foto de la colección estrella — lo pinta /api/banner (ver
/// src/app/api/banner/route.tsx). La URL lleva la receta firmada con
/// AUTH_SECRET: sin la firma nadie puede usar el pintor con otras fotos o
/// textos. Ver conversación del 2026-10-19 ("que cree banners si es
/// necesario usando el estilo fiel de la tienda duplicada").

export type BannerSpec = {
  /// "wide" = 1600×600, para computador (texto a la izquierda, foto a la
  /// derecha). "mobile" = 1000×1000, para celular (foto arriba, texto
  /// abajo, legible en pantalla angosta).
  layout: "wide" | "mobile";
  title: string;
  subtitle: string;
  /// Texto del "botón" dibujado (vacío = sin botón).
  cta: string;
  /// Foto (https) que acompaña el texto; null = solo colores.
  image: string | null;
  /// Colores del tema (hex).
  bg: string;
  fg: string;
  accent: string;
  /// Letra de los títulos del tema (una de GOOGLE_FONT_OPTIONS).
  font: string;
};

/// Tamaños de cada formato (se muestran enteros, sin recortar).
export const BANNER_SIZES: Record<BannerSpec["layout"], { width: number; height: number }> = {
  wide: { width: 1600, height: 600 },
  mobile: { width: 1000, height: 1000 },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const HEX_SHORT = /^#[0-9a-fA-F]{3}$/;

export class BannerSpecError extends Error {}

export function normalizeBannerSpec(raw: unknown): BannerSpec {
  const r = (raw ?? {}) as Partial<BannerSpec>;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  // El tema admite "#fff"; acá siempre seis dígitos.
  const color = (v: unknown, fallback: string) => {
    if (typeof v !== "string") return fallback;
    if (HEX.test(v)) return v.toLowerCase();
    if (HEX_SHORT.test(v)) return `#${v.slice(1).split("").map((ch) => ch + ch).join("")}`.toLowerCase();
    return fallback;
  };
  let image: string | null = null;
  if (typeof r.image === "string" && r.image) {
    try {
      const url = new URL(r.image);
      if (url.protocol !== "https:") throw new BannerSpecError("La foto del banner debe ser https.");
      image = url.toString().slice(0, 1000);
    } catch (err) {
      if (err instanceof BannerSpecError) throw err;
      throw new BannerSpecError("La foto del banner no es una dirección válida.");
    }
  }
  return {
    layout: r.layout === "mobile" ? "mobile" : "wide",
    title: text(r.title, 60),
    subtitle: text(r.subtitle, 120),
    cta: text(r.cta, 30),
    image,
    bg: color(r.bg, "#ffffff"),
    fg: color(r.fg, "#111111"),
    accent: color(r.accent, "#111111"),
    font: text(r.font, 40) || "Instrument Sans",
  };
}

function signingKey() {
  const key = process.env.AUTH_SECRET;
  if (!key) throw new BannerSpecError("Falta AUTH_SECRET en el servidor — no se pueden firmar los banners.");
  return key;
}

export function encodeBannerSpec(spec: BannerSpec) {
  return Buffer.from(JSON.stringify(normalizeBannerSpec(spec)), "utf8").toString("base64url");
}

export function signBanner(encoded: string, key = signingKey()) {
  return crypto.createHmac("sha256", key).update(encoded).digest("base64url").slice(0, 32);
}

/// La URL (relativa, sirve en cualquier dominio de la vitrina) del banner.
export function bannerImageUrl(spec: BannerSpec, key?: string) {
  const encoded = encodeBannerSpec(spec);
  return `/api/banner?s=${encoded}&sig=${signBanner(encoded, key)}`;
}

export function isGeneratedBannerUrl(url: string) {
  return url.startsWith("/api/banner?");
}

/// La receta de una URL firmada, o null si la firma no calza.
export function verifyBanner(encoded: string, signature: string, key = signingKey()): BannerSpec | null {
  if (!encoded || !signature || encoded.length > 4000) return null;
  const expected = signBanner(encoded, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return normalizeBannerSpec(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}

/// Un color de texto legible sobre el fondo dado (para el botón dibujado).
export function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

/// Un tono suave del acento para el fondo (mezclado con el fondo).
export function mix(hexA: string, hexB: string, weight: number) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ch = (shift: number) => Math.round((((a >> shift) & 255) * (1 - weight)) + (((b >> shift) & 255) * weight));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}
