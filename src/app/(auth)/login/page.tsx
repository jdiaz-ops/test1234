import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  // "Continuar con Google" solo con sus llaves (el mismo chequeo que
  // registra el proveedor en auth.ts): sin ellas Google respondía "Missing
  // required parameter: client_id" (2026-10-19).
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  return (
    <Suspense>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
