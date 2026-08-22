"use client";

import { useState } from "react";
import Link from "next/link";

export default function RecuperarPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Revisa tu correo</h1>
        <p className="text-sm text-gray-600">
          Si <strong>{email}</strong> tiene una cuenta en Marcolini, te enviamos un link
          para restablecer tu contraseña.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 text-center mb-1">
        Recuperar contraseña
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        Te enviaremos un link a tu correo.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Enviar link"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        <Link href="/login" className="text-gray-900 font-medium hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
