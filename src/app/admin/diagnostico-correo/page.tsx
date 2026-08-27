"use client";

import { useState } from "react";

type UserRow = {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  hasPassword: boolean;
  createdAt: string;
  profileName: string | null;
  brandStatus: string | null;
};

const roleLabel: Record<string, string> = {
  CREATOR: "Creador",
  BRAND: "Marca",
  ADMIN: "Admin",
};

export default function DiagnosticoCorreoPage() {
  const [correo, setCorreo] = useState("");
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function search() {
    const res = await fetch(
      `/api/admin/diagnostico-correo?correo=${encodeURIComponent(correo)}`,
    );
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "No se pudo buscar.");
      return;
    }
    setUsers(body.users);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUsers(null);
    await search();
    setLoading(false);
  }

  // Borrado sin deshacer — confirmación explícita con el correo y el
  // perfil de por medio, para no borrar la fila equivocada por error de
  // clic cuando hay varias en la tabla.
  async function handleDelete(u: UserRow) {
    const label = u.profileName ? `${u.profileName} (${u.email})` : u.email;
    if (
      !window.confirm(
        `¿Borrar esta cuenta? ${label} — esto no se puede deshacer.`,
      )
    ) {
      return;
    }

    setDeletingId(u.id);
    setError(null);
    const res = await fetch(
      `/api/admin/diagnostico-correo?userId=${encodeURIComponent(u.id)}`,
      { method: "DELETE" },
    );
    setDeletingId(null);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo borrar la cuenta.");
      return;
    }
    await search();
  }

  return (
    <div>
      <p className="font-mono text-xs text-brand-accent tracking-widest mb-2">
        DIAGNÓSTICO
      </p>
      <h1 className="font-display text-2xl font-semibold text-brand-ink mb-2">
        Buscar cuentas por correo
      </h1>
      <p className="text-sm text-brand-ink-soft mb-8 max-w-xl">
        Busca todas las filas de usuario que coincidan con un correo, sin
        importar mayúsculas ni minúsculas. Si aparece más de una, esa es la
        señal de una cuenta duplicada — típicamente el origen de un &quot;correo
        o contraseña incorrectos&quot; que no tiene explicación a simple vista
        (un flujo tocó una fila, el login está leyendo otra).
      </p>

      <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-8">
        <input
          type="email"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="correo@ejemplo.com"
          className="input max-w-xs"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-accent text-white rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {users && (
        <div className="rounded-2xl border border-brand-line bg-brand-surface overflow-hidden">
          {users.length === 0 ? (
            <p className="text-sm text-brand-ink-soft p-5">
              No hay ninguna cuenta con ese correo.
            </p>
          ) : (
            <>
              {users.length > 1 && (
                <p className="text-sm font-medium text-red-600 bg-red-50 px-5 py-3 border-b border-brand-line">
                  {users.length} cuentas distintas con el mismo correo — esto es
                  un problema, no debería pasar.
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="text-left text-xs text-brand-ink-soft border-b border-brand-line">
                      <th className="px-4 py-3 font-medium">
                        Correo (tal cual está guardado)
                      </th>
                      <th className="px-4 py-3 font-medium">Rol</th>
                      <th className="px-4 py-3 font-medium">Perfil</th>
                      <th className="px-4 py-3 font-medium">
                        Correo verificado
                      </th>
                      <th className="px-4 py-3 font-medium">
                        Tiene contraseña
                      </th>
                      <th className="px-4 py-3 font-medium">Creada</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-brand-line last:border-0"
                      >
                        <td className="px-4 py-3 font-mono text-brand-ink">
                          {u.email}
                        </td>
                        <td className="px-4 py-3 text-brand-ink-soft">
                          {roleLabel[u.role] ?? u.role}
                        </td>
                        <td className="px-4 py-3 text-brand-ink-soft">
                          {u.profileName ?? "—"}
                          {u.brandStatus && ` (${u.brandStatus})`}
                        </td>
                        <td className="px-4 py-3">
                          {u.emailVerified ? (
                            <span className="text-brand-accent font-medium">
                              Sí
                            </span>
                          ) : (
                            <span className="text-brand-ink-soft">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.hasPassword ? (
                            <span className="text-brand-accent font-medium">
                              Sí
                            </span>
                          ) : (
                            <span className="text-brand-ink-soft">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-brand-ink-soft">
                          {new Date(u.createdAt).toLocaleString("es-CO")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={deletingId === u.id}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            {deletingId === u.id ? "Borrando..." : "Eliminar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
