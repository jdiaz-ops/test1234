"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Formulario de tarjeta — en un despliegue real esto se reemplaza por el
/// widget de checkout de ePayco (tokeniza en el navegador, la tarjeta nunca
/// pasa por nuestro servidor). Mientras tanto envía los datos a nuestra API,
/// que los tokeniza del lado del servidor contra ePayco antes de guardar
/// nada — ver src/server/integrations/epayco-client.ts.
export function CardForm({
  hasCard,
  initialHolderName = "",
  initialHolderEmail = "",
  onSaved,
}: {
  hasCard: boolean;
  initialHolderName?: string;
  initialHolderEmail?: string;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvc: "",
    holderName: initialHolderName,
    holderEmail: initialHolderEmail,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/marca/tarjeta", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo guardar la tarjeta.");
      return;
    }

    setSaved(true);
    router.refresh();
    onSaved?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
      <div>
        <label className="block text-sm text-brand-ink mb-1">Número de tarjeta</label>
        <input
          required
          value={form.cardNumber}
          onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
          placeholder="4242 4242 4242 4242"
          className="input"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Mes</label>
          <input
            required
            value={form.expMonth}
            onChange={(e) => setForm({ ...form, expMonth: e.target.value })}
            placeholder="MM"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">Año</label>
          <input
            required
            value={form.expYear}
            onChange={(e) => setForm({ ...form, expYear: e.target.value })}
            placeholder="AAAA"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm text-brand-ink mb-1">CVC</label>
          <input
            required
            value={form.cvc}
            onChange={(e) => setForm({ ...form, cvc: e.target.value })}
            placeholder="123"
            className="input"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Nombre del titular</label>
        <input
          required
          value={form.holderName}
          onChange={(e) => setForm({ ...form, holderName: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="block text-sm text-brand-ink mb-1">Correo del titular</label>
        <input
          required
          type="email"
          value={form.holderEmail}
          onChange={(e) => setForm({ ...form, holderEmail: e.target.value })}
          className="input"
        />
        <p className="text-xs text-brand-ink-soft mt-1">
          ePayco los pide para registrar la tarjeta de forma segura — no para contactarte.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-brand-accent">Tarjeta guardada.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : hasCard ? "Actualizar tarjeta" : "Guardar tarjeta"}
      </button>
    </form>
  );
}
