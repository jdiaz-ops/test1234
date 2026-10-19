"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OfferForm } from "@/components/portal/offer-form";
import type { GoLiveChecklist, GoLiveItem, GoLiveKey } from "@/server/services/go-live-service";

/// "Lo que falta para ser visible en el marketplace" en el Dashboard de la
/// marca (ver go-live-service.ts) — su onboarding: arriba el avance, después
/// los pasos en orden unidos por una línea (el que sigue, abierto con su
/// botón) y al final la meta, salir a la venta. El programa de creadores se
/// configura ahí mismo. Pedidos del 2026-10-19: "hazme esto más bonito y
/// que se sienta los pasos, el progreso y el resultado".

/// El botón del paso que sigue.
const ACTION_LABEL: Partial<Record<GoLiveKey, string>> = {
  legal: "Completar datos",
  envios: "Configurar envíos",
  pagos: "Conectar pagos",
  inventario: "Revisar inventario",
  programa: "Configurar aquí",
};

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function FlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

/// El avance en círculo, con el porcentaje en el medio.
function ProgressRing({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${value}% listo`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-white" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="stroke-brand-accent motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold text-brand-ink tabular-nums">{value}%</span>
    </div>
  );
}

function StepLink({ item, className, children }: { item: GoLiveItem; className: string; children: React.ReactNode }) {
  return item.href.startsWith("http") ? (
    <a href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={item.href} className={className}>
      {children}
    </Link>
  );
}

export function GoLiveCard({
  checklist,
  approved,
  platformFeePercent,
  vatPercent,
}: {
  checklist: GoLiveChecklist;
  /// La aprobación de Marcolini: también hace falta para salir.
  approved: boolean;
  /// Para la calculadora del programa de creadores (ver OfferForm).
  platformFeePercent: number;
  vatPercent: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState(checklist.items);
  const [busy, setBusy] = useState<GoLiveKey | null>(null);
  const [programOpen, setProgramOpen] = useState(false);
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const complete = done === total;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const currentIndex = items.findIndex((i) => !i.done);
  const live = complete && approved;

  async function toggle(key: GoLiveKey, next: boolean) {
    setBusy(key);
    try {
      const res = await fetch("/api/marca/tienda/salida", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, done: next }),
      });
      if (res.ok) {
        setItems((list) => list.map((i) => (i.key === key ? { ...i, done: next } : i)));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  const programDone = () => {
    setProgramOpen(false);
    setItems((list) => list.map((i) => (i.key === "programa" ? { ...i, done: true, detail: "Tu programa está activo: las creadoras pueden unirse y vender con su código." } : i)));
  };

  // A la venta: queda solo la confirmación (si algo se desarma, como los
  // pagos, la lista vuelve sola).
  if (live) {
    return (
      <section className="mb-6 flex items-center gap-3 rounded-2xl bg-brand-ink px-5 py-4 text-white">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
          <FlagIcon />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">¡Estás a la venta en el marketplace!</p>
          <p className="text-xs text-white/80">Las creadoras pueden encontrar tu marca, unirse a tu programa y vender con su código.</p>
        </div>
      </section>
    );
  }

  const remaining = total - done;
  const summary = live
    ? "Tu marca está a la venta en el marketplace."
    : complete
      ? "Listo de tu lado: estamos revisando tu marca para que salga en el marketplace."
      : `${done} de ${total} listos · ${remaining === 1 ? "te falta 1 paso" : `te faltan ${remaining} pasos`} para salir a la venta.`;

  return (
    <section aria-labelledby="go-live-title" className="mb-6 overflow-hidden rounded-2xl border border-brand-accent/25 bg-brand-surface">
      <div className="bg-brand-accent-soft/60 px-5 pb-5 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-widest text-brand-accent">
              {live ? "A LA VENTA" : complete ? "EN REVISIÓN" : `PASO ${currentIndex + 1} DE ${total}`}
            </p>
            <h2 id="go-live-title" className="mt-1 font-display text-lg font-semibold text-brand-ink text-balance">
              Lo que falta para ser visible en el marketplace
            </h2>
            <p className="mt-1 text-sm text-brand-ink-soft">{summary}</p>
          </div>
          <ProgressRing value={percent} />
        </div>
        <div className="mt-4 flex gap-1.5" aria-hidden="true">
          {items.map((item, i) => (
            <span
              key={item.key}
              className={`h-1.5 flex-1 rounded-full motion-safe:transition-colors ${
                item.done ? "bg-brand-accent" : i === currentIndex ? "bg-brand-accent/40" : "bg-white"
              }`}
            />
          ))}
        </div>
      </div>

      <ol aria-label="Pasos para salir a la venta" className="px-5 py-5 sm:px-6">
        {items.map((item, i) => {
          const isCurrent = i === currentIndex;
          const isProgram = item.key === "programa" && !item.done;
          const action = ACTION_LABEL[item.key] ?? "Ir";
          return (
            <li key={item.key} aria-current={isCurrent ? "step" : undefined} className="relative flex gap-4 pb-5">
              {/* La línea que une este paso con el siguiente (hasta la meta). */}
              <span aria-hidden className={`absolute left-4 top-9 bottom-0 w-0.5 -translate-x-1/2 ${item.done ? "bg-brand-accent" : "bg-brand-line"}`} />
              <span
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                  item.done
                    ? "bg-brand-accent text-white"
                    : isCurrent
                      ? "bg-brand-surface text-brand-accent ring-2 ring-brand-accent"
                      : "bg-brand-surface text-brand-ink-soft ring-1 ring-brand-line"
                }`}
              >
                {item.done ? <CheckIcon /> : i + 1}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className={`text-sm ${item.done ? "text-brand-ink-soft" : isCurrent ? "font-semibold text-brand-ink" : "text-brand-ink"}`}>{item.label}</p>
                  {item.done && (
                    <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-[11px] font-medium text-brand-accent">Listo</span>
                  )}
                  {item.done && item.manual && (
                    <button
                      type="button"
                      onClick={() => toggle(item.key, false)}
                      disabled={busy === item.key}
                      className="text-[11px] text-brand-ink-soft hover:underline disabled:opacity-50"
                    >
                      Desmarcar
                    </button>
                  )}
                </div>

                {isCurrent ? (
                  <div className="mt-2 rounded-xl border border-brand-accent/25 bg-brand-accent-soft/40 p-4">
                    <p className="text-sm text-brand-ink-soft">{item.detail}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {isProgram ? (
                        <button
                          type="button"
                          onClick={() => setProgramOpen((o) => !o)}
                          className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                          {programOpen ? "Cerrar" : action}
                        </button>
                      ) : (
                        <StepLink item={item} className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90">
                          {action} →
                        </StepLink>
                      )}
                      {item.manual && (
                        <button
                          type="button"
                          onClick={() => toggle(item.key, true)}
                          disabled={busy === item.key}
                          className="text-sm text-brand-ink-soft hover:text-brand-ink hover:underline disabled:opacity-50"
                        >
                          Así está bien, marcar como listo
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  !item.done && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-xs text-brand-ink-soft">{item.detail}</p>
                      {isProgram ? (
                        <button type="button" onClick={() => setProgramOpen((o) => !o)} className="text-xs font-medium text-brand-accent hover:underline">
                          {programOpen ? "Cerrar" : action}
                        </button>
                      ) : (
                        <StepLink item={item} className="text-xs font-medium text-brand-accent hover:underline">
                          Ir →
                        </StepLink>
                      )}
                    </div>
                  )
                )}
                {item.done && <p className="mt-0.5 text-xs text-brand-ink-soft">{item.detail}</p>}

                {isProgram && programOpen && (
                  <div className="mt-3 rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
                    <OfferForm platformFeePercent={platformFeePercent} vatPercent={vatPercent} onDone={programDone} />
                  </div>
                )}
              </div>
            </li>
          );
        })}

        {/* La meta: lo que pasa cuando todo está listo. */}
        <li className="relative flex gap-4">
          <span
            className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              live ? "bg-brand-ink text-white" : complete ? "bg-brand-accent text-white" : "bg-brand-surface text-brand-ink-soft border border-dashed border-brand-ink-soft/50"
            }`}
          >
            <FlagIcon />
          </span>
          <div className={`min-w-0 flex-1 rounded-xl px-4 py-3 ${live ? "bg-brand-ink text-white" : "bg-brand-bg"}`}>
            <p className={`text-sm font-semibold ${live ? "text-white" : "text-brand-ink"}`}>
              {live ? "¡Estás a la venta en el marketplace!" : "Sales a la venta en el marketplace"}
            </p>
            <p className={`mt-0.5 text-xs ${live ? "text-white/80" : "text-brand-ink-soft"}`}>
              Las creadoras de la red encuentran tu marca, se unen a tu programa y venden tus productos con su código.
              {!approved && !live ? " También hace falta que aprobemos tu marca." : ""}
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}
