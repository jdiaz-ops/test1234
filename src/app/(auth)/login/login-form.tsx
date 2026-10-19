"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const roleHome: Record<string, string> = {
  // Pasa por /creador/inicio: "Empieza aquí" si no ha terminado el
  // onboarding, si no el Dashboard.
  CREATOR: "/creador/inicio",
  BRAND: "/marca",
  ADMIN: "/admin",
  ALLY: "/aliado",
};

/// Lo que vuelve de "Continuar con Google" en ?error= (ver
/// checkGoogleSignIn y los errores de Auth.js).
const GOOGLE_ERRORS: Record<string, string> = {
  GoogleSinCuenta: "No encontramos una cuenta de Marcolini con ese correo de Google. Si eres nueva, regístrate abajo como creadora o marca.",
  GoogleSinCorreo: "Google no nos confirmó tu correo. Intenta de nuevo o entra con tu correo y contraseña.",
};
const OAUTH_ERRORS = new Set(["AccessDenied", "OAuthAccountNotLinked", "OAuthCallbackError", "OAuthSignin", "Callback", "Configuration"]);

/// `googleEnabled`: el botón de Google solo sale con sus llaves puestas (lo
/// decide page.tsx en el servidor, igual que auth.ts).
export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const googleError = urlError
    ? (GOOGLE_ERRORS[urlError] ?? (OAUTH_ERRORS.has(urlError) ? "No pudimos entrar con Google. Intenta de nuevo o entra con tu correo y contraseña." : null))
    : null;
  // Solo respetamos un callbackUrl explícito (por ejemplo, el middleware
  // redirigiendo desde una página protegida) — si no hay uno, enrutamos por
  // rol, no a "/", que sería el valor por defecto de esta URL.
  const explicitCallbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(googleError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setLoading(false);
      // result.error siempre es "CredentialsSignin" (el tipo genérico de
      // Auth.js) — el motivo real viene en result.code, que solo se llena
      // si authorize() tiró una subclase de CredentialsSignin con su
      // propio código (ver EmailNotVerifiedSignin en auth.ts).
      setError(
        result.code === "EMAIL_NOT_VERIFIED"
          ? "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
          : result.code === "TOO_MANY_ATTEMPTS"
            ? "Demasiados intentos seguidos. Espera 15 minutos o usa \"¿Olvidaste tu contraseña?\"."
            : "Correo o contraseña incorrectos.",
      );
      return;
    }

    if (explicitCallbackUrl) {
      window.location.href = explicitCallbackUrl;
      return;
    }

    const session = await getSession();
    window.location.href = (session && roleHome[session.user.role]) || "/";
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold text-brand-ink text-center mb-6">
        Iniciar sesión
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-brand-ink mb-1">Correo</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm text-brand-ink">Contraseña</label>
            <Link
              href="/recuperar-password"
              className="text-xs text-brand-ink-soft hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-accent text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="h-px bg-brand-line flex-1" />
            <span className="text-xs text-brand-ink-soft">o</span>
            <div className="h-px bg-brand-line flex-1" />
          </div>

          <button
            onClick={() =>
              signIn("google", { callbackUrl: explicitCallbackUrl ?? "/creador/inicio" })
            }
            className="w-full border border-brand-line rounded-md py-2 text-sm font-medium hover:bg-brand-accent-soft"
          >
            Continuar con Google
          </button>
        </>
      )}

      <p className="text-center text-sm text-brand-ink-soft mt-6">
        ¿No tienes cuenta?{" "}
        <Link
          href="/lista-de-espera"
          className="text-brand-accent font-medium hover:underline"
        >
          Soy Creador
        </Link>{" "}
        ·{" "}
        <Link
          href="/lista-de-espera/marcas"
          className="text-brand-accent font-medium hover:underline"
        >
          Soy Marca
        </Link>
      </p>
      <p className="text-center text-xs text-brand-ink-soft mt-3">
        ¿Eres aliado comercial?{" "}
        <Link href="/aliado/entrar" className="text-brand-accent hover:underline">
          Entra con un link a tu correo
        </Link>
      </p>
    </div>
  );
}
