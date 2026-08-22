import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BrandNav } from "@/components/portal/brand-nav";
import { ImpersonationBanner } from "@/components/portal/impersonation-banner";
import { countUnreadNotifications } from "@/server/services/notification-service";

export default async function MarcaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "BRAND") redirect("/login");

  const [profile, unreadNotifications] = await Promise.all([
    prisma.brandProfile.findUniqueOrThrow({ where: { userId: session.user.id } }),
    countUnreadNotifications(session.user.id),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      {session.user.impersonated && <ImpersonationBanner />}
      <div className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r border-brand-line bg-brand-surface p-5 flex flex-col">
          <Link href="/" className="font-mono text-sm font-medium text-brand-accent tracking-wide mb-8 block">
            MARCOLINI
          </Link>
          <BrandNav unreadNotifications={unreadNotifications} />
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
          {profile.status === "PENDING" && (
            <div className="bg-brand-accent-soft border-b border-brand-line px-8 py-3 text-sm text-brand-ink">
              Tu marca está <strong>pendiente de aprobación</strong>. Puedes configurar todo mientras
              tanto — en cuanto se apruebe, tu oferta queda visible en el marketplace.
            </div>
          )}
          {profile.status === "REJECTED" && (
            <div className="bg-red-50 border-b border-red-200 px-8 py-3 text-sm text-red-700">
              Tu marca no fue aprobada. Contáctanos si crees que fue un error.
            </div>
          )}
          <div className="max-w-4xl mx-auto px-8 py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
