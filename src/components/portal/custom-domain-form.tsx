"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CustomDomainForm({
  initialDomain,
  initialToken,
  initialVerified,
}: {
  initialDomain: string | null;
  initialToken: string | null;
  initialVerified: boolean;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [savedDomain, setSavedDomain] = useState(initialDomain);
  const [token, setToken] = useState(initialToken);
  const [verified, setVerified] = useState(initialVerified);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/dominio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setSavedDomain(body.domain);
      setToken(body.verificationToken);
      setVerified(false);
    } catch {
      setError("No se pudo guardar — revisa tu conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/marca/tienda/dominio/verificar", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "No se pudo verificar.");
        return;
      }
      setVerified(true);
    } catch {
      setError("No se pudo verificar — revisa tu conexión.");
    } finally {
      setVerifying(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError(null);
    try {
      await fetch("/api/marca/tienda/dominio", { method: "DELETE" });
      setSavedDomain(null);
      setToken(null);
      setVerified(false);
      setDomain("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface p-5 mt-6">
      <p className="text-sm font-medium text-brand-ink mb-1">
        Dominio propio (opcional, gratis)
      </p>
      <p className="text-xs text-brand-ink-soft mb-4 max-w-lg">
        Usa tu propio dominio en vez de {"{tu-tienda}"}.marcolini.lat — ej.
        tienda.tumarca.com. Primero verificamos que es tuyo, después apuntas
        el DNS.
      </p>

      {!savedDomain ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-brand-ink mb-1">
              Tu dominio
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="tienda.tumarca.com"
              className="input text-sm w-64"
            />
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || !domain.trim()}
            className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar dominio"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-brand-ink">{savedDomain}</span>
            {verified ? (
              <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-brand-accent-soft text-brand-accent">
                VERIFICADO
              </span>
            ) : (
              <span className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">
                SIN VERIFICAR
              </span>
            )}
          </div>

          {!verified && token && (
            <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-ink-soft space-y-2">
              <p>
                Agrega este registro TXT en el DNS de{" "}
                <span className="font-mono text-brand-ink">{savedDomain}</span>:
              </p>
              <div className="font-mono text-brand-ink bg-white rounded-lg p-2 border border-brand-line overflow-x-auto">
                <p>Nombre: _marcolini-verify.{savedDomain}</p>
                <p>Tipo: TXT</p>
                <p>Valor: {token}</p>
              </div>
              <p>
                Puede tardar unos minutos en propagar. Cuando lo hayas
                agregado, dale a &ldquo;Verificar&rdquo;.
              </p>
              <button
                type="button"
                onClick={verify}
                disabled={verifying}
                className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {verifying ? "Verificando..." : "Verificar"}
              </button>
            </div>
          )}

          {verified && (
            <p className="text-xs text-brand-ink-soft">
              Ahora apunta el DNS de {savedDomain} a Marcolini (registro CNAME
              — te lo confirma el equipo de Marcolini con el valor exacto)
              para que el tráfico real empiece a llegar ahí.
            </p>
          )}

          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            Quitar dominio
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
