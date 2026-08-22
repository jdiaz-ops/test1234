"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function EnterAsButton({ userId, role }: { userId: string; role: "CREATOR" | "BRAND" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/entrar-como", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      setLoading(false);
      const body = await res.json();
      setError(body.error ?? "No se pudo entrar como esta cuenta.");
      return;
    }

    const { token } = await res.json();

    const result = await signIn("credentials", {
      impersonateToken: token,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("El token expiró — intenta de nuevo.");
      return;
    }

    window.location.href = role === "CREATOR" ? "/creador" : "/marca";
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs text-brand-ink-soft hover:text-brand-accent hover:underline disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar como"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
