import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getPalette } from "@/lib/creator-storefront-themes";

/// Tarjeta que se ve cuando alguien pega marcolini.co/c/[slug] en WhatsApp,
/// Instagram, Twitter/X, etc. — Next.js la detecta solo por el nombre del
/// archivo (convención "opengraph-image"), no hace falta wiring manual en
/// generateMetadata de page.tsx. Reusa la misma paleta que ya eligió el
/// creador para su vitrina, así la tarjeta combina con la página real.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await prisma.creatorProfile.findUnique({
    where: { storefrontSlug: slug },
  });

  const palette = getPalette(profile?.storefrontPalette ?? "rosa-marcolini");
  const displayName = profile?.displayName ?? "Marcolini";
  const headline = profile?.storefrontHeadline ?? "Mis descuentos y códigos";
  const initial = displayName[0]?.toUpperCase() ?? "M";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: palette.bg,
      }}
    >
      {/* Se usa siempre la inicial, nunca la foto real del creador — traer
            una imagen externa acá significa esperar (o fallar en silencio,
            sin fallback visible) a que ese host responda mientras se genera
            la tarjeta. La inicial es 100% confiable. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 130,
          height: 130,
          borderRadius: 65,
          background: palette.accentSoft,
          color: palette.accent,
          fontSize: 56,
          fontWeight: 700,
          marginBottom: 36,
        }}
      >
        {initial}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 30,
          color: palette.accent,
          marginBottom: 10,
        }}
      >
        {displayName}
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 52,
          fontWeight: 700,
          color: palette.ink,
          textAlign: "center",
          maxWidth: 940,
          padding: "0 60px",
          justifyContent: "center",
          lineHeight: 1.2,
        }}
      >
        {headline}
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 44,
          fontSize: 24,
          color: palette.inkSoft,
        }}
      >
        Creado por Marcolini
      </div>
    </div>,
    { ...size },
  );
}
