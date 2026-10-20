import { NextResponse } from "next/server";
import { bearerToken, matchCatalogApiKey, parseCatalogApiKeys } from "@/lib/creator-api-keys";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { CreatorCatalogError, getCreatorCatalog } from "@/server/services/creator-catalog-api-service";

/// API de catálogo para el sitio propio de una creadora — hoy Nail Fest
/// (nailfest.lat/cuponera, pedido del 2026-10-20). Solo lectura: las
/// marcas que tienen a la creadora ACTIVE y lo que esas marcas tienen a la
/// venta, con su código y el link que le atribuye la venta. La llave dice
/// de qué creadora es (CATALOG_API_KEYS, ver creator-api-keys.ts). Sin
/// CORS a propósito: se llama de servidor a servidor, la llave nunca va en
/// un navegador. Documentación: docs/api-catalogo.md.
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

function tooMany(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Demasiadas peticiones. Espera un momento y vuelve a intentarlo." },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function GET(req: Request) {
  const keys = parseCatalogApiKeys(process.env.CATALOG_API_KEYS);
  const presented = bearerToken(req);
  const slug = matchCatalogApiKey(keys, presented);
  if (!slug) {
    // Los intentos con llave equivocada se cuentan por IP, para que no se
    // pueda probar llaves sin freno.
    const attempts = await rateLimit(`catalogo-api-fallo:${clientIp(req)}`, 20, 600);
    if (!attempts.ok) return tooMany(attempts.retryAfterSeconds);
    // `reason` le dice al otro sitio dónde está el problema: de este lado
    // (no hay ninguna llave bien escrita en CATALOG_API_KEYS), en el camino
    // (no llegó ninguna llave — un fetch la suelta si lo redirigen a otro
    // dominio) o del suyo (llegó una que no coincide). `keyLengths` dice
    // cuántos caracteres tienen las de acá, para ver a cuál le sobra o le
    // falta algo. Nunca se revela ninguna parte de una llave.
    const reason = keys.length === 0 ? "no_keys" : presented ? "mismatch" : "missing_key";
    const errors = {
      no_keys: "Marcolini no tiene configurada ninguna llave del catálogo (CATALOG_API_KEYS vacía o sin el formato «slug:llave»).",
      missing_key: "No llegó ninguna llave. Envíala como «Authorization: Bearer <llave>».",
      mismatch: "La llave no coincide con ninguna de las que tiene Marcolini.",
    };
    return NextResponse.json(
      { error: errors[reason], reason, keyLengths: keys.map((k) => k.key.length) },
      { status: 401, headers: { ...NO_STORE, "WWW-Authenticate": "Bearer" } },
    );
  }

  const calls = await rateLimit(`catalogo-api:${slug}`, 120, 60);
  if (!calls.ok) return tooMany(calls.retryAfterSeconds);

  const params = new URL(req.url).searchParams;
  try {
    const catalog = await getCreatorCatalog(slug, {
      cursor: params.get("cursor"),
      limit: params.has("limit") ? Number(params.get("limit")) : null,
    });
    return NextResponse.json(catalog, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof CreatorCatalogError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    throw err;
  }
}
