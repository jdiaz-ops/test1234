"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeaveOfferButton({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmLeave() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/creador/marketplace/retirarme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentId }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo retirar.");
      return;
    }

    router.refresh();
  }

  if (confirming) {
    return (
      <div className="text-center">
        <p className="text-xs text-brand-ink-soft mb-2">¿Seguro que te quieres retirar de este programa?</p>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={confirmLeave}
            disabled={loading}
            className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
          >
            {loading ? "Retirando..." : "Sí, retirarme"}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-brand-ink-soft hover:underline">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline">
      Retirarme de este programa
    </button>
  );
}
