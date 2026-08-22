import { signOut } from "@/auth";

/// Franja fija arriba del portal cuando el admin Propietario entró "como"
/// esta cuenta — para que nunca sea ambiguo de quién es la sesión que se
/// está viendo. Salir cierra la sesión (no hay vuelta directa a la sesión
/// admin real, hay que iniciar sesión de nuevo con esa cuenta).
export function ImpersonationBanner() {
  return (
    <div className="bg-amber-100 border-b border-amber-300 px-6 py-2 text-xs text-amber-800 flex items-center justify-between">
      <span>👀 Estás viendo este portal como esta cuenta — modo administrador.</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="font-medium hover:underline">Salir</button>
      </form>
    </div>
  );
}
