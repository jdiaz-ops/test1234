import { ExitImpersonationButton } from "@/components/portal/exit-impersonation-button";

/// Franja fija arriba del portal cuando el admin Propietario entró "como"
/// esta cuenta — para que nunca sea ambiguo de quién es la sesión que se
/// está viendo. "Volver al panel admin" restaura la sesión admin original
/// sin pasar por Login (ver exit-impersonation-button.tsx).
export function ImpersonationBanner() {
  return (
    <div className="bg-amber-100 border-b border-amber-300 px-6 py-2 text-xs text-amber-800 flex items-center justify-between">
      <span>👀 Estás viendo este portal como esta cuenta — modo administrador.</span>
      <ExitImpersonationButton />
    </div>
  );
}
