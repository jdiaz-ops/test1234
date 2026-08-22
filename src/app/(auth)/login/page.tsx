"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (result?.error) {
      setError(
        result.error === "EMAIL_NOT_VERIFIED"
          ? "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
          : "Correo o contraseña incorrectos."
      );
      return;
    }

    window.location.href = result?.url ?? callbackUrl;
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 text-center mb-6">
        Iniciar sesión
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Correo</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm text-gray-700">Contraseña</label>
            <Link href="/recuperar-password" className="text-xs text-gray-500 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px bg-gray-200 flex-1" />
        <span className="text-xs text-gray-400">o</span>
        <div className="h-px bg-gray-200 flex-1" />
      </div>

      <button
        onClick={() => signIn("google", { callbackUrl })}
        className="w-full border border-gray-300 rounded-md py-2 text-sm font-medium hover:bg-gray-50"
      >
        Continuar con Google
      </button>

      <p className="text-center text-sm text-gray-500 mt-6">
        ¿No tienes cuenta?{" "}
        <Link href="/registro/creador" className="text-gray-900 font-medium hover:underline">
          Soy Creador
        </Link>{" "}
        ·{" "}
        <Link href="/registro/marca" className="text-gray-900 font-medium hover:underline">
          Soy Marca
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
