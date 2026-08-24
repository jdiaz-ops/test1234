"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TypeConfig = {
  key: string;
  label: string;
  enabled: boolean;
  mode: "AUTOMATIC" | "MANUAL";
  channelApp: boolean;
  channelEmail: boolean;
  messageTemplate: string;
  placeholders: string;
};

function NotificationTypeCard({ config }: { config: TypeConfig }) {
  const router = useRouter();
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    form.enabled !== config.enabled ||
    form.mode !== config.mode ||
    form.channelApp !== config.channelApp ||
    form.channelEmail !== config.channelEmail ||
    form.messageTemplate !== config.messageTemplate;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/notificaciones-tipos/${form.key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        mode: form.mode,
        channelApp: form.channelApp,
        channelEmail: form.channelEmail,
        messageTemplate: form.messageTemplate,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo guardar.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    router.refresh();
  }

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${form.enabled ? "border-brand-line bg-brand-surface" : "border-brand-line bg-brand-bg opacity-70"}`}>
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <p className="font-display font-semibold text-brand-ink">{config.label}</p>
          {config.placeholders && (
            <p className="text-[11px] text-brand-ink-soft font-mono mt-0.5">
              variables: {config.placeholders.split(",").map((p) => `{${p}}`).join(" ")}
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-brand-ink shrink-0">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          Activada
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-brand-ink-soft mb-1">Modo de envío</label>
          <select
            value={form.mode}
            onChange={(e) => setForm({ ...form, mode: e.target.value as TypeConfig["mode"] })}
            className="input text-sm"
          >
            <option value="AUTOMATIC">Automático — se manda sola en el momento</option>
            <option value="MANUAL">Manual — queda pendiente de tu aprobación</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-ink-soft mb-1">Canales</label>
          <div className="flex items-center gap-4 h-[38px]">
            <label className="flex items-center gap-1.5 text-sm text-brand-ink">
              <input
                type="checkbox"
                checked={form.channelApp}
                onChange={(e) => setForm({ ...form, channelApp: e.target.checked })}
              />
              App (+ push)
            </label>
            <label className="flex items-center gap-1.5 text-sm text-brand-ink">
              <input
                type="checkbox"
                checked={form.channelEmail}
                onChange={(e) => setForm({ ...form, channelEmail: e.target.checked })}
              />
              Correo
            </label>
          </div>
        </div>
      </div>

      <label className="block text-xs text-brand-ink-soft mb-1">Texto del mensaje</label>
      <textarea
        value={form.messageTemplate}
        onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })}
        rows={2}
        className="input text-sm font-mono"
      />

      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="text-xs bg-brand-accent text-white rounded-full px-4 py-1.5 font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        {saved && <span className="text-xs text-brand-accent font-medium">Guardado ✓</span>}
      </div>
    </div>
  );
}

export function NotificationTypeEditor({ configs }: { configs: TypeConfig[] }) {
  return (
    <div className="space-y-3">
      {configs.map((c) => (
        <NotificationTypeCard key={c.key} config={c} />
      ))}
    </div>
  );
}
