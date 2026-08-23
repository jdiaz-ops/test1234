import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/components/portal/admin-nav";
import { countPendingBillingVerifications } from "@/server/services/payment-service";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const pendingCobros = await countPendingBillingVerifications();

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 border-r border-brand-line bg-brand-surface p-5 flex flex-col">
        <Link href="/" className="font-mono text-sm font-medium text-brand-accent tracking-wide mb-8 block">
          MARCOLINI ADMIN
        </Link>
        <AdminNav pendingCobros={pendingCobros} />
        <div className="mt-auto pt-5 border-t border-brand-line">
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
        </div>
      </aside>
      <main className="flex-1 min-w-0 bg-brand-bg">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
