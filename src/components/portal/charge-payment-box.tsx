"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Charge = {
  id: string;
  totalAmount: number;
  dueAt: string; // ISO
  deactivationDueAt: string | null; // ISO — plazo (Nivel 2 → 3), solo relevante en OVERDUE
  deactivatedAt: string | null; // ISO — momento exacto en que pasó a DEACTIVATED (Nivel 3)
  status: "PENDING" | "PROOF_SUBMITTED" | "PAID" | "OVERDUE" | "DEACTIVATED";
  pdfUrl: string | null;
  proofSubmittedAt: string | null;
  proofRejectedAt: string | null;
  proofRejectedReason: string | null;
};

function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amount);
}

// Fecha y hora por separado, unidas con una coma fija, en formato 24h,
// siempre en hora Colombia — tanto el conector del formateador combinado
// (dateStyle+timeStyle, "a las") como el espacio angosto que mete "a.
// m./p. m." varían entre el Node del servidor y el navegador y rompen la
// hidratación; 24h evita el segundo problema y separar fecha/hora evita
// el primero. Fijar timeZone además evita un tercer problema: sin esto,
// cada lado usa su propia zona horaria local (la del servidor puede no
// ser la del navegador de quien lo ve) — con Marcolini operando solo en
// Colombia, siempre debe verse en esa hora, sin importar dónde corra cada
// lado.
function formatDueAt(dueAt: string) {
  const d = new Date(dueAt);
  const datePart = d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
  const timePart = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });
  return `${datePart}, ${timePart}`;
}

/// Muestra el corte activo (monto, plazo, instrucciones de pago) y el
/// formulario para subir el comprobante — todo dentro de la plataforma, sin
/// canales aparte. Se usa tanto en Cuenta → Pago (la marca todavía tiene
/// acceso normal) como en la pantalla de bloqueo (ya está OVERDUE) — es
/// literalmente el mismo componente en los dos momentos: el estado del
/// corte decide la etiqueta, el título y la frase, todo lo demás es igual.
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

  const locked = charge.status === "OVERDUE" || charge.status === "DEACTIVATED";
  const deactivated = charge.status === "DEACTIVATED";
  const dueAtLabel = formatDueAt(charge.dueAt);
  const deactivationDueAtLabel = charge.deactivationDueAt ? formatDueAt(charge.deactivationDueAt) : null;
  // deactivatedAt (no deactivationDueAt) porque en Nivel 3 sí se muestra la
  // hora exacta a la que pasó — a diferencia de los plazos de Nivel 1/2,
  // que siempre se redondean a las 3pm (ver businessDeadline).
  const deactivatedAtLabel = charge.deactivatedAt ? formatDueAt(charge.deactivatedAt) : deactivationDueAtLabel;

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
      <div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-mono font-medium mb-3 ${
            locked ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${locked ? "bg-red-600" : "bg-amber-700"}`} />
          {deactivated ? "Servicio desactivado" : locked ? "Cuenta inhabilitada" : "Pago pendiente"}
        </span>
        <h2 className="font-display text-lg font-semibold text-brand-ink mb-1.5">
          {deactivated
            ? "Tu servicio está desactivado por falta de pago"
            : locked
              ? "Tu cuenta está temporalmente inhabilitada"
              : "Tu cuenta sigue activa — por ahora"}
        </h2>
        <p className="text-sm text-brand-ink-soft leading-relaxed">
          {deactivated ? (
            <>
              Desde el <strong className="text-brand-ink">{deactivatedAtLabel}</strong> tu servicio quedó
              desactivado: ya no apareces en el marketplace y los códigos de tus creadores dejaron de atribuir
              ventas. Lo que debes sigue igual hasta que verifiquemos tu pago. Se reactiva todo automático —
              panel, marketplace y códigos — en cuanto confirmemos tu comprobante.
            </>
          ) : locked ? (
            <>
              No tienes acceso al panel, pero el servicio sigue funcionando: sigues en el marketplace y los
              códigos de tus creadores siguen atribuyendo ventas. Tienes hasta el{" "}
              <strong className="text-brand-ink">{deactivationDueAtLabel}</strong> para regularizar tu pago — si no
              llega a tiempo, el servicio se desactiva por completo. Se reactiva todo automático en cuanto
              confirmemos tu comprobante.
            </>
          ) : (
            <>
              Tienes hasta el <strong className="text-brand-ink">{dueAtLabel}</strong> para confirmar tu pago. Si no
              llega a tiempo, tu cuenta queda temporalmente inhabilitada: sin acceso al panel, aunque el servicio
              sigue funcionando (marketplace y códigos).
            </>
          )}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-brand-line pt-4">
        <div>
          <p className="text-xs text-brand-ink-soft mb-1">Total a pagar</p>
          <p className="font-display text-2xl font-semibold text-brand-ink">{formatCOP(charge.totalAmount)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-brand-ink-soft mb-1">
            {deactivated ? "Desactivado desde" : locked ? "Se desactiva el" : "Vence"}
          </p>
          <p className={`text-sm font-mono ${locked ? "text-red-600" : "text-brand-ink"}`}>
            {deactivated ? deactivatedAtLabel : locked ? deactivationDueAtLabel : dueAtLabel}
          </p>
        </div>
      </div>

      {charge.proofRejectedReason && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          Tu comprobante anterior no se pudo verificar: {charge.proofRejectedReason}. Sube uno nuevo.
        </p>
      )}

      <div className="border-t border-brand-line pt-4 space-y-3">
        <p className="text-sm font-medium text-brand-ink">Cómo pagar</p>
        <div className="rounded-2xl bg-brand-accent-soft p-5 flex flex-col sm:flex-row items-center gap-5">
          {paymentQrImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- imagen subida por el admin, no optimizable por next/image sin configurar el dominio
            <img
              src={paymentQrImageUrl}
              alt="Código QR para pagar"
              className="w-36 h-36 rounded-xl border-4 border-brand-surface shadow-sm shrink-0 bg-brand-surface"
            />
          )}
          {paymentInstructions ? (
            <p className="text-sm text-brand-ink whitespace-pre-line leading-relaxed font-medium text-center sm:text-left">
              {paymentInstructions}
            </p>
          ) : (
            <p className="text-sm text-brand-ink-soft">Contacta a Marcolini para tus datos de pago.</p>
          )}
        </div>

        <div className="rounded-lg border border-brand-accent/30 bg-brand-accent-soft/50 px-3.5 py-2.5">
          <p className="text-xs text-brand-ink leading-relaxed">
            <strong>Importante:</strong> después de pagar, sube tu comprobante abajo y espera a que lo
            aprobemos — la cuenta se reactiva apenas lo verifiquemos, no de inmediato al subirlo.
          </p>
        </div>

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
            Lo revisamos y apenas lo verifiquemos tu cuenta queda reactivada. Si necesitas corregirlo, puedes
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
          {uploading ? "Subiendo..." : submitted ? "Subir otro comprobante" : "Enviar comprobante"}
        </button>
      </form>
    </div>
  );
}
