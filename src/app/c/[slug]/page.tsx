import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getPalette, getFont } from "@/lib/creator-storefront-themes";
import { buildBrandStoreLink, buildProductLink } from "@/lib/brand-store-link";

/// El título/descripción de acá + la imagen de opengraph-image.tsx (mismo
/// folder, Next.js la detecta sola por convención) son lo que se ve cuando
/// un creador pega su link en WhatsApp/Instagram/etc.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await prisma.creatorProfile.findUnique({ where: { storefrontSlug: slug } });
  if (!profile) return {};

  const title = profile.storefrontHeadline
    ? `${profile.storefrontHeadline} — ${profile.displayName}`
    : `${profile.displayName} en Marcolini`;
  const description = profile.bio || `Descuentos y códigos de ${profile.displayName} en marcas de belleza — con Marcolini.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const profile = await prisma.creatorProfile.findUnique({
    where: { storefrontSlug: slug },
    include: {
      // Sin filtrar por storefrontVisible acá — hace falta el código de
      // TODAS las marcas activas para armar los links de las colecciones,
      // aunque esa marca esté oculta de la lista de "Marcas" de abajo.
      enrollments: {
        where: { status: "ACTIVE" },
        include: { offer: { include: { brand: true } } },
        orderBy: { storefrontOrder: "asc" },
      },
      collections: {
        where: { visible: true },
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { order: "asc" },
            include: { product: { include: { brand: true } } },
          },
        },
      },
    },
  });

  if (!profile) notFound();

  const palette = getPalette(profile.storefrontPalette);
  const font = getFont(profile.storefrontFont);

  // Nivel 3 (BrandChargeStatus.DEACTIVATED): la marca no debe seguir
  // beneficiándose de la promoción de un creador ni el comprador seguir
  // recibiendo el descuento mientras no pague — así que se oculta de la
  // vitrina pública igual que ya se oculta del marketplace (ver
  // listActiveOffers en marketplace-service.ts). El código real en la
  // tienda además queda apagado aparte (ver setBrandDiscountCodesActive
  // en payment-service.ts) — esto es lo que evita que el link siga
  // circulando de cara al comprador.
  const deactivatedBrandIds = new Set(
    (
      await prisma.brandCharge.findMany({
        where: { status: "DEACTIVATED", brandId: { in: profile.enrollments.map((e) => e.offer.brandId) } },
        select: { brandId: true },
      })
    ).map((c) => c.brandId)
  );

  const visibleEnrollments = profile.enrollments.filter(
    (e) => e.storefrontVisible && !deactivatedBrandIds.has(e.offer.brandId)
  );
  // Código del creador para cada marca — lo necesitan las tarjetas de
  // producto de las colecciones para armar su link (con o sin descuento
  // aplicado, según la plataforma — ver buildProductLink).
  const codeByBrandId = new Map(profile.enrollments.map((e) => [e.offer.brandId, e.discountCode]));

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

        <div className="space-y-4 mb-10">
          {visibleEnrollments.length === 0 ? (
            <p className="text-center text-sm" style={{ color: palette.inkSoft }}>
              Próximamente más marcas por aquí.
            </p>
          ) : (
            visibleEnrollments.map((e) => {
              const discountPercent = Number(e.discountPercentOverride ?? e.offer.defaultDiscountPercent);
              // Mismo link para el logo y el botón — con el código ya
              // aplicado si la tienda es Shopify (soporte nativo), o el
              // link normal de la tienda si no (ver buildBrandStoreLink).
              const storeLink = buildBrandStoreLink(e.offer.brand, e.discountCode);
              return (
                <div
                  key={e.id}
                  className="rounded-2xl p-5"
                  style={{ background: palette.surface, border: `1px solid ${palette.accentSoft}` }}
                >
                  <a
                    href={storeLink ?? "#"}
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
                    href={storeLink ?? "#"}
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

        {profile.collections.map((collection) => {
          // Mismo criterio que arriba — un producto de una marca en Nivel 3
          // no se muestra, aunque el creador ya lo haya agregado a esta
          // colección. Si eso deja la colección vacía, se salta entera en
          // vez de mostrar el título sin nada debajo.
          const visibleItems = collection.items.filter((item) => !deactivatedBrandIds.has(item.product.brandId));
          if (visibleItems.length === 0) return null;
          return (
          <div key={collection.id} className="mb-10">
            <h2 className="font-display text-base font-semibold mb-1" style={{ color: palette.ink }}>
              {collection.name}
            </h2>
            {collection.description && (
              <p className="text-xs mb-3" style={{ color: palette.inkSoft }}>
                {collection.description}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {visibleItems.map((item) => {
                const code = codeByBrandId.get(item.product.brandId);
                const productLink = code
                  ? buildProductLink(item.product.brand, item.product, code)
                  : item.product.url;
                const formatPrice = (amount: number) =>
                  new Intl.NumberFormat("es-CO", {
                    style: "currency",
                    currency: item.product.currency,
                    maximumFractionDigits: 0,
                  }).format(amount);
                return (
                  <a
                    key={item.product.id}
                    href={productLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl overflow-hidden block"
                    style={{ background: palette.surface, border: `1px solid ${palette.accentSoft}` }}
                  >
                    {item.product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- foto sincronizada desde la tienda de la marca
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square" style={{ background: palette.accentSoft }} />
                    )}
                    <div className="p-2.5">
                      <p className="text-[10px] mb-0.5" style={{ color: palette.inkSoft }}>
                        {item.product.brand.companyName}
                      </p>
                      <p className="text-xs font-medium leading-snug mb-1" style={{ color: palette.ink }}>
                        {item.product.name}
                      </p>
                      <div className="flex items-center gap-1.5 mb-2">
                        <p className="font-mono text-xs font-semibold" style={{ color: palette.accent }}>
                          {formatPrice(Number(item.product.price))}
                        </p>
                        {item.product.compareAtPrice && (
                          <p className="font-mono text-[10px] line-through" style={{ color: palette.inkSoft }}>
                            {formatPrice(Number(item.product.compareAtPrice))}
                          </p>
                        )}
                      </div>
                      <p
                        className="text-[10px] font-semibold text-center rounded-full py-1.5"
                        style={{ background: palette.accentSoft, color: palette.accent }}
                      >
                        Comprar →
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
          );
        })}

        <div className="text-center mt-14">
          <p className="font-mono text-xs mb-3" style={{ color: palette.inkSoft }}>
            Powered by Marcolini
          </p>
          <a
            href="/registro/creador"
            className="inline-block rounded-full px-5 py-2 text-xs font-medium border"
            style={{ borderColor: palette.accent, color: palette.accent }}
          >
            ¿Eres creador de contenido? Crea tu propia vitrina y empieza a generar ingresos con tu audiencia →
          </a>
        </div>
      </div>
    </div>
  );
}
