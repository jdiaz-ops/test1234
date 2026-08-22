"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinOfferButton({ offerId, joinMode }: { offerId: string; joinMode: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"joined" | "pending" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/creador/marketplace/unirse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId }),
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

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Uniendo..." : joinMode === "OPEN" ? "Unirme" : "Solicitar unirme"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
