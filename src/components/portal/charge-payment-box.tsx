"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Charge = {
  id: string;
  totalAmount: number;
  dueAt: string; // ISO
  status: "PENDING" | "PROOF_SUBMITTED" | "PAID" | "OVERDUE";
  pdfUrl: string | null;
  proofSubmittedAt: string | null;
  proofRejectedAt: string | null;
  proofRejectedReason: string | null;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

function useCountdown(dueAt: string) {
  const [remaining, setRemaining] = useState(() => new Date(dueAt).getTime() - Date.now());
  useEffect(() => {
    const id = setInterval(() => setRemaining(new Date(dueAt).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [dueAt]);
  return remaining;
}

function CountdownLabel({ dueAt }: { dueAt: string }) {
  const remaining = useCountdown(dueAt);
  if (remaining <= 0) return <span className="text-red-600 font-medium">Plazo vencido</span>;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return (
    <span className="font-mono">
      {hours}h {String(minutes).padStart(2, "0")}m {String(seconds).padStart(2, "0")}s
    </span>
  );
}

/// Muestra el corte activo (monto, plazo, instrucciones de pago) y el
/// formulario para subir el comprobante — todo dentro de la plataforma, sin
/// canales aparte. Se usa tanto en Cuenta → Pago como en la pantalla de
/// bloqueo de la marca.
export function ChargePaymentBox({
  charge,
  paymentInstructions,
  paymentQrImageUrl,
}: {
  charge: Charge;
  paymentInstructions: string | null;
  paymentQrImageUrl: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "En revisión" = hay un comprobante subido más reciente que el último
  // rechazo (o nunca se rechazó nada) — así, si el status quedó en OVERDUE
  // por el cron mientras el admin todavía no revisaba, igual se ve
  // correctamente "en revisión" y no como si no se hubiera subido nada.
  const [submitted, setSubmitted] = useState(
    Boolean(charge.proofSubmittedAt) &&
      (!charge.proofRejectedAt || new Date(charge.proofRejectedAt) < new Date(charge.proofSubmittedAt!))
  );

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Selecciona el comprobante");
      return;
    }
    setUploading(true);
    setError(null);

    const form = new FormData();
    form.set("chargeId", charge.id);
    form.set("file", file);

    const res = await fetch("/api/marca/facturacion/comprobante", { method: "POST", body: form });
    setUploading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo subir el comprobante.");
      return;
    }

    setSubmitted(true);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-brand-ink-soft mb-1">Total a pagar</p>
          <p className="font-display text-2xl font-semibold text-brand-ink">{formatCOP(charge.totalAmount)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-brand-ink-soft mb-1">
            {charge.status === "OVERDUE" ? "Bloqueada — vencido el" : "Vence en"}
          </p>
          {charge.status === "OVERDUE" ? (
            <p className="text-sm font-mono text-red-600">
              {new Date(charge.dueAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          ) : (
            <CountdownLabel dueAt={charge.dueAt} />
          )}
        </div>
      </div>

      {charge.proofRejectedReason && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          Tu comprobante anterior no se pudo verificar: {charge.proofRejectedReason}. Sube uno nuevo.
        </p>
      )}

      <div className="border-t border-brand-line pt-4 space-y-3">
        <p className="text-sm font-medium text-brand-ink">Cómo pagar</p>
        {paymentInstructions ? (
          <p className="text-sm text-brand-ink-soft whitespace-pre-line">{paymentInstructions}</p>
        ) : (
          <p className="text-sm text-brand-ink-soft">Contacta a Marcolini para tus datos de pago.</p>
        )}
        {paymentQrImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- imagen subida por el admin, no optimizable por next/image sin configurar el dominio
          <img src={paymentQrImageUrl} alt="Código QR para pagar" className="w-36 h-36 rounded-lg border border-brand-line" />
        )}
        {charge.pdfUrl && (
          <a href={charge.pdfUrl} target="_blank" rel="noreferrer" className="block text-xs text-brand-accent font-medium hover:underline">
            Ver aviso de cobro (PDF)
          </a>
        )}
      </div>

      <form onSubmit={handleUpload} className="border-t border-brand-line pt-4 space-y-3">
        <p className="text-sm font-medium text-brand-ink">
          {submitted ? "Comprobante subido — esperando verificación" : "Sube tu comprobante"}
        </p>
        {submitted && (
          <p className="text-xs text-brand-ink-soft">
            Lo revisamos y apenas lo verifiquemos tu marca queda reactivada. Si necesitas corregirlo, puedes
            subir uno nuevo.
          </p>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-brand-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-brand-accent-soft file:px-4 file:py-2 file:text-sm file:text-brand-accent file:font-medium"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={uploading}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : submitted ? "Subir otro comprobante" : "Subir comprobante"}
        </button>
      </form>
    </div>
  );
}
