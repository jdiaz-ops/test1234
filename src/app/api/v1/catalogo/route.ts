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
  const slug = matchCatalogApiKey(parseCatalogApiKeys(process.env.CATALOG_API_KEYS), bearerToken(req));
  if (!slug) {
    // Los intentos con llave equivocada se cuentan por IP, para que no se
    // pueda probar llaves sin freno.
    const attempts = await rateLimit(`catalogo-api-fallo:${clientIp(req)}`, 20, 600);
    if (!attempts.ok) return tooMany(attempts.retryAfterSeconds);
    return NextResponse.json(
      { error: "Falta la llave o no es válida. Envíala como «Authorization: Bearer <llave>»." },
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
