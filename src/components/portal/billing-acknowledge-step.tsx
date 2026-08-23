"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Paso "Cómo te cobramos" del onboarding — sin nada que configurar (no hay
/// tarjeta que guardar), solo que la marca entienda el ciclo antes de salir
/// en vivo: el día 1 llega el corte, paga por transferencia (QR/Bre-B) y
/// tiene un plazo antes de quedar oculta del marketplace si no se verifica
/// el pago.
export function BillingAcknowledgeStep({
  paymentInstructions,
  paymentQrImageUrl,
  onSaved,
}: {
  paymentInstructions: string | null;
  paymentQrImageUrl: string | null;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/marca/facturacion/reconocer", { method: "POST" });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo guardar — intenta de nuevo.");
      return;
    }
    router.refresh();
    onSaved?.();
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 space-y-3">
        <p className="text-sm text-brand-ink">
          El día 1 de cada mes te mandamos el corte: la comisión de tus creadores de contenido + la tarifa
          de Marcolini de ese período, con el desglose completo.
        </p>
        <p className="text-sm text-brand-ink">
          Pagas por transferencia directa — QR o Bre-B, sin tarjeta ni procesador de por medio — y subes tu
          comprobante en la plataforma. Apenas lo verificamos, quedas al día.
        </p>
        <p className="text-sm text-brand-ink">
          Si no verificamos tu pago dentro del plazo, tu marca se oculta del marketplace hasta que lo
          regularices — el resto de tu portal sigue disponible normalmente mientras estés al día.
        </p>
      </div>

      {(paymentInstructions || paymentQrImageUrl) && (
        <div className="rounded-2xl border border-brand-line bg-brand-bg p-5 space-y-3">
          <p className="text-xs font-medium text-brand-ink-soft">Así vas a recibir las instrucciones de pago:</p>
          {paymentInstructions && <p className="text-sm text-brand-ink-soft whitespace-pre-line">{paymentInstructions}</p>}
          {paymentQrImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- imagen subida por el admin
            <img src={paymentQrImageUrl} alt="Código QR para pagar" className="w-28 h-28 rounded-lg border border-brand-line" />
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Entendido"}
      </button>
    </div>
  );
}
