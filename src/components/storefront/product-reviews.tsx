"use client";

import { useState } from "react";

export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
};

/// Estrellas en SVG (no emoji) — `value` admite medias para el promedio.
export function Stars({ value, className = "w-4 h-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-ink" aria-label={`${value.toFixed(1)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <svg key={n} viewBox="0 0 20 20" className={className} aria-hidden="true">
            <defs>
              <linearGradient id={`star-${n}-${Math.round(fill * 100)}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="currentColor" stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#star-${n}-${Math.round(fill * 100)})`}
              d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
            />
          </svg>
        );
      })}
    </span>
  );
}

/// Una estrella llena o vacía — para el selector del formulario.
function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        fillOpacity={filled ? 1 : 0.18}
        d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z"
      />
    </svg>
  );
}

/// Opiniones en la ficha del producto: promedio, reseñas aprobadas por la
/// marca y el formulario para dejar una (solo compradores — el servidor
/// verifica el correo contra sus pedidos pagados). Ver
/// product-review-service.ts y conversación del 2026-09-30.
export function ProductReviews({
  brandSlug,
  productId,
  reviews,
  average,
  count,
}: {
  brandSlug: string;
  productId: string;
  reviews: PublicReview[];
  average: number;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Elige de 1 a 5 estrellas.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/tienda/${brandSlug}/resenas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, name, email, rating, body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "No se pudo enviar tu reseña.");
        return;
      }
      setSent(true);
    } catch {
      setError("No se pudo enviar — revisa tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="opiniones" className="max-w-[1600px] mx-auto px-4 sm:px-8 pb-14 scroll-mt-24">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-brand-ink text-center mb-4">
          Opiniones
        </h2>
        <div className="flex flex-col items-center gap-1 mb-6">
          {count > 0 ? (
            <>
              <Stars value={average} className="w-5 h-5" />
              <p className="text-sm text-brand-ink-soft">
                {average.toFixed(1)} de 5 · {count} {count === 1 ? "opinión" : "opiniones"}
              </p>
            </>
          ) : (
            <p className="text-sm text-brand-ink-soft">Todavía no hay opiniones de este producto.</p>
          )}
          {!open && !sent && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-3 border border-brand-ink px-5 py-2 text-xs font-bold uppercase tracking-wide text-brand-ink hover:bg-brand-ink hover:text-brand-bg"
            >
              Escribir una opinión
            </button>
          )}
        </div>

        {sent && (
          <p className="text-sm text-center text-brand-ink mb-6">
            ¡Gracias! Tu opinión se publica cuando la tienda la revise.
          </p>
        )}

        {open && !sent && (
          <form onSubmit={handleSubmit} className="border border-brand-line p-5 mb-8 space-y-3">
            <p className="text-xs text-brand-ink-soft">
              Solo pueden opinar quienes compraron este producto: usa el mismo correo de tu pedido.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                maxLength={60}
                required
                className="input text-sm"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo con el que compraste"
                required
                className="input text-sm"
              />
            </div>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                  onClick={() => setRating(n)}
                  className="p-0.5 text-brand-ink"
                >
                  <StarIcon filled={n <= rating} className="w-7 h-7" />
                </button>
              ))}
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="¿Qué te pareció?"
              rows={4}
              maxLength={1000}
              required
              className="input text-sm"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={sending}
                className="bg-brand-button text-brand-button-text px-5 py-2.5 text-xs font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
              >
                {sending ? "Enviando..." : "Enviar opinión"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-xs text-brand-ink-soft hover:underline">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {reviews.length > 0 && (
          <ul className="divide-y divide-brand-line border-t border-brand-line">
            {reviews.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <p className="text-sm font-semibold text-brand-ink">{r.authorName}</p>
                  <p className="text-xs text-brand-ink-soft">
                    {new Date(r.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <Stars value={r.rating} />
                <p className="text-sm text-brand-ink mt-2 whitespace-pre-line">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
