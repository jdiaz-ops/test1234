"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";
import { ENVIA_CO_CARRIERS } from "@/lib/envia-carriers";
import { formatDateTimeCo } from "@/lib/date-time-co";

export type EnviaConnectionView = {
  tokenLast4: string;
  sandbox: boolean;
  webhookUrl: string;
  lastWebhookAt: string | null;
  originName: string;
  originCompany: string | null;
  originPhone: string;
  originEmail: string | null;
  originStreet: string;
  originRegion: string;
  originCity: string;
  originReference: string | null;
  carrier: string | null;
  packageLengthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  packageWeightGrams: number;
  packageContent: string;
};

const DEFAULT_PACKAGE = { length: "20", width: "15", height: "10", weight: "500", content: "Cosméticos" };

/// Conexión con la cuenta de Envia.com de la marca: con ella crea la guía
/// desde el detalle del pedido. Ver envia-service.ts.
export function EnviaConnectionCard({ initial }: { initial: EnviaConnectionView | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(initial));
  const [token, setToken] = useState("");
  const [changingToken, setChangingToken] = useState(!initial);
  const [sandbox, setSandbox] = useState(initial?.sandbox ?? false);
  const [originName, setOriginName] = useState(initial?.originName ?? "");
  const [originCompany, setOriginCompany] = useState(initial?.originCompany ?? "");
  const [originPhone, setOriginPhone] = useState(initial?.originPhone ?? "");
  const [originEmail, setOriginEmail] = useState(initial?.originEmail ?? "");
  const [originStreet, setOriginStreet] = useState(initial?.originStreet ?? "");
  const [originRegion, setOriginRegion] = useState(initial?.originRegion ?? "");
  const [originCity, setOriginCity] = useState(initial?.originCity ?? "");
  const [originReference, setOriginReference] = useState(initial?.originReference ?? "");
  const [carrier, setCarrier] = useState(initial?.carrier ?? "");
  const [length, setLength] = useState(initial ? String(initial.packageLengthCm) : DEFAULT_PACKAGE.length);
  const [width, setWidth] = useState(initial ? String(initial.packageWidthCm) : DEFAULT_PACKAGE.width);
  const [height, setHeight] = useState(initial ? String(initial.packageHeightCm) : DEFAULT_PACKAGE.height);
  const [weight, setWeight] = useState(initial ? String(initial.packageWeightGrams) : DEFAULT_PACKAGE.weight);
  const [content, setContent] = useState(initial?.packageContent ?? DEFAULT_PACKAGE.content);
  const [cities, setCities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(initial ? { sandbox: initial.sandbox } : null);

  // Municipios del departamento, para sugerir la ciudad (como en el
  // checkout: la lista se carga solo cuando hace falta).
  useEffect(() => {
    let active = true;
    import("@/lib/dane").then(({ municipalitiesOf }) => {
      if (active) setCities(originRegion ? municipalitiesOf(originRegion) : []);
    });
    return () => {
      active = false;
    };
  }, [originRegion]);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/marca/tienda/conexiones/envia", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiToken: token || undefined,
        sandbox,
        originName,
        originCompany: originCompany || null,
        originPhone,
        originEmail: originEmail || null,
        originStreet,
        originRegion,
        originCity,
        originReference: originReference || null,
        carrier: carrier || null,
        packageLengthCm: Number(length),
        packageWidthCm: Number(width),
        packageHeightCm: Number(height),
        packageWeightGrams: Number(weight),
        packageContent: content,
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setMessage({ ok: false, text: body?.error ?? "No se pudo guardar. Revisa tu conexión a internet." });
      return;
    }
    setToken("");
    setChangingToken(false);
    setSaved({ sandbox });
    const carriers: string[] = body?.carriers ?? [];
    setMessage({
      ok: true,
      text: !body?.verified
        ? "Guardada. Envia no respondió para confirmar la llave: se probará cuando cotices tu primera guía."
        : carriers.length > 0
          ? `Conectada. Transportadoras de tu cuenta: ${carriers.join(", ")}.`
          : "Conectada. Ya puedes crear guías desde el detalle de cada pedido.",
    });
    router.refresh();
  }

  async function disconnect() {
    if (!window.confirm("¿Desconectar Envia? Las guías ya creadas no se anulan.")) return;
    await fetch("/api/marca/tienda/conexiones/envia", { method: "DELETE" });
    setSaved(null);
    router.refresh();
    setOpen(false);
  }

  async function copyWebhook() {
    if (!initial) return;
    await navigator.clipboard.writeText(initial.webhookUrl).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const status = !saved
    ? { label: "Sin conectar", className: "bg-brand-bg text-brand-ink-soft border border-brand-line" }
    : saved.sandbox
      ? { label: "En pruebas", className: "bg-amber-100 text-amber-800" }
      : { label: "Conectada", className: "bg-emerald-100 text-emerald-800" };

  const numberInput = (label: string, value: string, set: (v: string) => void) => (
    <div>
      <label className="block text-xs text-brand-ink mb-1">{label}</label>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
        className="input text-sm tabular-nums"
      />
    </div>
  );

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
            Envia · guías de envío
            <span className={`text-[11px] font-medium rounded-md px-1.5 py-0.5 ${status.className}`}>{status.label}</span>
          </span>
          <span className="block text-xs text-brand-ink-soft mt-0.5">
            Crea la guía desde el pedido: cotizas con tus transportadoras, el pedido queda enviado y la compradora recibe su guía.
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
        <div className="px-5 pb-5 space-y-5 border-t border-brand-line pt-4">
          <div className="space-y-3">
            <p className="text-xs text-brand-ink-soft">
              La llave (API key) la creas en tu cuenta de Envia, en la sección de desarrolladores (API Keys). Pégala aquí, nunca en un
              chat ni en un correo.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-brand-ink mb-1">Llave de Envia (API key)</label>
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
                    <button
                      type="button"
                      onClick={() => setChangingToken(true)}
                      className="text-xs font-medium text-brand-accent hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-brand-ink mb-1">Cuenta</label>
                <select
                  value={sandbox ? "pruebas" : "produccion"}
                  onChange={(e) => setSandbox(e.target.value === "pruebas")}
                  className="input text-sm"
                >
                  <option value="produccion">Producción (guías reales)</option>
                  <option value="pruebas">Pruebas (guías de prueba)</option>
                </select>
                <p className="text-xs text-brand-ink-soft mt-1">
                  {sandbox
                    ? "Usa la llave de tu cuenta de pruebas de Envia: las guías no son reales ni se cobran."
                    : "Las guías se cobran de tu saldo en Envia, como siempre."}
                </p>
              </div>
            </div>
          </div>

          <div className="sm:w-80">
            <label className="block text-xs text-brand-ink mb-1">Transportadora</label>
            <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="input text-sm">
              <option value="">Todas las de tu cuenta</option>
              {ENVIA_CO_CARRIERS.map((c) => (
                <option key={c.code} value={c.code}>
                  Solo {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-brand-ink-soft mt-1">
              {carrier ? "Al cotizar solo sale esta transportadora." : "Al cotizar ves el precio de cada una y escoges."}
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-brand-ink mb-1">Desde dónde despachas</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-brand-ink mb-1">Quién envía</label>
                <input value={originName} onChange={(e) => setOriginName(e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs text-brand-ink mb-1">Empresa (opcional)</label>
                <input value={originCompany} onChange={(e) => setOriginCompany(e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs text-brand-ink mb-1">Celular</label>
                <input
                  inputMode="tel"
                  value={originPhone}
                  onChange={(e) => setOriginPhone(e.target.value)}
                  className="input text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-ink mb-1">Correo (opcional)</label>
                <input type="email" value={originEmail} onChange={(e) => setOriginEmail(e.target.value)} className="input text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-brand-ink mb-1">Dirección</label>
                <input
                  value={originStreet}
                  onChange={(e) => setOriginStreet(e.target.value)}
                  placeholder="Calle 10 # 43-12"
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-brand-ink mb-1">Departamento</label>
                <select value={originRegion} onChange={(e) => setOriginRegion(e.target.value)} className="input text-sm">
                  <option value="">Elige uno</option>
                  {COLOMBIA_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-brand-ink mb-1">Ciudad</label>
                <input
                  value={originCity}
                  onChange={(e) => setOriginCity(e.target.value)}
                  list="envia-origin-cities"
                  className="input text-sm"
                />
                <datalist id="envia-origin-cities">
                  {cities.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-brand-ink mb-1">Referencia (opcional)</label>
                <input
                  value={originReference}
                  onChange={(e) => setOriginReference(e.target.value)}
                  placeholder="Local 2, bodega"
                  className="input text-sm"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-brand-ink mb-1">Paquete de siempre</legend>
            <p className="text-xs text-brand-ink-soft -mt-1">Sale lleno en cada guía; lo puedes cambiar ahí si un pedido es más grande.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {numberInput("Largo (cm)", length, setLength)}
              {numberInput("Ancho (cm)", width, setWidth)}
              {numberInput("Alto (cm)", height, setHeight)}
              {numberInput("Peso (gramos)", weight, setWeight)}
            </div>
            <div className="sm:w-80">
              <label className="block text-xs text-brand-ink mb-1">Qué contiene</label>
              <input value={content} onChange={(e) => setContent(e.target.value)} className="input text-sm" />
            </div>
          </fieldset>

          {initial && (
            <div className="space-y-2 rounded-xl border border-brand-line bg-brand-bg px-4 py-3">
              <p className="text-sm font-medium text-brand-ink">Avisos de entrega</p>
              <p className="text-xs text-brand-ink-soft">
                Para que el pedido pase solo a «Entregado» cuando llegue, pega este link en Envia, en la sección de desarrolladores →
                Webhooks, con el aviso de cambios de estado del envío. Sin él, Marcolini revisa las guías una vez al día.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate rounded-lg border border-brand-line bg-brand-surface px-3 py-2 text-xs">
                  {initial.webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={copyWebhook}
                  className="shrink-0 text-xs border border-brand-line rounded-full px-3 py-1.5 hover:bg-brand-accent-soft"
                >
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="text-xs text-brand-ink-soft">
                {initial.lastWebhookAt
                  ? `Último aviso de Envia: ${formatDateTimeCo(new Date(initial.lastWebhookAt))}.`
                  : "Todavía no ha llegado ningún aviso de Envia."}
              </p>
            </div>
          )}

          {message && <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving || (changingToken && !token)}
              className="bg-brand-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Probando la llave..." : initial ? "Guardar" : "Conectar"}
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
