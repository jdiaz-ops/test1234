import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentForm } from "@/components/portal/payment-form";

export default async function PagoPage() {
  const session = await auth();
  const profile = await prisma.creatorProfile.findUniqueOrThrow({
    where: { userId: session!.user.id },
  });

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
          payoutMethod: profile.payoutMethod ?? "BRE_B",
          breBKey: profile.breBKey ?? "",
          bankName: profile.bankName ?? "",
          bankAccountType: profile.bankAccountType ?? "",
          bankAccountNumber: profile.bankAccountNumber ?? "",
          paymentHolderName: profile.paymentHolderName ?? "",
        }}
      />
    </div>
  );
}
