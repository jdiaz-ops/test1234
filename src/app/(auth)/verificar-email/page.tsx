"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function VerificarEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Falta el token de verificación en el link.");
      return;
    }

    fetch("/api/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("ok");
        } else {
          const body = await res.json();
          setStatus("error");
          setMessage(body.error ?? "No se pudo verificar el correo.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Ocurrió un error inesperado.");
      });
  }, [token]);

  if (status === "loading") {
    return <p className="text-center text-sm text-brand-ink-soft">Verificando tu correo...</p>;
  }

  if (status === "error") {
    return (
      <div className="text-center">
        <h1 className="font-display text-lg font-semibold text-brand-ink mb-2">No pudimos verificarte</h1>
        <p className="text-sm text-brand-ink-soft">{message}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="font-display text-lg font-semibold text-brand-ink mb-2">¡Correo confirmado!</h1>
      <p className="text-sm text-brand-ink-soft mb-4">Ya puedes iniciar sesión en tu cuenta.</p>
      <Link href="/login" className="text-sm font-medium text-brand-ink hover:underline">
        Ir a iniciar sesión
      </Link>
    </div>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense>
      <VerificarEmailContent />
    </Suspense>
  );
}
