import { createHash, timingSafeEqual } from "node:crypto";

/// Llaves de la API de catálogo para creadoras (ver
/// src/app/api/v1/catalogo/route.ts). Viven en la variable de entorno
/// CATALOG_API_KEYS como "slug:llave", separadas por coma, punto y coma o
/// salto de línea — el slug es el de la vitrina de la creadora
/// (storefrontSlug). Sin tabla ni pantalla: hoy la usa un solo sitio (Nail
/// Fest, pedido del 2026-10-20) y dar o quitar acceso es editar la
/// variable. Una llave de menos de 32 caracteres se ignora, para que nunca
/// quede una adivinable.
export const MIN_CATALOG_KEY_LENGTH = 32;

export type CatalogApiKeyEntry = { slug: string; key: string };

/// Lo que se cuela al pegar en Vercel alrededor de una llave o un slug:
/// comillas, espacios, asteriscos, el punto de la frase de donde se copió.
/// Una llave solo empieza y termina en letra o número (las de
/// `openssl rand -hex 32` son así), y a las dos puntas — la variable y la
/// que llega — se les quita lo mismo, así que siguen comparándose igual.
export function cleanCatalogKey(value: string): string {
  return value.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

export function parseCatalogApiKeys(raw: string | null | undefined): CatalogApiKeyEntry[] {
  if (!raw) return [];
  return raw
    .trim()
    // "CATALOG_API_KEYS=nailfest:llave" pegado entero en el valor.
    .replace(/^CATALOG_API_KEYS\s*=\s*/i, "")
    .split(/[\n,;]+/)
    .map((part) => {
      const entry = part.trim();
      const first = entry.indexOf(":");
      if (first <= 0) return null;
      const slug = cleanCatalogKey(entry.slice(0, first)).toLowerCase();
      // Lo de después de los ÚLTIMOS dos puntos: "nailfest: llave" y
      // "nailfest:nailfest:llave" también valen.
      const key = cleanCatalogKey(entry.slice(entry.lastIndexOf(":") + 1));
      return slug && key.length >= MIN_CATALOG_KEY_LENGTH && !/\s/.test(key) ? { slug, key } : null;
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
  const given = digest(cleanCatalogKey(presented));
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
