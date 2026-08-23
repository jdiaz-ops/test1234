import { auth } from "@/auth";
import { getCreatorProfileByUserId } from "@/server/services/creator-profile-service";
import { getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { CreatorStorefrontStep } from "@/components/portal/creator-storefront-step";

export default async function StorefrontSettingsPage() {
  const session = await auth();
  const profile = await getCreatorProfileByUserId(session!.user.id);
  const enrollments = await getEnrollmentsForCreator(profile.id);

  const publicUrl = `marcolini.co/c/${profile.storefrontSlug}`;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">MI VITRINA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Tu vitrina pública</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-xl">
        Este es el único link que necesitas compartir — reúne todas tus marcas activas en una sola
        página, con la paleta y fuente que elijas. Ponlo en tu bio de Instagram o TikTok.
      </p>

      <CreatorStorefrontStep
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
          }))}
        publicUrl={publicUrl}
      />
    </div>
  );
}
