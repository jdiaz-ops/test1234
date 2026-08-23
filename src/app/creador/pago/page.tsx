import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentForm } from "@/components/portal/payment-form";
import { InstantPayoutPanel } from "@/components/portal/instant-payout-panel";
import { getInstantPayoutEligibility } from "@/server/services/payment-service";

export default async function PagoPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });
  const eligibility = await getInstantPayoutEligibility(profile.id);
  const hasBankInfo = !!(profile.bankName && profile.bankAccountType && profile.bankAccountNumber && profile.paymentHolderName);

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">CONFIGURACIÓN DE PAGO</p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Dónde te pagamos</h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-lg">
        Cada mes (día 15) juntamos tus comisiones aprobadas y te las transferimos manualmente a la cuenta o
        llave Bre-B que dejes aquí.
      </p>

      <PaymentForm
        initial={{
          documentId: profile.documentId ?? "",
          payoutMethod: profile.payoutMethod ?? "BANK",
          breBKey: profile.breBKey ?? "",
          bankName: profile.bankName ?? "",
          bankAccountType: profile.bankAccountType ?? "",
          bankAccountNumber: profile.bankAccountNumber ?? "",
          paymentHolderName: profile.paymentHolderName ?? "",
        }}
      />

      <div className="mt-10 pt-8 border-t border-brand-line max-w-lg">
        <h2 className="font-display font-semibold text-brand-ink mb-2">Cobro anticipado</h2>
        <p className="text-sm text-brand-ink-soft mb-4">
          ¿No quieres esperar al día 15? Adelanta lo que ya tengas aprobado hoy mismo, con un fee del{" "}
          {eligibility.feePercent}%.
        </p>
        <InstantPayoutPanel
          amountAvailable={eligibility.amountAvailable}
          feePercent={eligibility.feePercent}
          feeAmount={eligibility.feeAmount}
          netAmount={eligibility.netAmount}
          hasBankInfo={hasBankInfo}
        />
      </div>
    </div>
  );
}
