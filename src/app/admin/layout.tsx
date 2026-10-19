import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/portal/admin-nav";
import { PortalShell } from "@/components/portal/portal-shell";
import {
  countPendingBillingVerifications,
  countPendingPayouts,
} from "@/server/services/payment-service";
import { countNewSuggestions } from "@/server/services/suggestion-service";
import { SUGGESTIONS_ENABLED } from "@/lib/features";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [pendingCobros, pendingPagos, newSuggestions] = await Promise.all([
    countPendingBillingVerifications(),
    countPendingPayouts(),
    SUGGESTIONS_ENABLED ? countNewSuggestions() : 0,
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <PortalShell
        logoHref="/admin"
        logoLabel="MARCOLINI ADMIN"
        nav={
          <AdminNav pendingCobros={pendingCobros} pendingPagos={pendingPagos} newSuggestions={newSuggestions} />
        }
        footer={
          <>
            <p className="text-xs text-brand-ink-soft truncate mb-1">
              {session.user.email}
            </p>
            <p className="text-xs font-mono text-brand-accent mb-2">
              {session.user.adminRole}
            </p>
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
        {/* w-full: dentro del <main> (flex-col), con mx-auto solo se
            encogía al ancho de lo más ancho que trajera la página (una
            tabla, una fila que no se parte) y en el celular los textos
            quedaban cortados a la derecha (Muestras, 2026-10-19). */}
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
          {children}
        </div>
      </PortalShell>
    </div>
  );
}
