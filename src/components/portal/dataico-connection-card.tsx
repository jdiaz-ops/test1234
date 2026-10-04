"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type DataicoConnectionView = {
  accountId: string;
  tokenLast4: string;
  env: "PRUEBAS" | "PRODUCCION";
  prefix: string | null;
  resolutionNumber: string | null;
  nextNumber: number | null;
  sendEmail: boolean;
  enabled: boolean;
};

type Numbering = {
  prefix: string;
  resolutions: { number: string | null; start: number | null; end: number | null; endDate: string | null }[];
};

/// Conexión directa con la API de Dataico: cada venta pagada se factura
/// sola ante la DIAN, con el documento que el comprador da en el checkout
/// (obligatorio desde el 2026-10-04). Ver dataico-service.ts.
export function DataicoConnectionCard({
  initial,
  hasDataicoWebhook,
}: {
  initial: DataicoConnectionView | null;
  hasDataicoWebhook: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initial));
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [token, setToken] = useState("");
  const [changingToken, setChangingToken] = useState(!initial);
  const [env, setEnv] = useState<"PRUEBAS" | "PRODUCCION">(initial?.env ?? "PRUEBAS");
  const [prefix, setPrefix] = useState(initial?.prefix ?? "");
  const [resolutionNumber, setResolutionNumber] = useState(initial?.resolutionNumber ?? "");
  const [nextNumber, setNextNumber] = useState(initial?.nextNumber ? String(initial.nextNumber) : "");
  const [sendEmail, setSendEmail] = useState(initial?.sendEmail ?? true);
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [numberings, setNumberings] = useState<Numbering[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Lo último guardado — de acá sale la etiqueta de estado, para que pase
  // de "Pausada" a "Facturando" apenas se guarda, sin esperar a que la
  // página se recargue (antes se quedaba en "Pausada").
  const [savedState, setSavedState] = useState(initial ? { enabled: initial.enabled, env: initial.env } : null);

  async function testConnection() {
    setTesting(true);
    setMessage(null);
    const res = await fetch("/api/marca/tienda/conexiones/dataico/numeraciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authToken: token || undefined }),
    });
    const body = await res.json().catch(() => null);
    setTesting(false);
    if (!res.ok) {
      setMessage({ ok: false, text: body?.error ?? "No se pudo conectar con Dataico." });
      return;
    }
    const list = (body.numberings ?? []) as Numbering[];
    setNumberings(list);
    setMessage(
      list.length > 0
        ? { ok: true, text: "Conexión correcta. Elige la numeración con la que vas a facturar." }
        : { ok: false, text: "La conexión funciona, pero tu cuenta de Dataico no tiene numeraciones de factura." },
    );
  }

  function pickNumbering(value: string) {
    const [p, res] = value.split("|");
    setPrefix(p);
    const resolution = numberings?.find((n) => n.prefix === p)?.resolutions.find((r) => (r.number ?? "") === res);
    setResolutionNumber(resolution?.number ?? "");
    if (!nextNumber && resolution?.start) setNextNumber(String(resolution.start));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/marca/tienda/conexiones/dataico", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        authToken: token || undefined,
        env,
        prefix: prefix || null,
        resolutionNumber: resolutionNumber || null,
        nextNumber: nextNumber ? Number(nextNumber) : null,
        sendEmail,
        enabled,
      }),
    });
    const body = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setMessage({ ok: false, text: body?.error ?? "No se pudo guardar." });
      return;
    }
    setToken("");
    setChangingToken(false);
    setSavedState({ enabled, env });
    setMessage({ ok: true, text: enabled ? "Guardado. Las próximas ventas pagadas se facturan solas." : "Guardado." });
    router.refresh();
  }

  async function disconnect() {
    if (!window.confirm("¿Desconectar Dataico? Las ventas dejan de facturarse solas.")) return;
    await fetch("/api/marca/tienda/conexiones/dataico", { method: "DELETE" });
    setSavedState(null);
    router.refresh();
    setOpen(false);
  }

  const status = !savedState
    ? { label: "Sin conectar", className: "bg-brand-bg text-brand-ink-soft border border-brand-line" }
    : savedState.enabled
      ? savedState.env === "PRODUCCION"
        ? { label: "Facturando", className: "bg-emerald-100 text-emerald-800" }
        : { label: "En pruebas", className: "bg-amber-100 text-amber-800" }
      : { label: "Pausada", className: "bg-brand-bg text-brand-ink-soft border border-brand-line" };

  const selectedNumbering = prefix ? `${prefix}|${resolutionNumber}` : "";

  return (
    <section className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="flex items-center gap-2 text-sm font-medium text-brand-ink">
            Dataico · facturación electrónica
            <span className={`text-[11px] font-medium rounded-md px-1.5 py-0.5 ${status.className}`}>{status.label}</span>
          </span>
          <span className="block text-xs text-brand-ink-soft mt-0.5">
            Conexión directa: cada venta pagada se factura sola ante la DIAN, con el documento del comprador.
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-brand-ink-soft shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-brand-line pt-4">
          {hasDataicoWebhook && (
            <p className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
              Tienes también un webhook hacia Dataico. Usa solo una de las dos: si activas esta conexión, elimina ese
              webhook o cada venta se facturará dos veces.
            </p>
          )}

          <p className="text-xs text-brand-ink-soft">
            Encuentras el Account ID y el Auth Token en Dataico, en la configuración de tu empresa.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-brand-ink mb-1">Dataico Account ID</label>
              <input
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                spellCheck={false}
                className="input text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">Auth Token</label>
              {changingToken ? (
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="input text-sm font-mono"
                />
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-bg px-3 py-2.5">
                  <span className="font-mono text-sm text-brand-ink flex-1">••••••••{initial?.tokenLast4}</span>
                  <button type="button" onClick={() => setChangingToken(true)} className="text-xs font-medium text-brand-accent hover:underline">
                    Cambiar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || (changingToken && !token)}
              className="text-sm border border-brand-line rounded-full px-4 py-2 hover:bg-brand-accent-soft disabled:opacity-50"
            >
              {testing ? "Probando..." : "Probar conexión"}
            </button>
            <span className="text-xs text-brand-ink-soft">Trae tus numeraciones de factura de Dataico.</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-brand-ink mb-1">Numeración</label>
              {numberings && numberings.length > 0 ? (
                <select value={selectedNumbering} onChange={(e) => pickNumbering(e.target.value)} className="input text-sm">
                  <option value="">Elige una</option>
                  {numberings.flatMap((n) =>
                    (n.resolutions.length > 0 ? n.resolutions : [{ number: null, start: null, end: null, endDate: null }]).map((r) => (
                      <option key={`${n.prefix}|${r.number ?? ""}`} value={`${n.prefix}|${r.number ?? ""}`}>
                        {n.prefix}
                        {r.start != null && r.end != null ? ` ${r.start} – ${r.end}` : ""}
                        {r.number ? ` · resolución ${r.number}` : ""}
                      </option>
                    )),
                  )}
                </select>
              ) : (
                <p className="text-sm text-brand-ink rounded-xl border border-brand-line bg-brand-bg px-3 py-2.5">
                  {prefix ? `${prefix}${resolutionNumber ? ` · resolución ${resolutionNumber}` : ""}` : "Toca Probar conexión para elegirla"}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-brand-ink mb-1">Siguiente número</label>
              <input
                inputMode="numeric"
                value={nextNumber}
                onChange={(e) => setNextNumber(e.target.value.replace(/\D/g, ""))}
                className="input text-sm tabular-nums"
              />
            </div>
          </div>
          <p className="text-xs text-brand-ink-soft -mt-2">
            Revisa en Dataico el último número que usaste con esa numeración y pon el siguiente. Marcolini sigue contando desde ahí.
          </p>

          <div>
            <label className="block text-xs text-brand-ink mb-1">Ambiente</label>
            <select value={env} onChange={(e) => setEnv(e.target.value as "PRUEBAS" | "PRODUCCION")} className="input text-sm sm:w-80">
              <option value="PRUEBAS">Pruebas (no son facturas reales)</option>
              <option value="PRODUCCION">Producción (facturas reales ante la DIAN)</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-brand-ink cursor-pointer">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="w-4 h-4" />
            Que Dataico le envíe la factura al comprador por correo
          </label>
          <label className="flex items-center gap-2.5 text-sm text-brand-ink cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4" />
            Facturar automáticamente cada venta pagada
          </label>
          <p className="text-xs text-brand-ink-soft -mt-2">
            Los pedidos hechos en modo de prueba de Wompi solo se facturan en el ambiente de pruebas. Las devoluciones (notas
            crédito) se hacen por ahora desde Dataico.
          </p>

          {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
            {initial && (
              <button type="button" onClick={disconnect} className="text-sm text-red-600 hover:underline ml-auto">
                Desconectar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
