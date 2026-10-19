import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { readImageBytes } from "@/server/services/image-bytes";

/// El logo de la tienda sin los bordes vacíos (transparentes o del color
/// del fondo), para que la firma llene su lugar en el encabezado — ver
/// storefront-logo-src en logo-src.ts. Solo sirve el logo guardado de la
/// marca (nunca una dirección que venga en el pedido) y queda en la caché
/// del CDN; si algo falla, manda al logo original.
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_WIDTH = 900;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await prisma.brandProfile.findUnique({ where: { storefrontSlug: slug }, select: { logoUrl: true } });
  const logoUrl = brand?.logoUrl;
  if (!logoUrl) return new NextResponse(null, { status: 404 });
  const original = logoUrl.startsWith("/") ? new URL(logoUrl, _req.url).href : logoUrl;
  try {
    const bytes = await readImageBytes(logoUrl, MAX_BYTES);
    const trimmed = await sharp(bytes, { failOn: "none" })
      .trim({ threshold: 12 })
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 92, alphaQuality: 100 })
      .toBuffer();
    return new NextResponse(new Uint8Array(trimmed), {
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("[logo]", slug, err instanceof Error ? err.message : err);
    return NextResponse.redirect(original, { status: 302, headers: { "cache-control": "public, max-age=300" } });
  }
}
