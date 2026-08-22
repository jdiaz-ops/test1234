import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

// Placeholder — el Panel Admin real se construye en una tarea siguiente.
export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-2">Panel Admin (placeholder)</h1>
      <p className="text-sm text-gray-600 mb-6">
        Sesión activa: <strong>{session.user.email}</strong> · rol admin:{" "}
        {session.user.adminRole ?? "—"}
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
