"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LegalContentForm({
  legalKey,
  initial,
}: {
  legalKey: string;
  initial: { title: string; body: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const res = await fetch("/api/admin/legal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: legalKey, ...form }),
    });

    setSaving(false);
    // Antes esto no revisaba res.ok: si el servidor rechazaba la petición
    // (ej. título vacío — la validación exige min(1)), el formulario igual
    // decía "Guardado." sin haber guardado nada.
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar. Intenta de nuevo.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Título</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Contenido</label>
        <textarea
          required
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          className="input min-h-40"
        />
      </div>

      {saved && <p className="text-sm text-brand-accent">Guardado.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

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
