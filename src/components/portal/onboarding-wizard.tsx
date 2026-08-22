"use client";

import { useState } from "react";
import type { OnboardingStep } from "@/server/services/onboarding-service";
import { BrandProfileForm } from "@/components/portal/brand-profile-form";
import { StoreConnectionForm } from "@/components/portal/store-connection-form";
import { CardForm } from "@/components/portal/card-form";
import { OfferForm } from "@/components/portal/offer-form";

type ProfileValues = React.ComponentProps<typeof BrandProfileForm>["initial"];
type ProfileFiles = React.ComponentProps<typeof BrandProfileForm>["files"];
type StoreValues = React.ComponentProps<typeof StoreConnectionForm>["initial"];

export function OnboardingWizard({
  steps,
  profile,
  store,
  hasCard,
  cardHolder,
  platformFeePercent,
  vatPercent,
}: {
  steps: OnboardingStep[];
  profile: { initial: ProfileValues; files: ProfileFiles };
  store: { initial: StoreValues; initialWebhookUrl: string | null; initialWebhookSecret: string | null };
  hasCard: boolean;
  cardHolder: { name: string; email: string };
  platformFeePercent: number;
  vatPercent: number;
}) {
  const order = steps.map((s) => s.key);
  const tiendaDone = steps.find((s) => s.key === "tienda")?.done ?? false;
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
            <button
              type="button"
              onClick={() => toggle(step.key)}
              className="w-full flex items-center gap-4 p-5 text-left"
            >
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
              <span className={`shrink-0 text-brand-ink-soft transition-transform ${isOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>

            {isOpen && (
              <div className="px-5 pb-6 pt-1 border-t border-brand-line bg-brand-bg">
                <div className="pt-5">
                  {step.key === "perfil" && (
                    <BrandProfileForm
                      initial={profile.initial}
                      files={profile.files}
                      onSaved={() => goToNext("perfil")}
                    />
                  )}
                  {step.key === "tienda" && (
                    <StoreConnectionForm
                      initial={store.initial}
                      initialWebhookUrl={store.initialWebhookUrl}
                      initialWebhookSecret={store.initialWebhookSecret}
                      shopifyConnected={tiendaDone && store.initial.storeType === "SHOPIFY"}
                      onSaved={() => goToNext("tienda")}
                    />
                  )}
                  {step.key === "pago" && (
                    <CardForm
                      hasCard={hasCard}
                      initialHolderName={cardHolder.name}
                      initialHolderEmail={cardHolder.email}
                      onSaved={() => goToNext("pago")}
                    />
                  )}
                  {step.key === "oferta" && (
                    <OfferForm
                      onDone={() => goToNext("oferta")}
                      platformFeePercent={platformFeePercent}
                      vatPercent={vatPercent}
                    />
                  )}
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
