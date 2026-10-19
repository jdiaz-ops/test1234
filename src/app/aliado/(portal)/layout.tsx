import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requireAllyProfile } from "@/lib/current-ally";

/// Portal de aliados comerciales (ver ally-service.ts): una sola pantalla,
/// sin menú. Entran con el link de su correo (ver /aliado/entrar).
export default async function AllyLayout({ children }: { children: React.ReactNode }) {
  const ally = await requireAllyProfile();
  if (!ally) redirect("/aliado/entrar");
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-brand-line bg-brand-surface">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
          <Link href="/aliado" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo estático en public/ */}
            <img src="/marcolini-icon.png" alt="Marcolini" className="h-7 w-auto" />
            <span className="font-mono text-xs tracking-widest text-brand-accent">ALIADOS</span>
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm text-brand-ink truncate">{ally.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/aliado/entrar" });
              }}
            >
              <button className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">{children}</main>
    </div>
  );
}
