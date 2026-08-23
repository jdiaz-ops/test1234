import { signOut } from "@/auth";
import { ChargePaymentBox } from "@/components/portal/charge-payment-box";

type Charge = {
  id: string;
  totalAmount: number;
  dueAt: string;
  status: "PENDING" | "PROOF_SUBMITTED" | "PAID" | "OVERDUE";
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
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-6 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <p className="font-mono text-sm font-medium text-brand-accent tracking-wide mb-4">MARCOLINI</p>
          <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">Tu marca está bloqueada</h1>
          <p className="text-sm text-brand-ink-soft">
            No verificamos tu pago del corte del {new Date(charge.dueAt).toLocaleDateString("es-CO")} a
            tiempo — tu marca quedó oculta del marketplace y el resto del portal no está disponible hasta
            regularizar la situación. Sube tu comprobante abajo y te reactivamos apenas lo verifiquemos.
          </p>
        </div>

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
