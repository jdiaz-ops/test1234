"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StoreConnectionForm({
  initial,
}: {
  initial: { storeType: "SHOPIFY" | "WOOCOMMERCE" | "OTHER"; storeUrl: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/marca/tienda", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo guardar.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Plataforma</label>
        <select
          value={form.storeType}
          onChange={(e) => setForm({ ...form, storeType: e.target.value as typeof form.storeType })}
          className="input"
        >
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
          <option value="OTHER">Otra / código con reporte manual</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">URL de tu tienda</label>
        <input
          required
          type="url"
          value={form.storeUrl}
          onChange={(e) => setForm({ ...form, storeUrl: e.target.value })}
          placeholder="https://tu-tienda.com"
          className="input"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-accent">Guardado. La conexión automática se activará próximamente.</p>}

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
