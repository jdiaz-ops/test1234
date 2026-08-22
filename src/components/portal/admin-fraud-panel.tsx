"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Flag = {
  id: string;
  transactionId: string;
  reason: string;
  status: "PENDING_REVIEW" | "CLEARED" | "CONFIRMED_FRAUD";
  createdAt: string;
};

export function AdminFraudPanel({ flags }: { flags: Flag[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function review(flagId: string, status: "CLEARED" | "CONFIRMED_FRAUD") {
    setLoadingId(flagId);
    await fetch("/api/admin/fraude", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagId, status }),
    });
    setLoadingId(null);
    router.refresh();
  }

  const pending = flags.filter((f) => f.status === "PENDING_REVIEW");
  const resolved = flags.filter((f) => f.status !== "PENDING_REVIEW");

  if (flags.length === 0) {
    return (
      <p className="text-sm text-brand-ink-soft">
        No hay transacciones marcadas como sospechosas por ahora.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-brand-ink mb-3">
            Por revisar ({pending.length})
          </h2>
          <ul className="space-y-2">
            {pending.map((f) => (
              <li key={f.id} className="rounded-xl border border-brand-line bg-brand-surface p-4 text-sm">
                <p className="text-brand-ink mb-2">{f.reason}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => review(f.id, "CLEARED")}
                    disabled={loadingId === f.id}
                    className="text-xs text-brand-accent font-medium hover:underline"
                  >
                    Descartar (no es fraude)
                  </button>
                  <button
                    onClick={() => review(f.id, "CONFIRMED_FRAUD")}
                    disabled={loadingId === f.id}
                    className="text-xs text-red-600 font-medium hover:underline"
                  >
                    Confirmar fraude
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-brand-ink mb-3">Resueltas</h2>
          <ul className="space-y-2">
            {resolved.map((f) => (
              <li key={f.id} className="rounded-xl border border-brand-line bg-brand-surface p-4 text-sm text-brand-ink-soft">
                {f.reason} —{" "}
                <span className={f.status === "CONFIRMED_FRAUD" ? "text-red-600" : "text-brand-accent"}>
                  {f.status === "CONFIRMED_FRAUD" ? "Fraude confirmado" : "Descartada"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
