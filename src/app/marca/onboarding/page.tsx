import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBrandOnboardingStatus } from "@/server/services/onboarding-service";

export default async function OnboardingPage() {
  const session = await auth();
  const profile = await prisma.brandProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const { steps, complete, completedCount, total } = await getBrandOnboardingStatus(profile);

  // Ya no hay nada pendiente — esta página no tiene sentido, de vuelta al Dashboard.
  if (complete) redirect("/marca");

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">EMPIEZA AQUÍ</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Prepara tu marca para el marketplace
      </h1>
      <p className="text-sm text-brand-ink-soft mb-6 max-w-lg">
        Puedes explorar todo el portal mientras tanto, pero tu oferta solo se hace visible para los
        creadores cuando completes estos {total} pasos — es lo mínimo para que la atribución, el
        cobro y las comisiones funcionen bien desde el primer día.
      </p>

      <div className="flex items-center gap-3 mb-8">
        <div className="flex-1 h-2 rounded-full bg-brand-line overflow-hidden">
          <div
            className="h-full bg-brand-accent transition-all"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>
        <p className="text-xs font-mono text-brand-ink-soft shrink-0">
          {completedCount}/{total}
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.key}
            className={`rounded-2xl border p-5 flex items-center gap-4 ${
              step.done ? "border-brand-line bg-brand-surface opacity-60" : "border-brand-accent bg-brand-accent-soft"
            }`}
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
            {!step.done && (
              <Link
                href={step.href}
                className="shrink-0 bg-brand-accent text-white rounded-full px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                Completar
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
