"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  paymentProvider: "NONE" | "WOMPI";
  paymentMode: "TEST" | "PRODUCTION";
  wompiPublicKeyTest: string;
  wompiPrivateKeyTest: string;
  wompiEventsKeyTest: string;
  wompiIntegrityKeyTest: string;
  wompiPublicKeyProd: string;
  wompiPrivateKeyProd: string;
  wompiEventsKeyProd: string;
  wompiIntegrityKeyProd: string;
};

function KeyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-brand-ink mb-1">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input font-mono text-sm"
      />
    </div>
  );
}

export function StorePaymentForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [mode, setMode] = useState<"TEST" | "PRODUCTION">(initial.paymentMode);
  const [testKeys, setTestKeys] = useState({
    wompiPublicKeyTest: initial.wompiPublicKeyTest,
    wompiPrivateKeyTest: initial.wompiPrivateKeyTest,
    wompiEventsKeyTest: initial.wompiEventsKeyTest,
    wompiIntegrityKeyTest: initial.wompiIntegrityKeyTest,
  });
  const [prodKeys, setProdKeys] = useState({
    wompiPublicKeyProd: initial.wompiPublicKeyProd,
    wompiPrivateKeyProd: initial.wompiPrivateKeyProd,
    wompiEventsKeyProd: initial.wompiEventsKeyProd,
    wompiIntegrityKeyProd: initial.wompiIntegrityKeyProd,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/marca/tienda/pagos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMode: mode, ...testKeys, ...prodKeys }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo guardar.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("No se pudo guardar — revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">
          Pasarela de pago
        </label>
        <input value="Wompi" disabled className="input opacity-60" />
        <p className="text-xs text-brand-ink-soft mt-1">
          Las llaves las obtienes en tu propio panel de Wompi — cada marca cobra
          con su propia cuenta, la plata nunca pasa por Marcolini.
        </p>
      </div>

      <div>
        <label className="block text-sm text-brand-ink mb-1">Modo activo</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "TEST" | "PRODUCTION")}
          className="input"
        >
          <option value="TEST">Pruebas — no cobra de verdad</option>
          <option value="PRODUCTION">Producción — cobra de verdad</option>
        </select>
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 space-y-4">
        <p className="text-sm font-medium text-brand-ink">Llaves de prueba</p>
        <KeyField
          label="Llave pública de prueba"
          value={testKeys.wompiPublicKeyTest}
          onChange={(v) =>
            setTestKeys((k) => ({ ...k, wompiPublicKeyTest: v }))
          }
        />
        <KeyField
          label="Llave privada de prueba"
          value={testKeys.wompiPrivateKeyTest}
          onChange={(v) =>
            setTestKeys((k) => ({ ...k, wompiPrivateKeyTest: v }))
          }
        />
        <KeyField
          label="Llave privada de eventos (prueba)"
          value={testKeys.wompiEventsKeyTest}
          onChange={(v) =>
            setTestKeys((k) => ({ ...k, wompiEventsKeyTest: v }))
          }
        />
        <KeyField
          label="Llave de integridad (prueba)"
          value={testKeys.wompiIntegrityKeyTest}
          onChange={(v) =>
            setTestKeys((k) => ({ ...k, wompiIntegrityKeyTest: v }))
          }
        />
      </div>

      <div className="rounded-2xl border border-brand-line bg-brand-surface p-4 space-y-4">
        <p className="text-sm font-medium text-brand-ink">
          Llaves de producción
        </p>
        <KeyField
          label="Llave pública de producción"
          value={prodKeys.wompiPublicKeyProd}
          onChange={(v) =>
            setProdKeys((k) => ({ ...k, wompiPublicKeyProd: v }))
          }
        />
        <KeyField
          label="Llave privada de producción"
          value={prodKeys.wompiPrivateKeyProd}
          onChange={(v) =>
            setProdKeys((k) => ({ ...k, wompiPrivateKeyProd: v }))
          }
        />
        <KeyField
          label="Llave privada de eventos (producción)"
          value={prodKeys.wompiEventsKeyProd}
          onChange={(v) =>
            setProdKeys((k) => ({ ...k, wompiEventsKeyProd: v }))
          }
        />
        <KeyField
          label="Llave de integridad (producción)"
          value={prodKeys.wompiIntegrityKeyProd}
          onChange={(v) =>
            setProdKeys((k) => ({ ...k, wompiIntegrityKeyProd: v }))
          }
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-accent">Guardado.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
