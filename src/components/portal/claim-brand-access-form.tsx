"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/// Formulario de la página /activar (ver claimBrandAccess): correo y
/// contraseña de la dueña. Al terminar inicia sesión de una vez y la lleva
/// a su portal; si eso falla, le deja el link de inicio de sesión.
export function ClaimBrandAccessForm({ token }: { token: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/activar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "No se pudo crear tu acceso. Intenta de nuevo.");
        return;
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.ok) {
        router.push("/marca");
        router.refresh();
        return;
      }
      setDone(true);
    } catch {
      setError("No se pudo crear tu acceso. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-sm text-brand-ink-soft mb-4">Tu acceso quedó creado. Entra con tu correo y tu contraseña.</p>
        <Link href="/login" className="text-sm font-medium text-brand-ink hover:underline">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-brand-ink mb-1">Tu correo</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="input"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-ink mb-1">Contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          className="input"
        />
      </div>
      <div>
        <label className="block text-xs text-brand-ink mb-1">Repite la contraseña</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-accent text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Creando tu acceso..." : "Crear mi acceso y entrar"}
      </button>
      <p className="text-xs text-brand-ink-soft text-center">
        Con este correo y contraseña vas a entrar siempre a tu portal.
      </p>
    </form>
  );
}
