"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function RegistroCreadorPage() {
  return (
    <Suspense>
      <RegistroCreadorForm />
    </Suspense>
  );
}

function RegistroCreadorForm() {
  const searchParams = useSearchParams();
  // Si llegó desde el link de invitación de otro creador (ej.
  // marcolini.co/registro/creador?ref=LAURA30), se precarga acá — el campo
  // sigue siendo editable por si alguien prefiere escribirlo a mano.
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    termsAccepted: false,
    refCode: searchParams.get("ref") ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.termsAccepted) {
      setError("Debes aceptar los Términos y Condiciones para continuar.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/register/creador", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "No se pudo completar el registro.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="font-display text-lg font-semibold text-brand-ink mb-2">¡Ya casi!</h1>
        <p className="text-sm text-brand-ink-soft">
          Te enviamos un correo a <strong>{form.email}</strong> para confirmar tu cuenta.
          Revisa tu bandeja de entrada.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-brand-ink text-center mb-1">
        Regístrate como Creador
      </h1>
      <p className="text-sm text-brand-ink-soft text-center mb-6">
        Empieza a recomendar tus marcas favoritas — y a generar dinero gracias a tu audiencia.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Username (cómo te van a conocer)">
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder="ej. dani15"
            className="input"
          />
        </Field>
        <Field label="Correo">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Contraseña">
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Código de invitación (opcional)">
          <input
            value={form.refCode}
            onChange={(e) => setForm({ ...form, refCode: e.target.value })}
            placeholder="ej. LAURA30"
            className="input"
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-brand-ink-soft">
          <input
            type="checkbox"
            checked={form.termsAccepted}
            onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })}
            className="mt-0.5"
          />
          <span>
            Acepto los{" "}
            <Link href="/terminos" className="underline" target="_blank">
              Términos y Condiciones
            </Link>{" "}
            de Marcolini
          </span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-accent text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Creando cuenta..." : "Crear mi cuenta"}
        </button>
      </form>

      <p className="text-center text-sm text-brand-ink-soft mt-6">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-brand-ink font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-brand-ink mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-brand-ink-soft mt-1">{hint}</p>}
    </div>
  );
}
