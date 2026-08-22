import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getBrandOnboardingStatus } from "@/server/services/onboarding-service";
import { getWebhookUrl } from "@/server/services/brand-profile-service";
import { getBrandDashboardSummary } from "@/server/services/brand-finance-service";
import { OnboardingWizard } from "@/components/portal/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const [{ steps, complete, completedCount, total }, summary] = await Promise.all([
    getBrandOnboardingStatus(profile),
    getBrandDashboardSummary(profile.id),
  ]);

  // Ya no hay nada pendiente — esta página no tiene sentido, de vuelta al Dashboard.
  if (complete) redirect("/marca");

  const webhookUrl =
    profile.webhookSecret && (profile.storeType === "SHOPIFY" || profile.storeType === "WOOCOMMERCE")
      ? getWebhookUrl(profile.id, profile.storeType)
      : null;

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">EMPIEZA AQUÍ</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Prepara tu marca para el marketplace
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6">
        Tu marca solo se hace visible para los creadores cuando completes estos {total} pasos.
      </p>

      <div className="flex items-center gap-3 mb-8 max-w-lg">
        <div className="flex-1 h-2 rounded-full bg-brand-line overflow-hidden">
          <div
            className="h-full bg-brand-accent transition-all"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>
        <p className="text-xs font-mono text-brand-ink-soft shrink-0">
          {completedCount}/{total}
        </p>
      </div>

      <div className="max-w-3xl">
        <OnboardingWizard
          steps={steps}
          profile={{
            initial: {
              companyName: profile.companyName,
              legalName: profile.legalName ?? "",
              taxId: profile.taxId ?? "",
              description: profile.description ?? "",
              city: profile.city ?? "",
              websiteUrl: profile.websiteUrl ?? "",
              phone: profile.phone ?? "",
              fiscalAddress: profile.fiscalAddress ?? "",
              instagramHandle: profile.instagramHandle ?? "",
              tiktokHandle: profile.tiktokHandle ?? "",
            },
            files: {
              logoUrl: profile.logoUrl,
              rutDocumentUrl: profile.rutDocumentUrl,
              camaraComercioUrl: profile.camaraComercioUrl,
            },
          }}
          store={{
            initial: {
              storeType: profile.storeType,
              storeUrl: profile.storeUrl ?? "",
              shopifyAccessToken: profile.shopifyAccessToken ?? "",
              wooConsumerKey: profile.wooConsumerKey ?? "",
              wooConsumerSecret: profile.wooConsumerSecret ?? "",
            },
            initialWebhookUrl: webhookUrl,
            initialWebhookSecret: profile.webhookSecret ?? null,
          }}
          hasCard={!!profile.cardTokenRef}
          cardHolder={{
            name: profile.legalName || profile.companyName,
            email: session!.user.email ?? "",
          }}
          platformFeePercent={summary.platformFeePercent}
          vatPercent={summary.vatPercent}
        />
      </div>
    </div>
  );
}
