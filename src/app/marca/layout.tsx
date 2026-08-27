import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BrandNav } from "@/components/portal/brand-nav";
import { PortalShell } from "@/components/portal/portal-shell";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";
import { BillingLockScreen } from "@/components/portal/billing-lock-screen";
import { countUnreadNotifications } from "@/server/services/notification-service";
import { getBrandOnboardingStatus } from "@/server/services/onboarding-service";
import { isBrandPaymentLocked } from "@/server/services/payment-service";
import { getPlatformConfig } from "@/server/services/admin-config-service";

export default async function MarcaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "BRAND") redirect("/login");

  const [profile, unreadNotifications] = await Promise.all([
    prisma.brandProfile.findUniqueOrThrow({
      where: { userId: session.user.id },
    }),
    countUnreadNotifications(session.user.id),
  ]);

  // Bloqueo total del panel — mientras haya un corte OVERDUE o DEACTIVATED
  // (Nivel 2 o 3), no se ve nada del portal salvo este aviso (ver
  // payment-service.ts para el ciclo completo: corte, comprobante,
  // verificación). El marketplace y los códigos de los creadores NO pasan
  // por aquí — esos se rigen aparte por marketplace-service.ts y
  // attribution-service.ts, y solo se cortan en Nivel 3.
  const lockedCharge = await isBrandPaymentLocked(profile.id);
  if (lockedCharge) {
    const platformConfig = await getPlatformConfig();
    return (
      <div className="min-h-screen flex flex-col">
        {/* Aunque el panel esté bloqueado, si es el admin viendo "como" esta
            cuenta necesita poder volver sin cerrar sesión — si no, esta
            pantalla lo deja atrapado (ver exit-impersonation-button.tsx). */}
        {session.user.impersonated && <ImpersonationBanner />}
        <BillingLockScreen
          charge={{
            id: lockedCharge.id,
            totalAmount: Number(lockedCharge.totalAmount),
            dueAt: lockedCharge.dueAt.toISOString(),
            deactivationDueAt:
              lockedCharge.deactivationDueAt?.toISOString() ?? null,
            deactivatedAt: lockedCharge.deactivatedAt?.toISOString() ?? null,
            status: lockedCharge.status,
            pdfUrl: lockedCharge.pdfUrl,
            proofSubmittedAt:
              lockedCharge.proofSubmittedAt?.toISOString() ?? null,
            proofRejectedAt:
              lockedCharge.proofRejectedAt?.toISOString() ?? null,
            proofRejectedReason: lockedCharge.proofRejectedReason,
          }}
          paymentInstructions={platformConfig.paymentInstructions}
          paymentQrImageUrl={platformConfig.paymentQrImageUrl}
        />
      </div>
    );
  }

  const onboarding = await getBrandOnboardingStatus(profile);

  return (
    <div className="min-h-screen flex flex-col">
      {session.user.impersonated && <ImpersonationBanner />}
      <PortalShell
        logoHref="/marca"
        logoLabel="MARCOLINI"
        centerAction={
          onboarding.complete
            ? undefined
            : { label: "Terminar onboarding", href: "/marca/onboarding" }
        }
        nav={
          <BrandNav
            unreadNotifications={unreadNotifications}
            onboarding={onboarding.complete ? undefined : onboarding}
          />
        }
        footer={
          <>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline">
                Cerrar sesión
              </button>
            </form>
          </>
        }
      >
        {profile.status === "PENDING" && (
          <div className="bg-brand-accent-soft border-b border-brand-line px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-brand-ink">
              Completa el proceso de onboarding para que tu marca sea visible
              para los creadores de contenido.
            </p>
            <Link
              href="/marca/onboarding"
              className="shrink-0 bg-brand-accent text-white text-xs font-medium rounded-full px-4 py-1.5 hover:opacity-90 transition"
            >
              Terminar onboarding
            </Link>
          </div>
        )}
        {profile.status === "REJECTED" && (
          <div className="bg-red-50 border-b border-red-200 px-4 sm:px-8 py-3 text-sm text-red-700">
            Tu marca no fue aprobada. Contáctanos si crees que fue un error.
          </div>
        )}
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
          {children}
        </div>
      </PortalShell>
    </div>
  );
}
