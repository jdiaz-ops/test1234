import { auth } from "@/auth";
import { getCreatorProfileByUserId } from "@/server/services/creator-profile-service";
import { getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { listCollectionsForCreator } from "@/server/services/collection-service";
import { CreatorStorefrontStep } from "@/components/portal/creator-storefront-step";
import { creatorVitrinaUrl } from "@/lib/creator-identity";

export default async function StorefrontSettingsPage() {
  const session = await auth();
  const profile = await getCreatorProfileByUserId(session!.user.id);
  const [enrollments, collections] = await Promise.all([
    getEnrollmentsForCreator(profile.id),
    listCollectionsForCreator(profile.id),
  ]);

  // {slug}.marcolini.lat — ver creatorVitrinaUrl.
  const publicUrl = (await creatorVitrinaUrl(profile.storefrontSlug)).replace(/^https?:\/\//, "");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        MI VITRINA
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-6">
        Tu vitrina pública
      </h1>

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
            discountPercent: Number(
              e.discountPercentOverride ?? e.offer.defaultDiscountPercent,
            ),
            discountCode: e.discountCode,
          }))}
        // Forma completa (para CollectionsManager, que vive adentro de este
        // componente ahora) — la vista previa en vivo se queda con el
        // subconjunto liviano que ya necesitaba (ver LivePreviewCollection).
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
        publicUrl={publicUrl}
        alreadyConfigured={Boolean(profile.storefrontHeadline)}
      />
    </div>
  );
}
