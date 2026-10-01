"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "TEST" | "PRODUCTION";
type Status = "NOT_CONNECTED" | "ACTIVE" | "TEST" | "INCOMPLETE";
type Secret = { saved: boolean; last4: string };

type KeySet = {
  publicKey: string;
  privateKey: Secret;
  eventsKey: Secret;
  integrityKey: Secret;
};

export type StorePaymentInitial = {
  status: Status;
  paymentMode: Mode;
  test: KeySet;
  prod: KeySet;
  eventsUrl: string;
};

/// Nombre del campo en BrandProfile / la API para cada llave y entorno.
const FIELD = {
  PRODUCTION: {
    publicKey: "wompiPublicKeyProd",
    privateKey: "wompiPrivateKeyProd",
    eventsKey: "wompiEventsKeyProd",
    integrityKey: "wompiIntegrityKeyProd",
  },
  TEST: {
    publicKey: "wompiPublicKeyTest",
    privateKey: "wompiPrivateKeyTest",
    eventsKey: "wompiEventsKeyTest",
    integrityKey: "wompiIntegrityKeyTest",
  },
} as const;

/// Cómo empieza cada llave en Wompi — solo para avisar si alguien pegó la
/// llave en el campo equivocado (ej. la de pruebas en producción). No
/// bloquea el guardado.
const PREFIX = {
  PRODUCTION: { publicKey: "pub_prod_", privateKey: "prv_prod_", eventsKey: "prod_events_", integrityKey: "prod_integrity_" },
  TEST: { publicKey: "pub_test_", privateKey: "prv_test_", eventsKey: "test_events_", integrityKey: "test_integrity_" },
} as const;

type KeyName = keyof typeof FIELD.PRODUCTION;

const STATUS_CHIP: Record<Status, { label: string; className: string }> = {
  ACTIVE: { label: "Activa", className: "bg-emerald-100 text-emerald-800" },
  TEST: { label: "Modo de prueba", className: "bg-amber-100 text-amber-800" },
  INCOMPLETE: { label: "Faltan llaves", className: "bg-red-100 text-red-700" },
  NOT_CONNECTED: { label: "Sin conectar", className: "bg-brand-bg text-brand-ink-soft border border-brand-line" },
};

/// Métodos que ofrece Wompi en Colombia. Cuáles ve el comprador depende de
/// lo que la marca tenga activo en su propia cuenta de Wompi — Marcolini
/// no los prende ni los apaga, por eso acá no hay interruptores.
const METHODS: { name: string; detail: string; mark: string; markClass: string }[] = [
  { name: "Tarjetas de crédito y débito", detail: "Visa, Mastercard, American Express", mark: "CARD", markClass: "bg-slate-800 text-white" },
  { name: "PSE", detail: "Débito desde cualquier banco", mark: "PSE", markClass: "bg-sky-100 text-sky-800" },
  { name: "Nequi", detail: "Pago desde la app", mark: "N", markClass: "bg-fuchsia-100 text-fuchsia-800" },
  { name: "Bancolombia", detail: "Botón de pago y QR", mark: "B", markClass: "bg-yellow-100 text-yellow-900" },
  { name: "Daviplata", detail: "Pago desde la app", mark: "D", markClass: "bg-red-100 text-red-700" },
  { name: "Efectivo", detail: "Corresponsales Bancolombia", mark: "$", markClass: "bg-emerald-100 text-emerald-800" },
];

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-brand-line bg-brand-surface p-5 ${className}`}>
      {children}
    </section>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
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

function PrefixWarning({ value, prefix }: { value: string; prefix: string }) {
  if (!value.trim() || value.trim().startsWith(prefix)) return null;
  return (
    <p className="text-xs text-amber-700 mt-1">
      Esta llave normalmente empieza por <span className="font-mono">{prefix}</span>. Revisa
      que la hayas copiado del lugar correcto.
    </p>
  );
}

/// Llave pública: no es secreta, se muestra completa y se edita directo.
function PublicKeyField({
  label,
  value,
  prefix,
  onChange,
}: {
  label: string;
  value: string;
  prefix: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-brand-ink mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${prefix}...`}
        spellCheck={false}
        className="input font-mono text-sm"
      />
      <PrefixWarning value={value} prefix={prefix} />
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
  value,
  onChange,
}: {
  label: string;
  saved: Secret;
  prefix: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const editing = value !== undefined || !saved.saved;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-sm text-brand-ink mb-1">{label}</label>
      {editing ? (
        <>
          <div className="flex items-center gap-2">
            <input
              type={visible ? "text" : "password"}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`${prefix}...`}
              autoComplete="off"
              spellCheck={false}
              className="input font-mono text-sm flex-1"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="text-xs text-brand-ink-soft hover:text-brand-ink shrink-0"
            >
              {visible ? "Ocultar" : "Mostrar"}
            </button>
            {saved.saved && (
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="text-xs text-brand-ink-soft hover:text-brand-ink shrink-0"
              >
                Cancelar
              </button>
            )}
          </div>
          <PrefixWarning value={value ?? ""} prefix={prefix} />
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-brand-line bg-brand-bg px-3 py-2.5">
          <span className="font-mono text-sm text-brand-ink flex-1 tracking-wider">
            ••••••••{saved.last4}
          </span>
          <span className="text-xs text-emerald-700">Guardada</span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-medium text-brand-accent hover:underline"
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
}

function KeysSection({
  mode,
  saved,
  publicKey,
  secrets,
  onPublicKey,
  onSecret,
}: {
  mode: Mode;
  saved: KeySet;
  publicKey: string;
  secrets: Partial<Record<Exclude<KeyName, "publicKey">, string>>;
  onPublicKey: (v: string) => void;
  onSecret: (name: Exclude<KeyName, "publicKey">, v: string | undefined) => void;
}) {
  const env = mode === "PRODUCTION" ? "de producción" : "de prueba";
  const prefix = PREFIX[mode];
  return (
    <div className="space-y-4">
      <PublicKeyField label={`Llave pública ${env}`} value={publicKey} prefix={prefix.publicKey} onChange={onPublicKey} />
      <SecretKeyField
        label={`Llave privada ${env}`}
        saved={saved.privateKey}
        prefix={prefix.privateKey}
        value={secrets.privateKey}
        onChange={(v) => onSecret("privateKey", v)}
      />
      <div className="pt-2 border-t border-brand-line space-y-4">
        <p className="text-xs text-brand-ink-soft">
          Llaves de seguridad: con ellas confirmamos que cada pago de verdad lo
          aprobó Wompi.
        </p>
        <SecretKeyField
          label="Eventos"
          saved={saved.eventsKey}
          prefix={prefix.eventsKey}
          value={secrets.eventsKey}
          onChange={(v) => onSecret("eventsKey", v)}
        />
        <SecretKeyField
          label="Integridad"
          saved={saved.integrityKey}
          prefix={prefix.integrityKey}
          value={secrets.integrityKey}
          onChange={(v) => onSecret("integrityKey", v)}
        />
      </div>
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

/// Pagos, al estilo de la página de Wompi en Shopify: estado arriba
/// (Activa / Modo de prueba / Faltan llaves), los métodos que ve el
/// comprador, el interruptor de modo de prueba y las llaves — las secretas
/// enmascaradas. Antes era un formulario plano con 8 campos de contraseña.
/// Ver conversación del 2026-10-01.
export function StorePaymentForm({ initial }: { initial: StorePaymentInitial }) {
  const router = useRouter();
  const [testMode, setTestMode] = useState(initial.paymentMode === "TEST");
  const [publicKeys, setPublicKeys] = useState({ PRODUCTION: initial.prod.publicKey, TEST: initial.test.publicKey });
  const [secrets, setSecrets] = useState<Record<Mode, Partial<Record<Exclude<KeyName, "publicKey">, string>>>>({
    PRODUCTION: {},
    TEST: {},
  });
  const [aboutOpen, setAboutOpen] = useState(initial.status === "NOT_CONNECTED");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode: Mode = testMode ? "TEST" : "PRODUCTION";
  const dirty =
    testMode !== (initial.paymentMode === "TEST") ||
    publicKeys.PRODUCTION !== initial.prod.publicKey ||
    publicKeys.TEST !== initial.test.publicKey ||
    Object.values(secrets.PRODUCTION).some((v) => v) ||
    Object.values(secrets.TEST).some((v) => v);

  function setSecret(m: Mode, name: Exclude<KeyName, "publicKey">, value: string | undefined) {
    setSaved(false);
    setSecrets((prev) => {
      const next = { ...prev[m] };
      if (value === undefined) delete next[name];
      else next[name] = value;
      return { ...prev, [m]: next };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const body: Record<string, string> = { paymentMode: mode };
    for (const m of ["PRODUCTION", "TEST"] as const) {
      body[FIELD[m].publicKey] = publicKeys[m];
      for (const [name, value] of Object.entries(secrets[m])) {
        // Una llave en "Cambiar" que quedó vacía no borra la guardada.
        if (value) body[FIELD[m][name as Exclude<KeyName, "publicKey">]] = value;
      }
    }

    try {
      const res = await fetch("/api/marca/tienda/pagos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "No se pudo guardar.");
        return;
      }
      setSecrets({ PRODUCTION: {}, TEST: {} });
      setSaved(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar — revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const chip = STATUS_CHIP[initial.status];

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-xl font-semibold text-brand-ink">Wompi</h2>
        <span className={`text-xs font-medium rounded-md px-2 py-0.5 ${chip.className}`}>{chip.label}</span>
      </div>
      <p className="text-sm text-brand-ink-soft -mt-2">
        {initial.status === "ACTIVE" && "Tu tienda está cobrando de verdad. El dinero llega directo a tu cuenta de Wompi."}
        {initial.status === "TEST" && "Tu tienda está en modo de prueba: puedes hacer compras de ensayo, pero no se cobra de verdad."}
        {initial.status === "INCOMPLETE" &&
          "Tu tienda todavía no puede cobrar: faltan llaves para el modo que tienes activo."}
        {initial.status === "NOT_CONNECTED" &&
          "Conecta tu cuenta de Wompi para empezar a cobrar. El dinero llega directo a tu cuenta; Marcolini nunca lo recibe."}
      </p>

      <Card className="!p-0">
        <button
          type="button"
          onClick={() => setAboutOpen((o) => !o)}
          aria-expanded={aboutOpen}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
        >
          <span className="text-sm font-medium text-brand-ink">Acerca de Wompi</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`text-brand-ink-soft transition-transform ${aboutOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {aboutOpen && (
          <div className="px-5 pb-5 -mt-1 space-y-2 text-sm text-brand-ink-soft">
            <p>
              Wompi es la pasarela de pagos de Bancolombia. Cobras con tu propia
              cuenta: cada venta llega directo a ti y Wompi descuenta su tarifa
              por transacción según tu plan con ellos.
            </p>
            <p>
              ¿Aún no tienes cuenta?{" "}
              <a
                href="https://comercios.wompi.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-accent font-medium hover:underline"
              >
                Créala en Wompi →
              </a>
            </p>
          </div>
        )}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <p className="text-sm font-medium text-brand-ink">Métodos de pago</p>
          <p className="text-xs text-brand-ink-soft mt-0.5">
            Tus clientes ven los que tengas activos en tu cuenta de Wompi. Se
            prenden y apagan desde el panel de Wompi.
          </p>
        </div>
        <ul className="divide-y divide-brand-line border-t border-brand-line">
          {METHODS.map((m) => (
            <li key={m.name} className="flex items-center gap-3 px-5 py-3">
              <span
                className={`w-10 h-7 rounded-md flex items-center justify-center text-[10px] font-bold tracking-wide shrink-0 ${m.markClass}`}
                aria-hidden="true"
              >
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
              Mira cómo funcionan los pagos y los pedidos en tu tienda sin cobrar de
              verdad. Apágalo cuando quieras empezar a vender.
            </p>
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
        {testMode && (
          <div className="mt-5 pt-5 border-t border-brand-line">
            <p className="text-sm font-medium text-brand-ink mb-3">Llaves de prueba</p>
            <KeysSection
              mode="TEST"
              saved={initial.test}
              publicKey={publicKeys.TEST}
              secrets={secrets.TEST}
              onPublicKey={(v) => {
                setSaved(false);
                setPublicKeys((p) => ({ ...p, TEST: v }));
              }}
              onSecret={(name, v) => setSecret("TEST", name, v)}
            />
          </div>
        )}
      </Card>

      <Card>
        <p className="text-sm font-medium text-brand-ink">Llaves de producción</p>
        <p className="text-xs text-brand-ink-soft mt-0.5 mb-4">
          Las encuentras en tu panel de Wompi, en la sección{" "}
          <span className="text-brand-ink">Desarrolladores</span>. Son las que cobran de verdad.
        </p>
        <KeysSection
          mode="PRODUCTION"
          saved={initial.prod}
          publicKey={publicKeys.PRODUCTION}
          secrets={secrets.PRODUCTION}
          onPublicKey={(v) => {
            setSaved(false);
            setPublicKeys((p) => ({ ...p, PRODUCTION: v }));
          }}
          onSecret={(name, v) => setSecret("PRODUCTION", name, v)}
        />
      </Card>

      <Card>
        <p className="text-sm font-medium text-brand-ink">URL de eventos</p>
        <p className="text-xs text-brand-ink-soft mt-0.5 mb-3">
          Pégala en Wompi → Desarrolladores → URL de eventos (en producción y en
          pruebas). Así cada pedido se marca como pagado solo, apenas Wompi
          aprueba el pago.
        </p>
        <CopyField value={initial.eventsUrl} />
      </Card>

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
