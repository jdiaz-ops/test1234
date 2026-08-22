import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

// Placeholder — el Portal Creador real se construye en la siguiente tarea.
// Esta página solo sirve para confirmar que el login + enrutamiento por rol
// funciona de punta a punta.
export default async function CreadorHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-2">Portal Creador (placeholder)</h1>
      <p className="text-sm text-gray-600 mb-6">
        Sesión activa: <strong>{session.user.email}</strong> · rol: {session.user.role}
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="text-sm underline">Cerrar sesión</button>
      </form>
    </div>
  );
}
