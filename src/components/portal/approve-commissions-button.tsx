"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Botón manual para levantar la espera de 15 días en pruebas — cuando el
/// Motor de Pagos (tarea siguiente) esté listo, esto lo disparará un job
/// diario y este botón deja de ser necesario para operar, aunque puede
/// quedar como forzado manual de respaldo.
export function ApproveCommissionsButton({ eligibleNow }: { eligibleNow: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/comisiones", { method: "POST" });
    const body = await res.json();
    setLoading(false);
    if (!res.ok) {
      setResult(body.error ?? "No se pudo procesar.");
      return;
    }
    setResult(`${body.approvedCount} comisión(es) aprobada(s).`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading || eligibleNow === 0}
        className="bg-brand-accent text-white rounded-full px-5 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Procesando..." : `Aprobar comisiones vencidas (${eligibleNow})`}
      </button>
      {result && <p className="text-xs text-brand-ink-soft">{result}</p>}
    </div>
  );
}
