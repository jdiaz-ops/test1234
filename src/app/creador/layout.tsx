import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import { PortalShell } from "@/components/portal/portal-shell";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";
import { getCreatorOnboardingStatus } from "@/server/services/creator-onboarding-service";

export default async function CreadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CREATOR") redirect("/login");

  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session.user.id },
  });
  const onboarding = await getCreatorOnboardingStatus(profile);

  return (
    <div className="min-h-screen flex flex-col">
      {session.user.impersonated && <ImpersonationBanner />}
      <PortalShell
        logoHref="/creador"
        logoLabel="MARCOLINI"
        centerAction={
          onboarding.complete
            ? undefined
            : { label: "Terminar onboarding", href: "/creador/onboarding" }
        }
        nav={
          <PortalNav
            onboardingRemaining={
              onboarding.complete
                ? 0
                : onboarding.total - onboarding.completedCount
            }
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
        <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
          {children}
        </div>
      </PortalShell>
    </div>
  );
}
