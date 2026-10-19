"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

/// Los aliados entran sin contraseña: con el link de un solo uso que les
/// llega al correo (o que les manda el equipo). Sin link, piden uno.
function AllyLogin() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const [state, setState] = useState<"checking" | "ask" | "sent" | "bad-link">(token ? "checking" : "ask");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  useEffect(() => {
    if (!token || tried.current) return;
    tried.current = true;
    signIn("credentials", { allyToken: token, redirect: false })
      .then((result) => {
        if (result && !result.error) router.replace("/aliado");
        else setState("bad-link");
      })
      .catch(() => setState("bad-link"));
  }, [token, router]);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/aliado/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const body = await res.json().catch(() => null);
      if (res.ok) setState("sent");
      else setError(body?.error ?? "No pudimos mandar el link. Intenta de nuevo.");
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  if (state === "checking") return <p className="text-sm text-brand-ink-soft text-center">Entrando a tu portal…</p>;

  if (state === "sent") {
    return (
      <div className="space-y-2 text-center">
        <h1 className="font-display text-xl font-semibold text-brand-ink">Revisa tu correo</h1>
        <p className="text-sm text-brand-ink-soft">
          Si {email} es el correo de un aliado de Marcolini, te llegó un link para entrar. Sirve una vez y dura 30 minutos. Mira también en spam.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h1 className="font-display text-xl font-semibold text-brand-ink">Portal de aliados</h1>
        <p className="text-sm text-brand-ink-soft">
          {state === "bad-link" ? "Ese link ya se usó o venció. Pide uno nuevo:" : "Escribe tu correo y te mandamos un link para entrar, sin contraseña."}
        </p>
      </div>
      <form onSubmit={request} className="space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="input" aria-label="Correo" autoComplete="email" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={sending} className="w-full bg-brand-accent text-white rounded-md py-2 text-sm font-medium disabled:opacity-50">
          {sending ? "Enviando…" : "Mandarme el link"}
        </button>
      </form>
    </div>
  );
}

export default function AllyLoginPage() {
  return (
    <Suspense>
      <AllyLogin />
    </Suspense>
  );
}
