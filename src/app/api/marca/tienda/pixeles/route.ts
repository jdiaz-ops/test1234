import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { prisma } from "@/lib/prisma";
import { parseMetaPixelId, parseTiktokPixelId } from "@/lib/ad-pixels";

/// Guarda los Pixel ID de Meta y TikTok de la marca (Configuración →
/// Píxeles de anuncios). Vacío = quitar ese pixel.
export async function PUT(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const meta = parseMetaPixelId(String(body?.metaPixelId ?? ""));
  if (meta === null) {
    return NextResponse.json(
      { error: "El Pixel ID de Meta son solo números (ej. 1234567890123456)." },
      { status: 400 },
    );
  }
  const tiktok = parseTiktokPixelId(String(body?.tiktokPixelId ?? ""));
  if (tiktok === null) {
    return NextResponse.json(
      { error: "El Pixel ID de TikTok son letras y números (ej. CABC123DEF456GHI789J0)." },
      { status: 400 },
    );
  }

  const brand = await prisma.brandProfile.update({
    where: { id: profile.id },
    data: { metaPixelId: meta || null, tiktokPixelId: tiktok || null },
    select: { metaPixelId: true, tiktokPixelId: true },
  });
  return NextResponse.json({ ok: true, ...brand });
}
