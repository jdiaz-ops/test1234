import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PortalNav } from "@/components/portal/portal-nav";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";
import { getCreatorOnboardingStatus } from "@/server/services/creator-onboarding-service";

export default async function CreadorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "CREATOR") redirect("/login");

  const profile = await prisma.creatorProfile.findUniqueOrThrow({ where: { userId: session.user.id } });
  const onboarding = await getCreatorOnboardingStatus(profile);

  return (
    <div className="min-h-screen flex flex-col">
      {session.user.impersonated && <ImpersonationBanner />}
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r border-brand-line bg-brand-surface p-5 flex flex-col">
          <Link href="/" className="font-mono text-sm font-medium text-brand-accent tracking-wide mb-8 block">
            MARCOLINI
          </Link>
          <PortalNav onboardingRemaining={onboarding.complete ? 0 : onboarding.total - onboarding.completedCount} />
          <div className="mt-auto pt-5 border-t border-brand-line">
            <p className="text-xs text-brand-ink-soft truncate mb-2">{session.user.email}</p>
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
          </div>
        </aside>
        <main className="flex-1 min-w-0 bg-brand-bg">
          <div className="max-w-4xl mx-auto px-8 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
