import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ThemeConfig } from "@/lib/brand-theme";
import { getDraftTheme, getPublishedTheme } from "@/server/services/brand-theme-store";

export {
  BrandThemeError,
  discardDraftTheme,
  getDraftTheme,
  getPublishedTheme,
  publishTheme,
  updateDraftTheme,
} from "@/server/services/brand-theme-store";

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
