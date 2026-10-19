"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAYMENT_PROVIDERS,
  PAYU_SANDBOX_CREDENTIALS,
  requiredCredentialFields,
  type CredentialField,
  type CredentialScope,
  type PaymentModeId,
  type PaymentProviderId,
} from "@/lib/payment-providers";

type Status = "NOT_CONNECTED" | "ACTIVE" | "TEST" | "INCOMPLETE";

/// Columnas del selector según cuántas pasarelas se ofrecen.
const GRID_COLS: Record<number, string> = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" };
type Secret = { saved: boolean; last4: string };
/// Lo guardado de un juego de llaves, como lo manda la página: las
/// públicas completas, las secretas enmascaradas.
type SavedSet = Record<string, string | Secret>;

export type ProviderInitial = {
  status: Status;
  credentials: Partial<Record<CredentialScope, SavedSet>>;
  webhookUrl: string | null;
};

export type StorePaymentInitial = {
  activeProvider: PaymentProviderId | null;
  paymentMode: PaymentModeId;
  providers: Record<PaymentProviderId, ProviderInitial>;
  /// Las que se muestran para elegir (ver offeredPaymentProviders).
  offered: PaymentProviderId[];
};

const STATUS_CHIP: Record<Status, { label: string; className: string }> = {
  ACTIVE: { label: "Activa", className: "bg-emerald-100 text-emerald-800" },
  TEST: { label: "Modo de prueba", className: "bg-amber-100 text-amber-800" },
  INCOMPLETE: { label: "Faltan llaves", className: "bg-red-100 text-red-700" },
  NOT_CONNECTED: { label: "Sin conectar", className: "bg-brand-bg text-brand-ink-soft border border-brand-line" },
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-brand-line bg-brand-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent ${
        checked ? "bg-brand-ink" : "bg-brand-line"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function PrefixWarning({ value, prefix }: { value: string; prefix?: string }) {
  if (!prefix || !value.trim() || value.trim().startsWith(prefix)) return null;
  return (
    <p className="text-xs text-amber-700 mt-1">
      Esta llave normalmente empieza por <span className="font-mono">{prefix}</span>. Revisa que la hayas copiado del
      lugar correcto.
    </p>
  );
}

/// Llave pública: no es secreta, se muestra completa y se edita directo.
function PublicKeyField({
  label,
  value,
  prefix,
  help,
  onChange,
}: {
  label: string;
  value: string;
  prefix?: string;
  help?: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-brand-ink mb-1">{label}</label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={prefix ? `${prefix}...` : ""}
        spellCheck={false}
        // Que el navegador no meta acá el correo de la cuenta (lo hacía con
        // la llave pública y el P_CUST_ID_CLIENTE, 2026-10-19).
        name={`llave-${id}`}
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        className="input font-mono text-sm"
      />
      <PrefixWarning value={value} prefix={prefix} />
      {help && <p className="text-xs text-brand-ink-soft mt-1">{help}</p>}
    </div>
  );
}

/// Llave secreta: si ya está guardada se muestra enmascarada (nunca viaja
/// completa al navegador) con "Cambiar"; solo se manda al guardar si la
/// marca escribió una nueva.
function SecretKeyField({
  label,
  saved,
  prefix,
  help,
  value,
  onChange,
}: {
  label: string;
  saved: Secret;
  prefix?: string;
  help?: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const editing = value !== undefined || !saved.saved;
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-brand-ink mb-1">{label}</label>
      {editing ? (
        <>
          <div className="flex items-center gap-2">
            <input
              id={id}
              type={visible ? "text" : "password"}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={prefix ? `${prefix}...` : ""}
              // "new-password": el navegador no llena acá la contraseña
              // guardada de Marcolini (con "off" la llenaba igual).
              name={`llave-secreta-${id}`}
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              spellCheck={false}
              className="input font-mono text-sm flex-1"
            />
            <button type="button" onClick={() => setVisible((v) => !v)} className="text-xs text-brand-ink-soft hover:text-brand-ink shrink-0">
              {visible ? "Ocultar" : "Mostrar"}
            </button>
            {saved.saved && (
              <button type="button" onClick={() => onChange(undefined)} className="text-xs text-brand-ink-soft hover:text-brand-ink shrink-0">
                Cancelar
              </button>
            )}
          </div>
          <PrefixWarning value={value ?? ""} prefix={prefix} />
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-bg px-3 py-2.5">
          <span className="font-mono text-sm text-brand-ink flex-1 tracking-wider">••••••••{saved.last4}</span>
          <span className="text-xs text-emerald-700">Guardada</span>
          <button type="button" onClick={() => onChange("")} className="text-xs font-medium text-brand-accent hover:underline">
            Cambiar
          </button>
        </div>
      )}
      {help && <p className="text-xs text-brand-ink-soft mt-1">{help}</p>}
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copia la URL:", value);
    }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-brand-line bg-brand-bg px-3 py-2.5">
      <span className="font-mono text-xs sm:text-sm text-brand-ink truncate flex-1">{value}</span>
      <button type="button" onClick={copy} className="text-xs font-medium text-brand-accent hover:underline shrink-0">
        {copied ? "Copiada ✓" : "Copiar"}
      </button>
    </div>
  );
}

/// Lo que la marca escribió en un juego de llaves: las públicas siempre
/// tienen valor (arrancan con lo guardado); las secretas undefined hasta
/// que toca "Cambiar" o escribe algo.
type Edits = Record<string, string | undefined>;

function initialEdits(fields: CredentialField[], saved: SavedSet | undefined): Edits {
  const edits: Edits = {};
  for (const f of fields) {
    if (!f.secret) edits[f.key] = typeof saved?.[f.key] === "string" ? (saved[f.key] as string) : "";
  }
  return edits;
}

/// Los pasos cortos de cada pasarela (ver PaymentProviderSpec.steps), en
/// un recuadro para que no se pierdan. «{guardar}» es el botón de guardar
/// de donde se muestran.
function ProviderSteps({ steps, saveLabel }: { steps: string[]; saveLabel: string }) {
  return (
    <div className="rounded-lg border border-brand-line px-3 py-2.5">
      <p className="mb-1 text-xs font-medium text-brand-ink">Paso a paso</p>
      <ol className="list-decimal space-y-1 pl-4 text-xs leading-relaxed text-brand-ink">
        {steps.map((step) => (
          <li key={step}>{step.replace("{guardar}", saveLabel)}</li>
        ))}
      </ol>
    </div>
  );
}

function KeysSection({
  provider,
  mode,
  saved,
  edits,
  onChange,
  compact = false,
}: {
  provider: PaymentProviderId;
  mode: PaymentModeId;
  saved: SavedSet | undefined;
  edits: Edits;
  onChange: (key: string, value: string | undefined) => void;
  /// En el Dashboard: en dos columnas y sin las ayudas de cada campo.
  compact?: boolean;
}) {
  const spec = PAYMENT_PROVIDERS[provider];
  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2" : "space-y-4"}>
      {spec.fields.map((field) => {
        const prefix = field.prefix?.[mode];
        const label = field.optional ? `${field.label} (opcional)` : field.label;
        if (!field.secret) {
          return (
            <PublicKeyField
              key={field.key}
              label={label}
              value={edits[field.key] ?? ""}
              prefix={prefix}
              help={compact ? undefined : field.help}
              onChange={(v) => onChange(field.key, v)}
            />
          );
        }
        const savedValue = saved?.[field.key];
        const secret: Secret = savedValue && typeof savedValue === "object" ? savedValue : { saved: false, last4: "" };
        return (
          <SecretKeyField
            key={field.key}
            label={label}
            saved={secret}
            prefix={prefix}
            help={compact ? undefined : field.help}
            value={edits[field.key]}
            onChange={(v) => onChange(field.key, v)}
          />
        );
      })}
    </div>
  );
}

/// Pagos: la marca elige con qué pasarela cobra (su propia cuenta: hoy se
/// ofrecen Wompi, Mercado Pago y ePayco — ver OFFERED_PAYMENT_PROVIDER_IDS
/// en payment-providers.ts), ve el estado y los medios de pago,
/// prende el modo de prueba y pega sus llaves — las secretas enmascaradas.
/// Antes solo existía Wompi ("no puedo obligar a que abra Wompi"). Ver
/// conversación del 2026-10-18.
export function StorePaymentForm({
  initial,
  compact = false,
}: {
  initial: StorePaymentInitial;
  /// Dentro del paso "Conecta tus pagos" del Dashboard (ver go-live-card):
  /// solo la pasarela, un juego de llaves y la URL de avisos — lo que hace
  /// falta para cobrar de verdad ("¿esto tiene que ser así de largo?",
  /// 2026-10-19). Arranca en las de producción; el modo de prueba se abre
  /// ahí mismo.
  compact?: boolean;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<PaymentProviderId>(initial.activeProvider ?? initial.offered[0] ?? "WOMPI");
  const [testMode, setTestMode] = useState(compact ? false : initial.paymentMode === "TEST");
  const spec = PAYMENT_PROVIDERS[provider];
  const current = initial.providers[provider];
  const scopes: CredentialScope[] = spec.scopes === "SHARED" ? ["SHARED"] : ["TEST", "PRODUCTION"];

  const [edits, setEdits] = useState<Partial<Record<CredentialScope, Edits>>>(() => ({
    TEST: initialEdits(spec.fields, current.credentials.TEST),
    PRODUCTION: initialEdits(spec.fields, current.credentials.PRODUCTION),
    SHARED: initialEdits(spec.fields, current.credentials.SHARED),
  }));
  const [aboutOpen, setAboutOpen] = useState(current.status === "NOT_CONNECTED");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function choose(id: PaymentProviderId) {
    if (id === provider) return;
    const s = PAYMENT_PROVIDERS[id];
    const c = initial.providers[id];
    setProvider(id);
    setEdits({
      TEST: initialEdits(s.fields, c.credentials.TEST),
      PRODUCTION: initialEdits(s.fields, c.credentials.PRODUCTION),
      SHARED: initialEdits(s.fields, c.credentials.SHARED),
    });
    setAboutOpen(c.status === "NOT_CONNECTED");
    setSaved(false);
    setError(null);
  }

  function setField(scope: CredentialScope, key: string, value: string | undefined) {
    setSaved(false);
    setEdits((prev) => {
      const next = { ...(prev[scope] ?? {}) };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return { ...prev, [scope]: next };
    });
  }

  function scopeDirty(scope: CredentialScope) {
    const e = edits[scope] ?? {};
    const s = current.credentials[scope];
    return spec.fields.some((f) => {
      const v = e[f.key];
      if (f.secret) return Boolean(v);
      return (v ?? "") !== (typeof s?.[f.key] === "string" ? (s[f.key] as string) : "");
    });
  }

  const dirty =
    provider !== initial.activeProvider ||
    testMode !== (initial.paymentMode === "TEST") ||
    scopes.some(scopeDirty);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const credentials: Partial<Record<CredentialScope, Record<string, string>>> = {};
    for (const scope of scopes) {
      const set: Record<string, string> = {};
      const e = edits[scope] ?? {};
      for (const f of spec.fields) {
        const v = e[f.key];
        if (f.secret) {
          // Una llave en "Cambiar" que quedó vacía no borra la guardada.
          if (v) set[f.key] = v;
        } else if (v !== undefined) {
          set[f.key] = v;
        }
      }
      credentials[scope] = set;
    }
    try {
      const res = await fetch("/api/marca/tienda/pagos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, paymentMode: testMode ? "TEST" : "PRODUCTION", credentials }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      // Las secretas ya quedaron guardadas: se limpian de la pantalla (el
      // servidor las vuelve a mandar enmascaradas al refrescar).
      setEdits((prev) => {
        const next: typeof prev = {};
        for (const scope of Object.keys(prev) as CredentialScope[]) {
          const clean: Edits = {};
          for (const f of spec.fields) if (!f.secret && prev[scope]?.[f.key] !== undefined) clean[f.key] = prev[scope]![f.key];
          next[scope] = clean;
        }
        return next;
      });
      setSaved(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar — revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const isActive = provider === initial.activeProvider;
  const chip = STATUS_CHIP[isActive ? current.status : current.status === "NOT_CONNECTED" ? "NOT_CONNECTED" : "INCOMPLETE"];
  const chipLabel = isActive ? chip.label : current.status === "NOT_CONNECTED" ? "Sin conectar" : "Con llaves, no activa";
  const activeName = initial.activeProvider ? PAYMENT_PROVIDERS[initial.activeProvider].name : null;

  function fillPayuSandbox() {
    setSaved(false);
    setEdits((prev) => ({ ...prev, TEST: { ...(prev.TEST ?? {}), ...PAYU_SANDBOX_CREDENTIALS } }));
  }

  if (compact) {
    // "¿Quieres probar antes?" cambia ahí mismo a las llaves de prueba, sin
    // ir a otra página (pedido del 2026-10-19). Con una sola tanda de
    // llaves (ePayco) son las mismas: solo cambia el modo.
    const keysScope: CredentialScope = spec.scopes === "SHARED" ? "SHARED" : testMode ? "TEST" : "PRODUCTION";
    const keysTitle =
      spec.scopes === "SHARED" ? `Llaves de ${spec.name}` : testMode ? `Llaves de prueba de ${spec.name}` : `Llaves de producción de ${spec.name}`;
    // Sin el juego completo la tienda quedaría en prueba sin poder probar
    // (el servidor solo exige las de producción). Las secretas guardadas
    // cuentan aunque no estén en pantalla.
    const missing = requiredCredentialFields(provider).filter((f) => {
      if (edits[keysScope]?.[f.key]?.trim()) return false;
      const s = current.credentials[keysScope]?.[f.key];
      return !(f.secret && typeof s === "object" && s.saved);
    });
    function saveCompact() {
      if (missing.length > 0) {
        const names = missing.map((f) => f.label);
        const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
        setError(`Te falta: ${list}.`);
        return;
      }
      void handleSave();
    }
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs text-brand-ink">Tu pasarela</p>
          <div className={`grid grid-cols-2 gap-2 ${GRID_COLS[initial.offered.length] ?? "sm:grid-cols-5"}`}>
            {initial.offered.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                aria-pressed={id === provider}
                className={`rounded-xl border bg-brand-surface px-3 py-2 text-sm font-medium transition-colors ${
                  id === provider ? "border-brand-ink text-brand-ink" : "border-brand-line text-brand-ink-soft hover:text-brand-ink"
                }`}
              >
                {PAYMENT_PROVIDERS[id].name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-brand-line bg-brand-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-brand-ink">{keysTitle}</p>
            <a href={spec.signupUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-accent hover:underline">
              ¿No tienes cuenta? Créala →
            </a>
          </div>
          {spec.steps ? (
            <ProviderSteps steps={spec.steps[testMode ? "TEST" : "PRODUCTION"]} saveLabel={testMode ? "Guardar y probar" : "Guardar y empezar a cobrar"} />
          ) : (
            <p className="-mt-1 text-xs text-brand-ink-soft">{testMode ? spec.testHint : spec.keysHint}</p>
          )}
          <KeysSection
            provider={provider}
            mode={testMode ? "TEST" : "PRODUCTION"}
            saved={current.credentials[keysScope]}
            edits={edits[keysScope] ?? {}}
            onChange={(key, v) => setField(keysScope, key, v)}
            compact
          />
          {spec.webhook && current.webhookUrl && (
            <div>
              <p className="mb-1 text-xs text-brand-ink">{spec.steps ? (spec.webhook.optional ? "Tu URL de avisos (opcional)" : "Tu URL de avisos") : `Pega esta URL en ${spec.webhook.where}`}</p>
              <CopyField value={current.webhookUrl} />
            </div>
          )}
        </div>

        {!isActive && activeName && (
          <p className="text-xs text-amber-700">
            Al guardar, tu tienda pasa a cobrar con {spec.name} en vez de {activeName}.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && !dirty && (
          <p className="text-sm text-emerald-700">
            {testMode ? "Guardado: tu tienda quedó en modo de prueba. Cuando termines de probar, toca «Mejor cobrar de verdad»." : "Guardado."}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={saveCompact}
            disabled={saving || !dirty}
            className="rounded-full bg-brand-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Guardando…" : testMode ? "Guardar y probar" : "Guardar y empezar a cobrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setError(null);
              setTestMode((v) => !v);
            }}
            className="text-xs text-brand-ink-soft hover:text-brand-ink hover:underline"
          >
            {testMode ? "Mejor cobrar de verdad" : "¿Quieres probar antes? Usa el modo de prueba"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="font-display text-xl font-semibold text-brand-ink">Pagos</h2>
        <p className="text-sm text-brand-ink-soft mt-1">
          Cobras con tu propia cuenta: el dinero llega directo a ti, Marcolini nunca lo recibe.
          {activeName ? ` Hoy tu tienda cobra con ${activeName}.` : " Elige tu pasarela y pega sus llaves para empezar a cobrar."}
        </p>
      </div>

      <Card>
        <p className="text-sm font-medium text-brand-ink mb-3">¿Con qué pasarela cobras?</p>
        <div className={`grid grid-cols-2 gap-2 ${GRID_COLS[initial.offered.length] ?? "sm:grid-cols-5"}`}>
          {initial.offered.map((id) => {
            const st = initial.providers[id].status;
            const selected = id === provider;
            const live = id === initial.activeProvider;
            return (
              <button
                key={id}
                type="button"
                onClick={() => choose(id)}
                aria-pressed={selected}
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                  selected ? "border-brand-ink bg-brand-bg" : "border-brand-line hover:bg-brand-accent-soft/40"
                }`}
              >
                <span className="block text-sm font-semibold text-brand-ink">{PAYMENT_PROVIDERS[id].name}</span>
                <span className={`block text-[11px] mt-0.5 ${live ? "text-emerald-700" : "text-brand-ink-soft"}`}>
                  {live ? (st === "ACTIVE" ? "Activa" : st === "TEST" ? "En prueba" : "Faltan llaves") : st === "NOT_CONNECTED" ? "Sin conectar" : "Con llaves"}
                </span>
              </button>
            );
          })}
        </div>
        {!isActive && (
          <p className="text-xs text-amber-700 mt-3">
            Al guardar, tu tienda pasa a cobrar con {spec.name}
            {activeName ? ` en vez de ${activeName}` : ""}. Las llaves de las demás pasarelas se conservan.
          </p>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <h3 className="font-display text-lg font-semibold text-brand-ink">{spec.name}</h3>
        <span className={`text-xs font-medium rounded-md px-2 py-0.5 ${chip.className}`}>{chipLabel}</span>
      </div>
      <p className="text-sm text-brand-ink-soft -mt-2">
        {isActive && current.status === "ACTIVE" && `Tu tienda está cobrando de verdad. El dinero llega directo a tu cuenta de ${spec.name}.`}
        {isActive && current.status === "TEST" && "Tu tienda está en modo de prueba: puedes hacer compras de ensayo, pero no se cobra de verdad."}
        {isActive && current.status === "INCOMPLETE" && "Tu tienda todavía no puede cobrar: faltan llaves para el modo que tienes activo."}
        {(!isActive || current.status === "NOT_CONNECTED") &&
          (current.status === "NOT_CONNECTED"
            ? `Conecta tu cuenta de ${spec.name} para cobrar con ella.`
            : `Tienes llaves de ${spec.name} guardadas. Guarda para que tu tienda cobre con ella.`)}
      </p>

      <Card className="!p-0">
        <button
          type="button"
          onClick={() => setAboutOpen((o) => !o)}
          aria-expanded={aboutOpen}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span className="text-sm font-medium text-brand-ink">Acerca de {spec.name}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-brand-ink-soft transition-transform ${aboutOpen ? "rotate-180" : ""}`} aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {aboutOpen && (
          <div className="px-5 pb-5 -mt-1 space-y-2 text-sm text-brand-ink-soft">
            <p>{spec.about}</p>
            <p>
              ¿Aún no tienes cuenta?{" "}
              <a href={spec.signupUrl} target="_blank" rel="noopener noreferrer" className="text-brand-accent font-medium hover:underline">
                Créala en {spec.name} →
              </a>
            </p>
          </div>
        )}
      </Card>

      {spec.steps && (
        <Card>
          <p className="mb-2 text-xs text-brand-ink-soft">{testMode ? "Para probar sin cobrar de verdad:" : "Para cobrar de verdad:"}</p>
          <ProviderSteps steps={spec.steps[testMode ? "TEST" : "PRODUCTION"]} saveLabel="Guardar" />
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <p className="text-sm font-medium text-brand-ink">Métodos de pago</p>
          <p className="text-xs text-brand-ink-soft mt-0.5">
            Tus clientes ven los que tengas activos en tu cuenta de {spec.name}. Se prenden y apagan desde su panel.
          </p>
        </div>
        <ul className="divide-y divide-brand-line border-t border-brand-line">
          {spec.methods.map((m) => (
            <li key={m.name} className="flex items-center gap-3 px-5 py-3">
              <span className={`w-10 h-7 rounded-md flex items-center justify-center text-[10px] font-bold tracking-wide shrink-0 ${m.markClass}`} aria-hidden="true">
                {m.mark}
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-brand-ink">{m.name}</span>
                <span className="block text-xs text-brand-ink-soft">{m.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-ink">Modo de prueba</p>
            <p className="text-xs text-brand-ink-soft mt-0.5">
              Mira cómo funcionan los pagos y los pedidos en tu tienda sin cobrar de verdad. Apágalo cuando quieras
              empezar a vender.
            </p>
            <p className="text-xs text-brand-ink-soft mt-1">{spec.testHint}</p>
          </div>
          <Switch
            checked={testMode}
            onChange={(v) => {
              setSaved(false);
              setTestMode(v);
            }}
            label="Modo de prueba"
          />
        </div>
        {testMode && spec.scopes === "PER_MODE" && (
          <div className="mt-5 pt-5 border-t border-brand-line">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-medium text-brand-ink">Llaves de prueba</p>
              {provider === "PAYU" && (
                <button type="button" onClick={fillPayuSandbox} className="text-xs font-medium text-brand-accent hover:underline">
                  Usar las credenciales de prueba de PayU
                </button>
              )}
            </div>
            <KeysSection
              provider={provider}
              mode="TEST"
              saved={current.credentials.TEST}
              edits={edits.TEST ?? {}}
              onChange={(key, v) => setField("TEST", key, v)}
            />
          </div>
        )}
      </Card>

      <Card>
        <p className="text-sm font-medium text-brand-ink">{spec.scopes === "SHARED" ? "Llaves" : "Llaves de producción"}</p>
        <p className="text-xs text-brand-ink-soft mt-0.5 mb-4">
          {spec.keysHint} {spec.scopes === "SHARED" ? "Sirven para probar y para cobrar de verdad." : "Son las que cobran de verdad."}
        </p>
        <KeysSection
          provider={provider}
          mode="PRODUCTION"
          saved={current.credentials[spec.scopes === "SHARED" ? "SHARED" : "PRODUCTION"]}
          edits={edits[spec.scopes === "SHARED" ? "SHARED" : "PRODUCTION"] ?? {}}
          onChange={(key, v) => setField(spec.scopes === "SHARED" ? "SHARED" : "PRODUCTION", key, v)}
        />
      </Card>

      {spec.webhook && current.webhookUrl && (
        <Card>
          <p className="text-sm font-medium text-brand-ink">URL de avisos de pago</p>
          <p className="text-xs text-brand-ink-soft mt-0.5 mb-3">
            Pégala en {spec.webhook.where} Así cada pedido se marca como pagado solo, apenas {spec.name} aprueba el pago.
          </p>
          <CopyField value={current.webhookUrl} />
        </Card>
      )}
      {!spec.webhook && (
        <p className="text-xs text-brand-ink-soft px-1">
          {spec.name} avisa cada pago a Marcolini automáticamente: no tienes que configurar ninguna URL en su panel.
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {error && <p className="text-sm text-red-600 mr-auto">{error}</p>}
        {saved && !dirty && <p className="text-sm text-emerald-700 mr-auto">Guardado.</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
