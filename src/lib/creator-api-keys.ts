import { createHash, timingSafeEqual } from "node:crypto";

/// Llaves de la API de catálogo para creadoras (ver
/// src/app/api/v1/catalogo/route.ts). Viven en la variable de entorno
/// CATALOG_API_KEYS como "slug:llave", separadas por coma o salto de
/// línea — el slug es el de la vitrina de la creadora (storefrontSlug).
/// Sin tabla ni pantalla: hoy la usa un solo sitio (Nail Fest, pedido del
/// 2026-10-20) y dar o quitar acceso es editar la variable. Una llave de
/// menos de 32 caracteres se ignora, para que nunca quede una adivinable.
export const MIN_CATALOG_KEY_LENGTH = 32;

export type CatalogApiKeyEntry = { slug: string; key: string };

export function parseCatalogApiKeys(raw: string | null | undefined): CatalogApiKeyEntry[] {
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((entry) => {
      const colon = entry.indexOf(":");
      if (colon <= 0) return null;
      const slug = entry.slice(0, colon).trim().toLowerCase();
      const key = entry.slice(colon + 1).trim();
      return slug && key.length >= MIN_CATALOG_KEY_LENGTH ? { slug, key } : null;
    })
    .filter((entry): entry is CatalogApiKeyEntry => entry !== null);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/// El slug de la creadora dueña de la llave, o null. Compara contra todas
/// las llaves y siempre por el hash (mismo largo, tiempo constante), así la
/// respuesta no deja adivinar una llave letra por letra.
export function matchCatalogApiKey(entries: CatalogApiKeyEntry[], presented: string | null | undefined): string | null {
  if (!presented) return null;
  const given = digest(presented);
  let match: string | null = null;
  for (const entry of entries) {
    if (timingSafeEqual(given, digest(entry.key)) && match === null) match = entry.slug;
  }
  return match;
}

/// "Authorization: Bearer <llave>".
export function bearerToken(req: Request): string | null {
  const match = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)\s*$/i);
  return match ? match[1] : null;
}
