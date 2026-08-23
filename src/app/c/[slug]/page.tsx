import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getPalette, getFont } from "@/lib/creator-storefront-themes";

export default async function PublicStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const profile = await prisma.creatorProfile.findUnique({
    where: { storefrontSlug: slug },
    include: {
      enrollments: {
        where: { status: "ACTIVE", storefrontVisible: true },
        include: { offer: { include: { brand: true } } },
        orderBy: { storefrontOrder: "asc" },
      },
    },
  });

  if (!profile) notFound();

  const palette = getPalette(profile.storefrontPalette);
  const font = getFont(profile.storefrontFont);

  return (
    <div
      className="min-h-screen"
      style={{ background: palette.bg, fontFamily: font.stack, color: palette.ink }}
    >
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-center mb-10">
          {profile.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto subida por el creador
            <img
              src={profile.photoUrl}
              alt={profile.displayName}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-4"
              style={{ border: `2px solid ${palette.surface}` }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center font-display font-semibold text-xl"
              style={{ background: palette.accentSoft, color: palette.accent }}
            >
              {profile.displayName[0]?.toUpperCase()}
            </div>
          )}
          <p className="font-mono text-sm" style={{ color: palette.accent }}>
            {profile.displayName}
          </p>
          {profile.storefrontHeadline && (
            <h1 className="font-display text-xl font-semibold mt-1" style={{ color: palette.ink }}>
              {profile.storefrontHeadline}
            </h1>
          )}
          {profile.bio && (
            <p className="text-sm mt-2" style={{ color: palette.inkSoft }}>
              {profile.bio}
            </p>
          )}
        </div>

        <div className="space-y-4">
          {profile.enrollments.length === 0 ? (
            <p className="text-center text-sm" style={{ color: palette.inkSoft }}>
              Próximamente más marcas por aquí.
            </p>
          ) : (
            profile.enrollments.map((e) => {
              const discountPercent = Number(e.discountPercentOverride ?? e.offer.defaultDiscountPercent);
              const storeUrl = e.offer.brand.storeUrl;
              return (
                <div
                  key={e.id}
                  className="rounded-2xl p-5"
                  style={{ background: palette.surface, border: `1px solid ${palette.accentSoft}` }}
                >
                  <a
                    href={storeUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 mb-3"
                  >
                    {e.offer.brand.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- logo subido por la marca
                      <img src={e.offer.brand.logoUrl} alt={e.offer.brand.companyName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-display font-semibold text-sm"
                        style={{ background: palette.accentSoft, color: palette.accent }}
                      >
                        {e.offer.brand.companyName[0]?.toUpperCase()}
                      </div>
                    )}
                    <p className="font-display font-semibold" style={{ color: palette.ink }}>
                      {e.offer.brand.companyName}
                    </p>
                  </a>
                  <p className="text-sm mb-4" style={{ color: palette.inkSoft }}>
                    Obtén {discountPercent}% de descuento con esta marca usando mi código{" "}
                    <span className="font-mono font-medium" style={{ color: palette.accent }}>
                      {e.discountCode}
                    </span>
                  </p>
                  <a
                    href={storeUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                    style={{ background: palette.accent }}
                  >
                    Ir a la tienda →
                  </a>
                </div>
              );
            })
          )}
        </div>

        <div className="text-center mt-14">
          <p className="font-mono text-xs mb-3" style={{ color: palette.inkSoft }}>
            Powered by Marcolini
          </p>
          <a
            href="/registro/creador"
            className="inline-block rounded-full px-5 py-2 text-xs font-medium border"
            style={{ borderColor: palette.accent, color: palette.accent }}
          >
            ¿Eres creador de contenido? Crea tu propia vitrina →
          </a>
        </div>
      </div>
    </div>
  );
}
