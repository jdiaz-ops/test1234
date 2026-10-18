"use client";

import { useState } from "react";

/// Configuración → Inteligencia artificial: muestra si la llave de Claude
/// está en este despliegue y, con "Probar conexión", si es válida y si la
/// cuenta tiene crédito. Ver ai-status-service.ts.

type Status = {
  configured: boolean;
  keyValid: boolean | null;
  credit: boolean | null;
  model: string;
  latencyMs: number | null;
  error: string | null;
};

function mark(value: boolean | null) {
  if (value === true) return <span className="text-green-700">sí</span>;
  if (value === false) return <span className="text-red-600">no</span>;
  return <span className="text-brand-ink-soft">sin probar</span>;
}

export function AiStatusCard({ configured }: { configured: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function test() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ia");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo probar.");
      setStatus(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo probar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-line p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-brand-ink">Claude (Anthropic)</p>
          <p className="text-xs text-brand-ink-soft">
            Redacta descripciones y perfiles, lee catálogos en PDF o Excel y propone colecciones. Necesita la variable ANTHROPIC_API_KEY en
            Vercel; la prueba pide una respuesta de una palabra y cuesta una fracción de centavo.
          </p>
        </div>
        <button
          type="button"
          onClick={test}
          disabled={busy}
          className="border border-brand-line rounded-full px-5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-accent-soft disabled:opacity-50"
        >
          {busy ? "Probando…" : "Probar conexión"}
        </button>
      </div>
      <p className="text-sm text-brand-ink">
        Llave en este despliegue: {configured ? <span className="text-green-700">configurada</span> : <span className="text-red-600">no configurada</span>}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && (
        <ul className="text-sm text-brand-ink space-y-1">
          <li>Llave válida: {mark(status.keyValid)}</li>
          <li>Crédito disponible: {mark(status.credit)}</li>
          <li>
            Modelo: <span className="font-mono text-xs">{status.model}</span>
            {status.latencyMs != null ? ` · respondió en ${(status.latencyMs / 1000).toFixed(1)} s` : ""}
          </li>
          {status.error && <li className="text-red-600">{status.error}</li>}
          {!status.error && <li className="text-green-700">Todo en orden: la IA está lista para usarse.</li>}
        </ul>
      )}
    </div>
  );
}
