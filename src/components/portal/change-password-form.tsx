"use client";

import { useState } from "react";

export function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/cuenta/cambiar-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo cambiar la contraseña.");
      return;
    }

    setSaved(true);
    setForm({ currentPassword: "", newPassword: "" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Contraseña actual</label>
        <input
          type="password"
          required
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Nueva contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          className="input"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-accent">Contraseña actualizada.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
