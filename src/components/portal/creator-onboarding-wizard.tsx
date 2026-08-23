"use client";

import { useState } from "react";
import type { CreatorOnboardingStep } from "@/server/services/creator-onboarding-service";
import { CreatorProfileStepForm } from "@/components/portal/creator-profile-step-form";
import { PaymentForm } from "@/components/portal/payment-form";
import { CreatorJoinBrandsStep } from "@/components/portal/creator-join-brands-step";
import { CreatorStorefrontStep } from "@/components/portal/creator-storefront-step";

type ProfileStepProps = React.ComponentProps<typeof CreatorProfileStepForm>;
type PaymentStepProps = React.ComponentProps<typeof PaymentForm>;
type JoinStepProps = React.ComponentProps<typeof CreatorJoinBrandsStep>;
type StorefrontStepProps = React.ComponentProps<typeof CreatorStorefrontStep>;

/// Nada de esto bloquea nada — a diferencia del de marcas, un creador puede
/// usar toda la plataforma sin tocar este wizard. Es solo una guía con
/// checkmarks (ver getCreatorOnboardingStatus).
export function CreatorOnboardingWizard({
  steps,
  profileStepProps,
  paymentStepProps,
  joinStepProps,
  storefrontStepProps,
}: {
  steps: CreatorOnboardingStep[];
  profileStepProps: ProfileStepProps;
  paymentStepProps: PaymentStepProps;
  joinStepProps: JoinStepProps;
  storefrontStepProps: StorefrontStepProps;
}) {
  const order = steps.map((s) => s.key);
  const [open, setOpen] = useState<string | null>(steps.find((s) => !s.done)?.key ?? order[0]);

  function goToNext(currentKey: string) {
    const idx = order.indexOf(currentKey);
    setOpen(order[idx + 1] ?? null);
  }

  function toggle(key: string) {
    setOpen((cur) => (cur === key ? null : key));
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const isOpen = open === step.key;
        return (
          <div
            key={step.key}
            className={`rounded-2xl border overflow-hidden ${
              step.done ? "border-brand-line bg-brand-surface" : "border-brand-accent bg-brand-accent-soft"
            }`}
          >
            <button type="button" onClick={() => toggle(step.key)} className="w-full flex items-center gap-4 p-5 text-left">
              <div
                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center font-mono text-sm font-medium ${
                  step.done ? "bg-brand-accent text-white" : "bg-white border border-brand-accent text-brand-accent"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-brand-ink">{step.label}</p>
                <p className="text-xs text-brand-ink-soft mt-0.5">{step.description}</p>
              </div>
              <span className={`shrink-0 text-brand-ink-soft transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {isOpen && (
              <div className="px-5 pb-6 pt-1 border-t border-brand-line bg-brand-bg">
                <div className="pt-5">
                  {step.key === "perfil" && <CreatorProfileStepForm {...profileStepProps} onSaved={() => goToNext("perfil")} />}
                  {step.key === "pago" && <PaymentForm {...paymentStepProps} onSaved={() => goToNext("pago")} />}
                  {step.key === "marcas" && <CreatorJoinBrandsStep {...joinStepProps} />}
                  {step.key === "vitrina" && <CreatorStorefrontStep {...storefrontStepProps} onSaved={() => goToNext("vitrina")} />}
                </div>

                {!step.done && (
                  <button
                    type="button"
                    onClick={() => goToNext(step.key)}
                    className="mt-4 text-xs text-brand-ink-soft hover:text-brand-ink hover:underline"
                  >
                    Omitir por ahora →
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
