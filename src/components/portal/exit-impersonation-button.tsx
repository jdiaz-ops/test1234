"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function ExitImpersonationButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    const res = await fetch("/api/admin/entrar-como/salir", { method: "POST" });
    if (!res.ok) {
      // Si por lo que sea el token no se pudo emitir, no dejamos a la
      // persona atascada: la mandamos a Login para que entre de nuevo.
      window.location.href = "/login";
      return;
    }

    const { token } = await res.json();
    await signIn("credentials", { impersonateToken: token, redirect: false });
    window.location.href = "/admin";
  }

  return (
    <button onClick={handleClick} disabled={loading} className="font-medium hover:underline disabled:opacity-50">
      {loading ? "Volviendo..." : "Volver al panel admin"}
    </button>
  );
}
