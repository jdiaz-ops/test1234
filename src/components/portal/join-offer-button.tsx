"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinOfferButton({
  offerId,
  joinMode,
  suggestedCode,
  fullWidth,
}: {
  offerId: string;
  joinMode: string;
  suggestedCode: string;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(suggestedCode);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"joined" | "pending" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmJoin() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/creador/marketplace/unirse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, discountCode: code }),
    });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo unir.");
      return;
    }

    const body = await res.json();
    setResult(body.status === "ACTIVE" ? "joined" : "pending");
    router.refresh();
  }

  if (result === "joined") {
    return <span className="text-sm text-brand-accent font-medium">Ya estás unido ✓</span>;
  }
  if (result === "pending") {
    return <span className="text-sm text-brand-ink-soft font-medium">Esperando aprobación</span>;
  }

  if (editing) {
    return (
      <div className="space-y-2">
        <label className="block text-xs text-brand-ink-soft">Tu código para esta marca</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="input uppercase font-mono py-1 text-sm"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={confirmJoin}
            disabled={loading}
            className={`bg-brand-accent text-white rounded-full px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 ${
              fullWidth ? "flex-1" : ""
            }`}
          >
            {loading ? "Uniendo..." : joinMode === "OPEN" ? "Confirmar" : "Solicitar unirme"}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-brand-ink-soft hover:underline shrink-0">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`bg-brand-accent text-white rounded-full px-4 py-2 text-sm font-medium hover:opacity-90 ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {joinMode === "OPEN" ? "Unirme a este programa" : "Solicitar unirme a este programa"}
    </button>
  );
}
