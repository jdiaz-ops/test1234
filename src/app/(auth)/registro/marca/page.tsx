"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegistroMarcaPage() {
  const [form, setForm] = useState({
    companyName: "",
    email: "",
    password: "",
    city: "",
    termsAccepted: false,
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
    const res = await fetch("/api/register/marca", {
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
        <h1 className="text-lg font-semibold text-gray-900 mb-2">¡Ya casi!</h1>
        <p className="text-sm text-gray-600">
          Te enviamos un correo a <strong>{form.email}</strong> para confirmar tu cuenta.
          Una vez confirmado, tu marca queda pendiente de aprobación antes de
          aparecer activa en el marketplace.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 text-center mb-1">
        Regístrate como Marca
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        Solo pagas comisión cuando hay una venta real.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre de la marca">
          <input
            required
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
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
        <Field label="Ciudad (opcional)">
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="input"
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-gray-600">
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
          className="w-full bg-gray-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Creando cuenta..." : "Crear mi cuenta"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-gray-900 font-medium hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
