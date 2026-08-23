import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorOnboardingStatus } from "@/server/services/creator-onboarding-service";
import { getCreatorProfileByUserId } from "@/server/services/creator-profile-service";
import { listActiveOffers, getEnrollmentsForCreator } from "@/server/services/marketplace-service";
import { CreatorOnboardingWizard } from "@/components/portal/creator-onboarding-wizard";

export default async function CreatorOnboardingPage() {
  const session = await auth();
  const profile = await getCreatorProfileByUserId(session!.user.id);

  const interestVerticalIds = profile.interests.map((i) => i.verticalId);

  const [{ steps, completedCount, total }, verticals, offers, enrollments] = await Promise.all([
    getCreatorOnboardingStatus(profile),
    prisma.vertical.findMany({ orderBy: { name: "asc" } }),
    listActiveOffers({ verticalIds: interestVerticalIds }),
    getEnrollmentsForCreator(profile.id),
  ]);

  const enrollmentByOffer = new Map(enrollments.map((e) => [e.offerId, e]));
  const publicUrl = `marcolini.co/c/${profile.storefrontSlug}`;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">EMPIEZA AQUÍ</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Completa tu perfil de creador</h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Nada de esto es obligatorio — ya puedes usar toda la plataforma. Pero completar estos pasos te
        ayuda a que las marcas confíen más rápido y a que te paguemos sin contratiempos.
      </p>

      <div className="flex items-center gap-3 mb-8 max-w-lg">
        <div className="flex-1 h-2 rounded-full bg-brand-line overflow-hidden">
          <div className="h-full bg-brand-accent transition-all" style={{ width: `${(completedCount / total) * 100}%` }} />
        </div>
        <p className="text-xs font-mono text-brand-ink-soft shrink-0">
          {completedCount}/{total}
        </p>
      </div>

      <div className="max-w-3xl">
        <CreatorOnboardingWizard
          steps={steps}
          profileStepProps={{
            initial: {
              displayName: profile.displayName,
              legalName: profile.legalName ?? "",
              city: profile.city ?? "",
              phone: profile.phone ?? "",
              socialLinks: profile.socialLinks.map((s) => ({ platform: s.platform, handle: s.handle })),
            },
            photoUrl: profile.photoUrl,
            verticals: verticals.map((v) => ({ id: v.id, name: v.name })),
            initialInterestIds: interestVerticalIds,
          }}
          paymentStepProps={{
            initial: {
              documentId: profile.documentId ?? "",
              payoutMethod: profile.payoutMethod ?? "BANK",
              breBKey: profile.breBKey ?? "",
              bankName: profile.bankName ?? "",
              bankAccountType: profile.bankAccountType ?? "",
              bankAccountNumber: profile.bankAccountNumber ?? "",
              paymentHolderName: profile.paymentHolderName ?? "",
            },
          }}
          joinStepProps={{
            offers: offers.map((offer) => ({
              id: offer.id,
              name: offer.name,
              joinMode: offer.joinMode,
              defaultCommissionPercent: Number(offer.defaultCommissionPercent),
              defaultDiscountPercent: Number(offer.defaultDiscountPercent),
              suggestedCode: profile.baseCode,
              enrollmentStatus: enrollmentByOffer.get(offer.id)?.status === "ACTIVE" ? "ACTIVE" : enrollmentByOffer.has(offer.id) ? "PENDING_APPROVAL" : null,
              brand: {
                companyName: offer.brand.companyName,
                logoUrl: offer.brand.logoUrl,
                description: offer.brand.description,
                websiteUrl: offer.brand.websiteUrl,
              },
            })),
            filteredByInterests: interestVerticalIds.length > 0,
          }}
          storefrontStepProps={{
            initial: {
              storefrontPalette: profile.storefrontPalette,
              storefrontFont: profile.storefrontFont,
              storefrontHeadline: profile.storefrontHeadline ?? "",
              bio: profile.bio ?? "",
            },
            enrollments: [...enrollments]
              .sort((a, b) => a.storefrontOrder - b.storefrontOrder)
              .map((e) => ({
                id: e.id,
                brandName: e.offer.brand.companyName,
                logoUrl: e.offer.brand.logoUrl,
                visible: e.storefrontVisible,
              })),
            publicUrl,
          }}
        />
      </div>
    </div>
  );
}
