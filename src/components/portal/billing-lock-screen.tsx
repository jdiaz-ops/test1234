import { signOut } from "@/auth";
import { ChargePaymentBox } from "@/components/portal/charge-payment-box";

type Charge = {
  id: string;
  totalAmount: number;
  dueAt: string;
  deactivationDueAt: string | null;
  deactivatedAt: string | null;
  status: "PENDING" | "PROOF_SUBMITTED" | "PAID" | "OVERDUE" | "DEACTIVATED";
  pdfUrl: string | null;
  proofSubmittedAt: string | null;
  proofRejectedAt: string | null;
  proofRejectedReason: string | null;
};

/// Pantalla de bloqueo total — se muestra en vez de cualquier otra sección
/// del Portal Marca mientras el corte esté OVERDUE. Apenas se verifique el
/// comprobante, el acceso normal vuelve solo (ver marca/layout.tsx).
export function BillingLockScreen({ charge, paymentInstructions, paymentQrImageUrl }: {
  charge: Charge;
  paymentInstructions: string | null;
  paymentQrImageUrl: string | null;
}) {
  return (
    <div className="flex-1 flex items-center justify-center bg-brand-bg px-6 py-12">
      <div className="w-full max-w-lg space-y-6">
        <p className="text-center font-mono text-sm font-medium text-brand-accent tracking-wide">MARCOLINI</p>

        <ChargePaymentBox charge={charge} paymentInstructions={paymentInstructions} paymentQrImageUrl={paymentQrImageUrl} />

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="text-center"
        >
          <button className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline">
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
