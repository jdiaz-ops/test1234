import { auth, signOut } from "@/auth";
import { ChangePasswordForm } from "@/components/portal/change-password-form";

export default async function AdminCuentaPage() {
  const session = await auth();

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CUENTA</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Configuración de cuenta</h1>
      <p className="text-sm text-brand-ink-soft mb-8 font-mono">
        {session!.user.email} · {session!.user.adminRole}
      </p>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Cambiar contraseña</h2>
      <ChangePasswordForm />

      <div className="mt-10 pt-6 border-t border-brand-line">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button className="text-sm text-brand-ink-soft hover:text-red-600 hover:underline">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
