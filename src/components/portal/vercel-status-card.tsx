"use client";

import { useState } from "react";

/// Configuración → Dominios propios: con "Probar conexión", si el token de
/// Vercel está en este despliegue y Vercel lo acepta — así Marcolini
/// registra solo el dominio de cada marca. Ver checkVercelConnection.

type Status = {
  token: boolean;
  project: boolean;
  ok: boolean;
  projectName: string | null;
  domains: string[] | null;
  error: string | null;
};

function mark(value: boolean) {
  return value ? <span className="text-green-700">sí</span> : <span className="text-red-600">no</span>;
}

export function VercelStatusCard({ configured }: { configured: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function test() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dominios", { cache: "no-store" });
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
          <p className="text-sm font-medium text-brand-ink">Vercel</p>
          <p className="text-xs text-brand-ink-soft">
            Con la variable VERCEL_API_TOKEN, Marcolini agrega solo el dominio de cada marca cuando lo verifica. La prueba solo lee: no agrega ni
            quita nada.
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
        Token en este despliegue: {configured ? <span className="text-green-700">configurado</span> : <span className="text-red-600">no configurado</span>}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && (
        <ul className="text-sm text-brand-ink space-y-1">
          <li>Token: {mark(status.token)}</li>
          <li>Proyecto: {status.projectName ? <span className="font-mono text-xs">{status.projectName}</span> : mark(status.project)}</li>
          {status.domains && (
            <li>
              Dominios en el proyecto ({status.domains.length}):{" "}
              <span className="font-mono text-xs [overflow-wrap:anywhere]">{status.domains.join(", ") || "ninguno"}</span>
            </li>
          )}
          {status.error ? (
            <li className="text-red-600">{status.error}</li>
          ) : (
            <li className="text-green-700">Todo en orden: Marcolini registra solo el dominio de cada marca.</li>
          )}
        </ul>
      )}
    </div>
  );
}
