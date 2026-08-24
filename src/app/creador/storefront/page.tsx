import { auth } from "@/auth";
import { getCreatorProfileByUserId } from "@/server/services/creator-profile-service";
import { getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { listCollectionsForCreator } from "@/server/services/collection-service";
import { CreatorStorefrontStep } from "@/components/portal/creator-storefront-step";
import { CollectionsManager } from "@/components/portal/collections-manager";

export default async function StorefrontSettingsPage() {
  const session = await auth();
  const profile = await getCreatorProfileByUserId(session!.user.id);
  const [enrollments, collections] = await Promise.all([
    getEnrollmentsForCreator(profile.id),
    listCollectionsForCreator(profile.id),
  ]);

  // Domino real del entorno actual (variable APP_URL — misma fuente única de
  // verdad que usan los correos y los webhooks, ver docs/cambiar-dominio.md).
  // Antes decía "marcolini.co" fijo en el texto, que hoy no lleva a ningún
  // lado porque ese dominio aún no existe — con esto se actualiza solo el
  // día que se conecte un dominio propio, sin tocar código.
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const publicUrl = `${appUrl.replace(/^https?:\/\//, "")}/c/${profile.storefrontSlug}`;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MI VITRINA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Tu vitrina pública</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-xl">
        Este es el único link que necesitas compartir — reúne todas tus marcas activas en una sola
        página, con la paleta y fuente que elijas. Ponlo en tu bio de Instagram o TikTok.
      </p>

      <CollectionsManager
        collections={collections.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          visible: c.visible,
          items: c.items.map((it) => ({
            product: {
              id: it.product.id,
              name: it.product.name,
              imageUrl: it.product.imageUrl,
              price: Number(it.product.price),
              currency: it.product.currency,
              brand: { companyName: it.product.brand.companyName },
            },
          })),
        }))}
      />

      <CreatorStorefrontStep
        displayName={profile.displayName}
        photoUrl={profile.photoUrl}
        initial={{
          storefrontPalette: profile.storefrontPalette,
          storefrontFont: profile.storefrontFont,
          storefrontHeadline: profile.storefrontHeadline ?? "",
          bio: profile.bio ?? "",
        }}
        enrollments={[...enrollments]
          .filter((e) => e.status === "ACTIVE")
          .sort((a, b) => a.storefrontOrder - b.storefrontOrder)
          .map((e) => ({
            id: e.id,
            brandName: e.offer.brand.companyName,
            logoUrl: e.offer.brand.logoUrl,
            visible: e.storefrontVisible,
            discountPercent: Number(e.discountPercentOverride ?? e.offer.defaultDiscountPercent),
            discountCode: e.discountCode,
          }))}
        publicUrl={publicUrl}
      />
    </div>
  );
}
