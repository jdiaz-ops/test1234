"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Profile = { name: string; email: string; role: string };

/// "Borrar perfiles de prueba": primero muestra exactamente qué cuentas se
/// van a borrar y pide confirmar. Ver admin-cleanup-service.ts.
export function DeleteTestProfilesButton() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function preview() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/limpiar-pruebas");
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setMessage(body.error ?? "No se pudo revisar.");
    if (body.profiles.length === 0) return setMessage("No quedan perfiles de prueba por borrar.");
    setProfiles(body.profiles);
  }

  async function confirm() {
    setLoading(true);
    const res = await fetch("/api/admin/limpiar-pruebas", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    setProfiles(null);
    if (!res.ok) return setMessage(body.error ?? "No se pudieron borrar.");
    setMessage(`Listo: se borraron ${body.deleted.length} perfiles de prueba.`);
    router.refresh();
  }

  return (
    <div className="mb-6">
      {!profiles && (
        <button
          type="button"
          onClick={preview}
          disabled={loading}
          className="text-xs text-red-700 hover:underline disabled:opacity-50"
        >
          {loading ? "Revisando..." : "Borrar perfiles de prueba"}
        </button>
      )}
      {profiles && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm">
          <p className="font-medium text-red-800 mb-2">
            Se van a borrar estas {profiles.length} cuentas de prueba con todo lo suyo (ventas,
            comisiones, pedidos, vínculos). No se puede deshacer. Se queda el creador de prueba 1.
          </p>
          <ul className="mb-4 space-y-0.5 text-red-900">
            {profiles.map((p) => (
              <li key={p.email}>
                {p.role === "BRAND" ? "Marca" : "Creador"}: <strong>{p.name}</strong>{" "}
                <span className="text-red-700/80">({p.email})</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={loading}
              className="bg-red-700 text-white text-xs font-medium rounded-full px-4 py-2 disabled:opacity-50"
            >
              {loading ? "Borrando..." : "Sí, borrar todo"}
            </button>
            <button
              type="button"
              onClick={() => setProfiles(null)}
              disabled={loading}
              className="text-xs text-brand-ink-soft hover:underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {message && <p className="text-xs text-brand-ink-soft mt-2">{message}</p>}
    </div>
  );
}
