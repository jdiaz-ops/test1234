"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminUser = { id: string; email: string; adminRole: string | null; createdAt: string };

const roleLabel: Record<string, string> = {
  OWNER: "Propietario",
  SUPPORT: "Soporte",
  FINANCE: "Finanzas",
  BRAND_APPROVER: "Aprobador de marcas",
  CREATOR_APPROVER: "Aprobador de creadores",
};

const roleExplanation: { role: string; label: string; description: string }[] = [
  {
    role: "OWNER",
    label: "Propietario",
    description: "Acceso total. Es el único rol que puede editar Configuración de la plataforma y gestionar el Equipo (agregar, cambiar rol o eliminar personas).",
  },
  {
    role: "SUPPORT",
    label: "Soporte",
    description: "Atiende el día a día: revisa transacciones, mensajería y responde dudas de marcas y creadores.",
  },
  {
    role: "FINANCE",
    label: "Finanzas",
    description: "Sigue de cerca cobros a marcas, pagos a creadores, costos mensuales y reportes financieros.",
  },
  {
    role: "BRAND_APPROVER",
    label: "Aprobador de marcas",
    description: "Encargado de revisar y aprobar o rechazar el registro de nuevas marcas.",
  },
  {
    role: "CREATOR_APPROVER",
    label: "Aprobador de creadores",
    description: "Encargado de dar seguimiento a los creadores: hoy esto significa suspender o reactivar cuentas desde Creadores. Los creadores quedan activos automáticamente al registrarse — no hay una cola de aprobación separada por ahora.",
  },
];

export function AdminTeamPanel({ admins, currentUserId }: { admins: AdminUser[]; currentUserId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", adminRole: "SUPPORT", temporaryPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/admin/equipo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo crear la cuenta.");
      return;
    }

    setForm({ email: "", adminRole: "SUPPORT", temporaryPassword: "" });
    router.refresh();
  }

  async function changeRole(userId: string, adminRole: string) {
    await fetch("/api/admin/equipo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, adminRole }),
    });
    router.refresh();
  }

  async function remove(userId: string) {
    await fetch("/api/admin/equipo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
              <th className="px-5 py-3 font-normal">Correo</th>
              <th className="px-5 py-3 font-normal">Rol</th>
              <th className="px-5 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-3 text-brand-ink font-mono">{a.email}</td>
                <td className="px-5 py-3">
                  <select
                    value={a.adminRole ?? "SUPPORT"}
                    onChange={(e) => changeRole(a.id, e.target.value)}
                    disabled={a.id === currentUserId}
                    className="input py-1 text-sm disabled:opacity-60"
                  >
                    {Object.entries(roleLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3">
                  {a.id !== currentUserId && (
                    <button onClick={() => remove(a.id)} className="text-xs text-red-600 hover:underline">
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-display font-semibold text-brand-ink mb-4">Agregar a alguien de tu equipo</h2>
      <form onSubmit={handleAdd} className="space-y-4 max-w-sm">
        <input
          type="email"
          required
          placeholder="correo@ejemplo.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="input"
        />
        <select
          value={form.adminRole}
          onChange={(e) => setForm({ ...form, adminRole: e.target.value })}
          className="input"
        >
          {Object.entries(roleLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="password"
          required
          minLength={8}
          placeholder="Contraseña temporal"
          value={form.temporaryPassword}
          onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
          className="input"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-accent text-white rounded-full px-6 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creando..." : "Agregar"}
        </button>
        <p className="text-xs text-brand-ink-soft">
          Comunícale la contraseña temporal por fuera de la plataforma — no se envía por correo todavía.
        </p>
      </form>

      <h2 className="font-display font-semibold text-brand-ink mt-10 mb-4">Roles y qué hace cada uno</h2>
      <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-line text-left text-xs text-brand-ink-soft">
              <th className="px-5 py-3 font-normal w-48">Rol</th>
              <th className="px-5 py-3 font-normal">Función</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {roleExplanation.map((r) => (
              <tr key={r.role}>
                <td className="px-5 py-3 text-brand-ink font-medium align-top">{r.label}</td>
                <td className="px-5 py-3 text-brand-ink-soft align-top">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
