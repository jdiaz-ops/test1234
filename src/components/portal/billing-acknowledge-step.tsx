"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Paso "Cómo te cobramos" del onboarding — sin nada que configurar (no hay
/// tarjeta que guardar), solo que la marca entienda qué paga y el ciclo
/// antes de salir en vivo: la tarifa es sobre toda venta de la tienda (con
/// o sin creadora, 2026-10-17), el día 1 llega el corte, paga por
/// transferencia (QR/Bre-B) y tiene un plazo antes de quedar oculta del
/// marketplace si no se verifica el pago.
export function BillingAcknowledgeStep({
  paymentInstructions,
  paymentQrImageUrl,
  platformFeePercent,
  onSaved,
}: {
  paymentInstructions: string | null;
  paymentQrImageUrl: string | null;
  platformFeePercent: number;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/marca/facturacion/reconocer", {
      method: "POST",
    });
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
          Marcolini cobra el <strong>{platformFeePercent} % + IVA sobre cada venta pagada en tu tienda</strong>,
          tenga o no código de creadora. Si usas solo la tienda, pagas lo mismo por cada venta.
        </p>
        <p className="text-sm text-brand-ink">
          Cuando la venta viene con el código de una creadora, se suma la comisión que tú definiste
          para ella. Sin mensualidades: si no vendes, no pagas.
        </p>
        <p className="text-sm text-brand-ink">
          El día 1 de cada mes te mandamos el corte con el desglose completo: tarifa de Marcolini +
          comisiones de tus creadoras de ese período.
        </p>
        <p className="text-sm text-brand-ink">
          Pagas por transferencia directa — QR o Bre-B — y subes tu comprobante
          en la plataforma. Apenas lo verificamos, quedas al día.
        </p>
        <p className="text-sm text-brand-ink">
          Si no verificamos tu pago dentro del plazo, tu marca se oculta del
          marketplace hasta que lo regularices.
        </p>
      </div>

      {(paymentInstructions || paymentQrImageUrl) && (
        <div className="rounded-2xl border border-brand-line bg-brand-bg p-5 space-y-3">
          <p className="text-xs font-medium text-brand-ink-soft">
            Así vas a recibir las instrucciones de pago:
          </p>
          {paymentInstructions && (
            <p className="text-sm text-brand-ink-soft whitespace-pre-line">
              {paymentInstructions}
            </p>
          )}
          {paymentQrImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- imagen subida por el admin
            <img
              src={paymentQrImageUrl}
              alt="Código QR para pagar"
              className="w-28 h-28 rounded-lg border border-brand-line"
            />
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
