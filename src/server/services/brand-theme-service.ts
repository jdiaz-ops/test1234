import type { Prisma } from "@prisma/client";
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
