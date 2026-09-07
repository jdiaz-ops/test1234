import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/// Endpoint público (sin sesión) que llama el bookmarklet del creador
/// (ver /creador/codigos) desde CUALQUIER sitio donde lo use — por eso
/// lleva CORS abierto. `creatorId` va en la URL en vez de resolverse por
/// cookie de sesión porque el bookmarklet corre en el origen de la página
/// donde se hace clic (no en marcolini.lat), y las cookies de sesión con
/// SameSite=Lax no viajan en un fetch cross-site. No es un dato sensible:
/// es el mismo id que ya es público en marcolini.lat/c/{storefrontSlug}, y
/// esto solo permite CONSULTAR si ese creador tiene código con la marca del
/// host indicado — nunca escribe nada.
function withCors(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}

function normalizeHost(host: string) {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ creatorId: string }> },
) {
  const { creatorId } = await params;
  const url = new URL(req.url);
  const host = url.searchParams.get("host");
  const path = url.searchParams.get("path") || "/";
  if (!host) return withCors({ error: "Falta el host" }, 400);

  const targetHost = normalizeHost(host);

  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { creatorId, status: "ACTIVE" },
    include: { offer: { include: { brand: true } } },
  });

  for (const e of enrollments) {
    const { brand } = e.offer;
    if (!brand.storeUrl) continue;
    let brandHost: string;
    try {
      brandHost = normalizeHost(new URL(brand.storeUrl).hostname);
    } catch {
      continue;
    }
    if (brandHost !== targetHost) continue;

    // Igual truco que buildProductLink (brand-store-link.ts) — en Shopify
    // el código queda aplicado de una vez, y `redirect` lo manda de vuelta
    // a la misma página exacta donde estaba (no solo al home de la tienda).
    const link =
      brand.storeType === "SHOPIFY"
        ? `https://${brandHost}/discount/${encodeURIComponent(e.discountCode)}?redirect=${encodeURIComponent(path)}`
        : brand.storeUrl;

    return withCors({ code: e.discountCode, link, brand: brand.companyName });
  }

  return withCors({});
}
