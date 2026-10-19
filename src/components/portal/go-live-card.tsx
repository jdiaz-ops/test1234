"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OfferForm } from "@/components/portal/offer-form";
import { StorePaymentForm, type StorePaymentInitial } from "@/components/portal/store-payment-form";
import { InventoryStep, LegalStep, ShippingStep } from "@/components/portal/go-live-steps";
import type { GoLiveChecklist, GoLiveItem, GoLiveKey } from "@/server/services/go-live-service";

/// "Lo que falta para ser visible en el marketplace" en el Dashboard de la
/// marca (ver go-live-service.ts) — su onboarding: arriba el avance, después
/// los pasos que faltan, unidos por una línea, y al final la meta, salir a
/// la venta. Cada paso se hace ahí mismo (ver go-live-steps.tsx), en el
/// orden que la marca quiera, y cuando queda listo desaparece y el avance se
/// actualiza. Pedidos del 2026-10-19: "que se sienta los pasos, el progreso
/// y el resultado", "que hagan el paso ahí mismo", "cuando un paso está
/// validado desaparece", "que se pueda hacer cualquiera en el orden que uno
/// quiera" y quitar "Ver lo que ya está listo".

function FlagIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}

/// Un ícono por paso, en vez de un número: se hacen en cualquier orden.
const STEP_ICON: Partial<Record<GoLiveKey, React.ReactNode>> = {
  legal: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  envios: (
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  pagos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </>
  ),
  inventario: (
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
    </>
  ),
  programa: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.2A5 5 0 0 1 21 19" />
    </>
  ),
};

function StepIcon({ stepKey }: { stepKey: GoLiveKey }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      {STEP_ICON[stepKey] ?? <circle cx="12" cy="12" r="3" />}
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

export function GoLiveCard({
  checklist,
  approved,
  platformFeePercent,
  vatPercent,
  legal,
  payment,
}: {
  checklist: GoLiveChecklist;
  /// La aprobación de Marcolini: también hace falta para salir.
  approved: boolean;
  /// Para la calculadora del programa de creadores (ver OfferForm).
  platformFeePercent: number;
  vatPercent: number;
  /// Lo que ya tiene escrito, para el paso de razón social y NIT.
  legal: { legalName: string; taxId: string };
  /// Para el paso de pagos (ver storePaymentInitial).
  payment: StorePaymentInitial;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // Lo que la marca acaba de marcar, mientras llega la lista nueva del
  // servidor: con otra lista (otro `checklist`) ya no aplica.
  const [optimistic, setOptimistic] = useState<{ base: GoLiveChecklist; done: Partial<Record<GoLiveKey, boolean>> }>({ base: checklist, done: {} });
  const [openKey, setOpenKey] = useState<GoLiveKey | null>(null);
  const [optionalOpen, setOptionalOpen] = useState<GoLiveKey | null>(null);
  const [busy, setBusy] = useState<GoLiveKey | null>(null);

  const overrides = optimistic.base === checklist ? optimistic.done : {};
  const items: GoLiveItem[] = checklist.items.map((i) => (overrides[i.key] === undefined ? i : { ...i, done: overrides[i.key]! }));
  // Lo opcional (hoy el inventario) va aparte: no cuenta ni frena la
  // salida a la venta (ver buildItems en go-live-service.ts).
  const required = items.filter((i) => !i.optional);
  const optionalPending = items.filter((i) => i.optional && !i.done);
  const pending = required.filter((i) => !i.done);
  const total = required.length;
  const done = total - pending.length;
  const complete = pending.length === 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const live = complete && approved;
  // El paso abierto: el que eligió, si todavía falta. Ninguno va abierto de
  // entrada (no hay orden obligado), salvo que quede uno solo.
  const open = pending.length === 1 ? pending[0].key : (pending.find((i) => i.key === openKey)?.key ?? null);

  function refresh() {
    startRefresh(() => router.refresh());
  }

  function mark(key: GoLiveKey, value: boolean) {
    setOptimistic((prev) => ({ base: checklist, done: { ...(prev.base === checklist ? prev.done : {}), [key]: value } }));
  }

  async function toggle(key: GoLiveKey, next: boolean) {
    setBusy(key);
    try {
      const res = await fetch("/api/marca/tienda/salida", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, done: next }),
      });
      if (res.ok) {
        mark(key, next);
        refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  // Lo listo se va de la lista, así que todo se cuenta sobre lo que falta
  // (pedido del 2026-10-19: "dice 5 pasos y luego no está ni el 1").
  const remaining = pending.length;
  const summary = complete
    ? "Listo de tu lado: estamos revisando tu marca para que salga en el marketplace."
    : remaining === 1
      ? "Hazlo aquí mismo y sales a la venta."
      : "Hazlos aquí mismo, en el orden que quieras. Cuando uno queda listo, desaparece.";

  function stepBody(item: GoLiveItem) {
    switch (item.key) {
      case "legal":
        return <LegalStep initial={legal} onSaved={refresh} />;
      case "envios":
        return <ShippingStep onSaved={refresh} />;
      case "pagos":
        return <StorePaymentForm initial={payment} compact />;
      case "inventario":
        return (
          <div className="space-y-3">
            <InventoryStep
              onDoneAll={() => {
                mark("inventario", true);
                refresh();
              }}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => toggle("inventario", true)}
                disabled={busy === "inventario"}
                className="rounded-full border border-brand-line bg-brand-surface px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
              >
                Así está bien, vender sin límite
              </button>
              <Link href={item.href} className="text-xs text-brand-ink-soft hover:underline">
                Más opciones en Productos
              </Link>
            </div>
          </div>
        );
      case "programa":
        return (
          <OfferForm
            platformFeePercent={platformFeePercent}
            vatPercent={vatPercent}
            onDone={() => {
              mark("programa", true);
              refresh();
            }}
          />
        );
      default:
        return (
          <Link href={item.href} className="inline-block rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90">
            Ir →
          </Link>
        );
    }
  }

  const optionalSteps =
    optionalPending.length > 0 ? (
      <div className="space-y-2">
        {optionalPending.map((item) => {
          const isOpen = optionalOpen === item.key;
          return (
            <div key={item.key} className="rounded-xl border border-brand-line bg-brand-surface px-4 py-3">
              <button
                type="button"
                onClick={() => setOptionalOpen(isOpen ? null : item.key)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <span className="flex min-w-0 gap-3">
                  <span className="mt-0.5 shrink-0 text-brand-ink-soft">
                    <StepIcon stepKey={item.key} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-brand-ink">
                      {item.label}
                      <span className="ml-2 rounded-full bg-brand-bg px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-brand-ink-soft">
                        Opcional
                      </span>
                    </span>
                    {!isOpen && <span className="mt-0.5 block text-xs text-brand-ink-soft">{item.detail}</span>}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    isOpen ? "text-brand-ink-soft hover:text-brand-ink" : "border border-brand-line text-brand-ink hover:bg-brand-accent-soft"
                  }`}
                >
                  {isOpen ? "Cerrar" : "Hacer ahora"}
                </span>
              </button>
              {isOpen && <div className="mt-3">{stepBody(item)}</div>}
            </div>
          );
        })}
      </div>
    ) : null;

  // A la venta: queda la confirmación, y debajo lo opcional que falte (si
  // algo se desarma, como los pagos, la lista vuelve sola).
  if (live) {
    return (
      <div className="mb-6 space-y-3">
        <section className="flex items-center gap-3 rounded-2xl bg-brand-ink px-5 py-4 text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
            <FlagIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">¡Estás a la venta en el marketplace!</p>
            <p className="text-xs text-white/80">Las creadoras pueden encontrar tu marca, unirse a tu programa y vender con su código.</p>
          </div>
        </section>
        {optionalSteps}
      </div>
    );
  }

  return (
    <section aria-labelledby="go-live-title" className="mb-6 overflow-hidden rounded-2xl border border-brand-accent/25 bg-brand-surface">
      <div className="bg-brand-accent-soft/60 px-5 pb-5 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-widest text-brand-accent">
              {complete ? "EN REVISIÓN" : remaining === 1 ? "TE FALTA 1 PASO" : `TE FALTAN ${remaining} PASOS`}
            </p>
            <h2 id="go-live-title" className="mt-1 font-display text-lg font-semibold text-brand-ink text-balance">
              Lo que falta para ser visible en el marketplace
            </h2>
            <p className="mt-1 text-sm text-brand-ink-soft" aria-live="polite">
              {summary}
              {refreshing ? " Actualizando…" : ""}
            </p>
          </div>
          <ProgressRing value={percent} />
        </div>
      </div>

      <ol aria-label="Pasos que faltan para salir a la venta" className="px-5 py-5 sm:px-6">
        {pending.map((item) => {
          const isOpen = item.key === open;
          return (
            <li key={item.key} className="relative flex gap-4 pb-5">
              {/* La línea que une este paso con el siguiente (hasta la meta). */}
              <span aria-hidden className="absolute bottom-0 left-4 top-9 w-0.5 -translate-x-1/2 bg-brand-line" />
              <span
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-surface ${
                  isOpen ? "text-brand-accent ring-2 ring-brand-accent" : "text-brand-ink-soft ring-1 ring-brand-line"
                }`}
              >
                <StepIcon stepKey={item.key} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => setOpenKey(isOpen ? null : item.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className={`block text-sm ${isOpen ? "font-semibold text-brand-ink" : "font-medium text-brand-ink"}`}>{item.label}</span>
                    {!isOpen && <span className="mt-0.5 block text-xs text-brand-ink-soft">{item.detail}</span>}
                  </span>
                  {pending.length > 1 && (
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        isOpen ? "text-brand-ink-soft hover:text-brand-ink" : "border border-brand-accent/40 text-brand-accent hover:bg-brand-accent-soft"
                      }`}
                    >
                      {isOpen ? "Cerrar" : "Hacer ahora"}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="mt-2 space-y-3 rounded-xl border border-brand-accent/25 bg-brand-accent-soft/40 p-4">
                    {/* En envíos e inventario el formulario ya cuenta lo que falta. */}
                    {item.key !== "envios" && item.key !== "inventario" && <p className="text-sm text-brand-ink-soft">{item.detail}</p>}
                    {stepBody(item)}
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
              complete ? "bg-brand-accent text-white" : "border border-dashed border-brand-ink-soft/50 bg-brand-surface text-brand-ink-soft"
            }`}
          >
            <FlagIcon />
          </span>
          <div className="min-w-0 flex-1 rounded-xl bg-brand-bg px-4 py-3">
            <p className="text-sm font-semibold text-brand-ink">Sales a la venta en el marketplace</p>
            <p className="mt-0.5 text-xs text-brand-ink-soft">
              Las creadoras de la red encuentran tu marca, se unen a tu programa y venden tus productos con su código.
              {!approved ? " También hace falta que aprobemos tu marca." : ""}
            </p>
          </div>
        </li>
      </ol>
      {optionalSteps && <div className="border-t border-brand-line px-5 py-4 sm:px-6">{optionalSteps}</div>}
    </section>
  );
}
