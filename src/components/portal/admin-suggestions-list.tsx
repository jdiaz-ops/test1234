"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeCo } from "@/lib/date-time-co";
import { formatAudioLength, SUGGESTION_KINDS, SUGGESTION_STATUS, type SuggestionStatusId } from "@/lib/suggestions";

export type AdminSuggestion = {
  id: string;
  portal: "BRAND" | "CREATOR";
  sender: string;
  email: string;
  kind: string | null;
  message: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
  pagePath: string | null;
  userAgent: string | null;
  sentByAdmin: boolean;
  status: SuggestionStatusId;
  createdAt: string;
};

/// Lo que se puede hacer con cada una: de nueva a leída, de leída a
/// resuelta, y volver atrás si se marcó por error.
const NEXT: Record<SuggestionStatusId, { status: SuggestionStatusId; label: string }[]> = {
  NEW: [
    { status: "READ", label: "Marcar leída" },
    { status: "DONE", label: "Resuelta" },
  ],
  READ: [
    { status: "DONE", label: "Resuelta" },
    { status: "NEW", label: "Volver a nueva" },
  ],
  DONE: [{ status: "READ", label: "Reabrir" }],
};

/// Admin → Sugerencias: lo que mandan las marcas y las creadoras desde el
/// buzón de su portal (ver suggestion-service.ts).
export function AdminSuggestionsList({ items }: { items: AdminSuggestion[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, status: SuggestionStatusId) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/sugerencias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!res?.ok) {
      setError("No se pudo cambiar el estado — intenta de nuevo.");
      setBusyId(null);
      return;
    }
    startTransition(() => {
      router.refresh();
      setBusyId(null);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-brand-ink-soft">No hay sugerencias aquí.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.map((s) => {
        const status = SUGGESTION_STATUS[s.status];
        const kind = SUGGESTION_KINDS.find((k) => k.value === s.kind);
        return (
          <article key={s.id} className="rounded-xl border border-brand-line bg-brand-surface p-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${status.chip}`}>{status.admin}</span>
              <span className="font-medium text-brand-ink">{s.sender}</span>
              <span className="rounded-full border border-brand-line px-2 py-0.5 text-brand-ink-soft">
                {s.portal === "BRAND" ? "Marca" : "Creadora"}
              </span>
              {kind && <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-brand-accent">{kind.admin}</span>}
              {s.sentByAdmin && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">Enviada por un admin con «Entrar como»</span>
              )}
              <span className="text-brand-ink-soft">{formatDateTimeCo(s.createdAt)}</span>
            </div>

            {s.message && <p className="mt-3 whitespace-pre-wrap text-sm text-brand-ink">{s.message}</p>}
            {s.audioUrl && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <audio controls preload="none" src={s.audioUrl} className="h-9 w-full max-w-md" />
                {s.audioSeconds != null && <span className="text-xs text-brand-ink-soft">{formatAudioLength(s.audioSeconds)}</span>}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-xs text-brand-ink-soft">
                <a href={`mailto:${s.email}`} className="hover:text-brand-accent hover:underline">
                  {s.email}
                </a>
                {s.pagePath && (
                  <>
                    {" · desde "}
                    <span className="font-mono">{s.pagePath}</span>
                  </>
                )}
                {s.userAgent && (
                  <span className="block truncate" title={s.userAgent}>
                    {s.userAgent}
                  </span>
                )}
              </p>
              <div className="flex shrink-0 gap-2">
                {NEXT[s.status].map((n) => (
                  <button
                    key={n.status}
                    type="button"
                    disabled={pending || busyId === s.id}
                    onClick={() => setStatus(s.id, n.status)}
                    className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-40 ${
                      n.status === "DONE" ? "bg-brand-accent text-white hover:opacity-90" : "border border-brand-line text-brand-ink hover:border-brand-ink"
                    }`}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
