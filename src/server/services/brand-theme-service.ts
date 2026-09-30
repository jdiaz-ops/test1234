import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  parseThemeConfig,
  deepMergeThemeConfig,
  sanitizeCustomCss,
  DEFAULT_THEME_CONFIG,
  type ThemeConfig,
} from "@/lib/brand-theme";

export class BrandThemeError extends Error {}

/// El borrador que edita la marca en el editor de Diseño — nunca lo que
/// ve el comprador (ver getPublishedTheme). Si la marca nunca tocó nada,
/// devuelve los valores por defecto (el look actual de Marcolini).
export async function getDraftTheme(brandId: string): Promise<ThemeConfig> {
  const row = await prisma.brandTheme.findUnique({ where: { brandId } });
  if (!row) return DEFAULT_THEME_CONFIG;
  return parseThemeConfig(row.draftConfig);
}

/// Lo que de verdad renderiza la vitrina pública — solo cambia cuando la
/// marca le da "Publicar cambios" en el editor. Null/sin fila = todavía
/// no publicó nada, se ve el look por defecto.
export async function getPublishedTheme(brandId: string): Promise<ThemeConfig> {
  const row = await prisma.brandTheme.findUnique({ where: { brandId } });
  if (!row?.publishedConfig) return DEFAULT_THEME_CONFIG;
  return parseThemeConfig(row.publishedConfig);
}

/// true si esta petición es la vista previa del editor de Diseño: la
/// vitrina cargada dentro de un iframe (Sec-Fetch-Dest: iframe) por la
/// marca dueña de esa tienda. Cualquier otra visita — compradores, la
/// marca en una pestaña normal, otro sitio que la enmarque — no lo es.
async function isOwnerPreviewRequest(brandId: string): Promise<boolean> {
  const requestHeaders = await headers();
  if (requestHeaders.get("sec-fetch-dest") !== "iframe") return false;
  const session = await auth();
  if (!session?.user || session.user.role !== "BRAND") return false;
  const profile = await prisma.brandProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  return profile?.id === brandId;
}

/// El tema que renderiza la vitrina para ESTA petición: el borrador si es
/// la marca mirando su tienda desde la vista previa del editor (ver
/// design-preview.tsx), lo publicado para todo el mundo. Así la vista
/// previa es la tienda real con los cambios sin publicar, en vez de un
/// dibujo aproximado. Ver conversación del 2026-09-30.
export async function getStorefrontTheme(brandId: string): Promise<ThemeConfig> {
  if (await isOwnerPreviewRequest(brandId)) return getDraftTheme(brandId);
  return getPublishedTheme(brandId);
}

/// Aplica un patch parcial (deep-merge) sobre el borrador actual y lo
/// revalida entero — así el editor puede mandar solo lo que cambió (ej.
/// `{ colors: { principal: "#123456" } }`) sin tener que releer y
/// reenviar la config completa en cada click.
export async function updateDraftTheme(
  brandId: string,
  patch: Record<string, unknown>,
): Promise<ThemeConfig> {
  const existing = await prisma.brandTheme.findUnique({ where: { brandId } });
  const currentDraft = existing ? parseThemeConfig(existing.draftConfig) : DEFAULT_THEME_CONFIG;
  const mergedRaw = deepMergeThemeConfig(
    currentDraft as unknown as Record<string, unknown>,
    patch,
  );
  if (typeof mergedRaw.customCss === "string") {
    mergedRaw.customCss = sanitizeCustomCss(mergedRaw.customCss);
  }
  const validated = parseThemeConfig(mergedRaw);
  await prisma.brandTheme.upsert({
    where: { brandId },
    create: { brandId, draftConfig: validated as unknown as Prisma.InputJsonValue },
    update: { draftConfig: validated as unknown as Prisma.InputJsonValue },
  });
  return validated;
}

/// Copia el borrador a publicado — recién acá el comprador empieza a ver
/// los cambios. Si la marca nunca tocó nada, publica los valores por
/// defecto (no rompe nada, es el mismo look de hoy).
export async function publishTheme(brandId: string): Promise<ThemeConfig> {
  const existing = await prisma.brandTheme.findUnique({ where: { brandId } });
  const draft = existing ? parseThemeConfig(existing.draftConfig) : DEFAULT_THEME_CONFIG;
  await prisma.brandTheme.upsert({
    where: { brandId },
    create: {
      brandId,
      draftConfig: draft as unknown as Prisma.InputJsonValue,
      publishedConfig: draft as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
    },
    update: {
      publishedConfig: draft as unknown as Prisma.InputJsonValue,
      publishedAt: new Date(),
    },
  });
  return draft;
}

/// Descarta los cambios sin publicar — vuelve el borrador a lo último
/// publicado (o a los valores por defecto si nunca publicó nada).
export async function discardDraftTheme(brandId: string): Promise<ThemeConfig> {
  const existing = await prisma.brandTheme.findUnique({ where: { brandId } });
  const published = existing?.publishedConfig
    ? parseThemeConfig(existing.publishedConfig)
    : DEFAULT_THEME_CONFIG;
  await prisma.brandTheme.upsert({
    where: { brandId },
    create: { brandId, draftConfig: published as unknown as Prisma.InputJsonValue },
    update: { draftConfig: published as unknown as Prisma.InputJsonValue },
  });
  return published;
}
