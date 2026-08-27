import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/portal/admin-nav";
import { PortalShell } from "@/components/portal/portal-shell";
import { countPendingBillingVerifications, countPendingPayouts } from "@/server/services/payment-service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [pendingCobros, pendingPagos] = await Promise.all([
    countPendingBillingVerifications(),
    countPendingPayouts(),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <PortalShell
        logoLabel="MARCOLINI ADMIN"
        nav={<AdminNav pendingCobros={pendingCobros} pendingPagos={pendingPagos} />}
        footer={
          <>
            <p className="text-xs text-brand-ink-soft truncate mb-1">{session.user.email}</p>
            <p className="text-xs font-mono text-brand-accent mb-2">{session.user.adminRole}</p>
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
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">{children}</div>
      </PortalShell>
    </div>
  );
}
