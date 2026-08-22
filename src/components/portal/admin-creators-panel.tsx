"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnterAsButton } from "@/components/portal/enter-as-button";

type Creator = {
  id: string;
  userId: string;
  displayName: string;
  city: string | null;
  baseCode: string;
  suspended: boolean;
  _count: { enrollments: number };
};

function AddCreatorForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", displayName: "", desiredCode: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/creadores/crear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear el creador.");
      return;
    }

    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="p-5 border-b border-brand-line bg-brand-accent-soft/40 space-y-3">
      <div className="grid sm:grid-cols-4 gap-3">
        <input
          type="email"
          required
          placeholder="correo@creador.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="input"
        />
        <input
          type="text"
          required
          placeholder="Nombre a mostrar"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="input"
        />
        <input
          type="text"
          required
          placeholder="Código deseado"
          value={form.desiredCode}
          onChange={(e) => setForm({ ...form, desiredCode: e.target.value })}
          className="input"
        />
        <input
          type="text"
          placeholder="Ciudad (opcional)"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          className="input"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creando..." : "Crear creador"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-brand-ink-soft hover:underline">
          Cancelar
        </button>
        <p className="text-xs text-brand-ink-soft">
          Queda activo de inmediato y le llega un correo para poner su contraseña.
        </p>
      </div>
    </form>
  );
}

export function AdminCreatorsPanel({ creators, isOwner }: { creators: Creator[]; isOwner: boolean }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [addingCreator, setAddingCreator] = useState(false);

  async function toggleSuspended(creatorId: string, suspended: boolean) {
    setLoadingId(creatorId);
    await fetch("/api/admin/creadores/suspender", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId, suspended }),
    });
    setLoadingId(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
      <div className="flex justify-end px-5 py-3 border-b border-brand-line">
        {!addingCreator && (
          <button onClick={() => setAddingCreator(true)} className="text-xs text-brand-accent font-medium hover:underline">
            + Agregar creador manualmente
          </button>
        )}
      </div>
      {addingCreator && <AddCreatorForm onDone={() => setAddingCreator(false)} />}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
            <th className="px-5 py-3 font-normal">Creador</th>
            <th className="px-5 py-3 font-normal">Código</th>
            <th className="px-5 py-3 font-normal">Marcas</th>
            <th className="px-5 py-3 font-normal">Estado</th>
            <th className="px-5 py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-line">
          {creators.map((c) => (
            <tr key={c.id}>
              <td className="px-5 py-3 text-brand-ink">
                {c.displayName}
                {c.city && <span className="text-brand-ink-soft"> · {c.city}</span>}
              </td>
              <td className="px-5 py-3 font-mono text-brand-accent">{c.baseCode}</td>
              <td className="px-5 py-3 font-mono text-brand-ink-soft">{c._count.enrollments}</td>
              <td className="px-5 py-3">
                {c.suspended ? (
                  <span className="text-red-600 font-medium">Suspendido</span>
                ) : (
                  <span className="text-brand-accent font-medium">Activo</span>
                )}
              </td>
              <td className="px-5 py-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => toggleSuspended(c.id, !c.suspended)}
                    disabled={loadingId === c.id}
                    className="text-xs text-brand-ink-soft hover:text-red-600 hover:underline"
                  >
                    {c.suspended ? "Reactivar" : "Suspender"}
                  </button>
                  {isOwner && <EnterAsButton userId={c.userId} role="CREATOR" />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
