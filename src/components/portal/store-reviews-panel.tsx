"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";

export type BrandReview = {
  id: string;
  productName: string;
  productImageUrl: string | null;
  authorName: string;
  authorEmail: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  createdAt: string;
};

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "PENDING", label: "Por revisar" },
  { key: "APPROVED", label: "Publicadas" },
  { key: "HIDDEN", label: "Ocultas" },
];

/// Moderación de reseñas: por revisar → publicar u ocultar; también se
/// puede borrar. Ver product-review-service.ts.
export function StoreReviewsPanel({ initialReviews }: { initialReviews: BrandReview[] }) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [tab, setTab] = useState<ReviewStatus>("PENDING");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "hide" | "delete") {
    if (action === "delete" && !window.confirm("¿Borrar esta reseña? No se puede deshacer.")) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/resenas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: id, action }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setReviews((prev) =>
        action === "delete"
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, status: action === "approve" ? "APPROVED" : "HIDDEN" } : r)),
      );
      router.refresh();
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setBusy(null);
    }
  }

  const shown = reviews.filter((r) => r.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = reviews.filter((r) => r.status === t.key).length;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium border ${
                tab === t.key
                  ? "bg-brand-ink text-brand-bg border-brand-ink"
                  : "border-brand-line text-brand-ink hover:bg-brand-accent-soft"
              }`}
            >
              {t.label} ({n})
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-brand-ink-soft">
          {tab === "PENDING" ? "No tienes reseñas por revisar." : "No hay reseñas en este grupo."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="rounded-2xl border border-brand-line bg-brand-surface p-4 flex gap-3">
              {r.productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto del producto
                <img src={r.productImageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-brand-line" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-brand-bg shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-brand-ink-soft">{r.productName}</p>
                <p className="text-sm text-brand-ink">
                  <span className="font-semibold">{r.authorName}</span>{" "}
                  <span className="text-brand-ink-soft">· {r.authorEmail}</span>
                </p>
                <p className="text-sm tracking-wider text-brand-ink" aria-label={`${r.rating} de 5 estrellas`}>
                  {"★".repeat(r.rating)}
                  <span className="text-brand-line">{"★".repeat(5 - r.rating)}</span>
                </p>
                <p className="text-sm text-brand-ink mt-1 whitespace-pre-line">{r.body}</p>
                <div className="flex items-center gap-4 mt-3">
                  {r.status !== "APPROVED" && (
                    <button
                      type="button"
                      onClick={() => act(r.id, "approve")}
                      disabled={busy === r.id}
                      className="rounded-full bg-brand-ink text-brand-bg px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      Publicar
                    </button>
                  )}
                  {r.status !== "HIDDEN" && (
                    <button
                      type="button"
                      onClick={() => act(r.id, "hide")}
                      disabled={busy === r.id}
                      className="text-xs text-brand-ink hover:underline disabled:opacity-50"
                    >
                      Ocultar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => act(r.id, "delete")}
                    disabled={busy === r.id}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Borrar
                  </button>
                  <span className="text-xs text-brand-ink-soft ml-auto">
                    {new Date(r.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
