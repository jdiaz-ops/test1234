"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string };

/// Lo que devuelve /api/marca/tienda/dominio/estado (ver
/// custom-domain-service.ts): si Marcolini ya registró el dominio en
/// Vercel, si el DNS ya apunta y qué registros poner.
type DomainStatus = {
  domain: string | null;
  verified: boolean;
  vercel: {
    automatic: boolean;
    registered: boolean;
    verification: DnsRecord[];
    configured: boolean;
    records: DnsRecord[];
    error: string | null;
  };
};

/// null cuando no se pudo consultar.
async function fetchStatus(): Promise<DomainStatus | null> {
  try {
    const res = await fetch("/api/marca/tienda/dominio/estado", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DomainStatus;
  } catch {
    return null;
  }
}

function Records({ records }: { records: DnsRecord[] }) {
  return (
    <div className="font-mono text-brand-ink bg-white rounded-lg p-2 border border-brand-line overflow-x-auto space-y-1">
      {records.map((r) => (
        <div key={`${r.type}-${r.name}-${r.value}`}>
          <p>Tipo: {r.type}</p>
          <p>Nombre: {r.name}</p>
          <p>Valor: {r.value}</p>
        </div>
      ))}
    </div>
  );
}

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
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /// Después de verificar, el estado de la conexión (Vercel y DNS).
  useEffect(() => {
    if (!verified || !savedDomain) return;
    let cancelled = false;
    void fetchStatus().then((next) => {
      if (cancelled) return;
      if (next) setStatus(next);
      else setStatusFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [verified, savedDomain]);

  async function recheck() {
    setChecking(true);
    const next = await fetchStatus();
    if (next) {
      setStatus(next);
      setStatusFailed(false);
    } else {
      setStatusFailed(true);
    }
    setChecking(false);
  }

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
      setStatus(null);
      setStatusFailed(false);
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
      setStatus(null);
      setStatusFailed(false);
      setDomain("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const vercel = status?.vercel ?? null;

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
          <div className="flex items-center gap-2 flex-wrap">
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
            {verified && vercel && vercel.automatic && (
              <span
                className={`text-[10px] font-mono font-medium rounded-full px-2 py-0.5 ${
                  vercel.configured ? "bg-brand-accent-soft text-brand-accent" : "bg-amber-100 text-amber-700"
                }`}
              >
                {vercel.configured ? "CONECTADO" : vercel.registered ? "FALTA EL DNS" : "SIN REGISTRAR"}
              </span>
            )}
          </div>

          {!verified && token && (
            <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-ink-soft space-y-2">
              <p>
                Agrega este registro TXT en el DNS de{" "}
                <span className="font-mono text-brand-ink">{savedDomain}</span>:
              </p>
              <Records records={[{ type: "TXT", name: `_marcolini-verify.${savedDomain}`, value: token }]} />
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
            <div className="rounded-xl bg-brand-bg p-3 text-xs text-brand-ink-soft space-y-2">
              {!vercel ? (
                <p>{statusFailed && !checking ? "No pudimos revisar la conexión. Intenta de nuevo." : "Revisando la conexión…"}</p>
              ) : (
                <>
                  <p>
                    {vercel.automatic
                      ? vercel.registered
                        ? "Tu dominio ya quedó registrado en Marcolini. "
                        : vercel.error
                          ? `No se pudo registrar el dominio en Marcolini (${vercel.error}). El equipo de Marcolini lo termina a mano. `
                          : "Tu dominio todavía no está registrado en Marcolini; el equipo lo termina a mano. "
                      : "El equipo de Marcolini termina el registro del dominio. "}
                    Para que el tráfico llegue a tu tienda, pon este registro en el DNS de{" "}
                    <span className="font-mono text-brand-ink">{savedDomain}</span>:
                  </p>
                  <Records records={vercel.records} />
                  {vercel.verification.length > 0 && (
                    <>
                      <p>
                        Ese dominio estuvo en otra cuenta de Vercel, así que también pide este registro TXT:
                      </p>
                      <Records records={vercel.verification} />
                    </>
                  )}
                  {vercel.automatic && (
                    <p>
                      {vercel.configured
                        ? "El DNS ya apunta a Marcolini: tu tienda responde en tu dominio."
                        : "El DNS puede tardar hasta un día en propagarse. Cuando lo hayas cambiado, revisa de nuevo."}
                    </p>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={recheck}
                disabled={checking}
                className="bg-brand-accent text-white rounded-full px-4 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {checking ? "Revisando..." : "Revisar conexión"}
              </button>
            </div>
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
