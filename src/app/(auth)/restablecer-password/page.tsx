"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function RestablecerPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo restablecer la contraseña.");
      return;
    }

    setDone(true);
  }

  if (!token) {
    return <p className="text-center text-sm text-red-600">Falta el token en el link.</p>;
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">¡Listo!</h1>
        <p className="text-sm text-gray-600 mb-4">Tu contraseña fue actualizada.</p>
        <Link href="/login" className="text-sm font-medium text-gray-900 hover:underline">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 text-center mb-6">
        Crea una nueva contraseña
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          required
          minLength={8}
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}

export default function RestablecerPasswordPage() {
  return (
    <Suspense>
      <RestablecerPasswordForm />
    </Suspense>
  );
}
