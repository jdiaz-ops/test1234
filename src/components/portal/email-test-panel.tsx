"use client";

import { useState } from "react";

type Result = {
  ok: boolean;
  id?: string | null;
  error?: string;
  to: string;
  from: string;
  usingTestSender: boolean;
  hasApiKey: boolean;
  linksBase: string;
  appUrlSet: boolean;
};

/// "Probar envío de correos" en Admin → Diagnóstico de correo: manda un
/// correo real y muestra qué respondió Resend y cómo está configurado.
export function EmailTestPanel() {
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/diagnostico-correo/prueba", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    setResult(await res.json().catch(() => null));
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mb-10 max-w-2xl">
      <h2 className="font-display text-base font-semibold text-brand-ink mb-1">Probar envío de correos</h2>
      <p className="text-sm text-brand-ink-soft mb-4">
        Manda un correo de prueba y te muestra exactamente qué respondió el servicio de correos.
      </p>
      <form onSubmit={run} className="flex flex-wrap gap-3">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Correo de destino (vacío = el tuyo)"
          className="input max-w-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar prueba"}
        </button>
      </form>

      {result && (
        <div className="mt-4 text-sm space-y-1.5">
          <p className={result.ok ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
            {result.ok
              ? `Enviado a ${result.to}. Si no llega en unos minutos, revisa spam.`
              : `No salió: ${result.error}`}
          </p>
          <p className="text-brand-ink-soft">
            Remitente: <span className="font-mono">{result.from}</span>
          </p>
          <p className="text-brand-ink-soft">
            Links de los correos: <span className="font-mono">{result.linksBase}</span>
          </p>
          {!result.hasApiKey && (
            <p className="text-red-700">
              Falta la variable RESEND_API_KEY en Vercel (la clave de tu cuenta de Resend).
            </p>
          )}
          {result.usingTestSender && (
            <p className="text-amber-700">
              Se está enviando desde la dirección de prueba de Resend (onboarding@resend.dev): así
              solo le llegan correos al dueño de la cuenta de Resend. Verifica tu dominio en Resend y
              pon en Vercel EMAIL_FROM, por ejemplo: Marcolini &lt;no-reply@marcolini.lat&gt;.
            </p>
          )}
          {!result.appUrlSet && (
            <p className="text-amber-700">
              Falta APP_URL en Vercel (https://marcolini.lat). Los links ya usan marcolini.lat igual,
              pero conviene ponerla.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
