import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Placeholder — el Portal Marca real se construye en una tarea siguiente.
export default async function MarcaHomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const brand = await prisma.brandProfile.findUnique({
    where: { userId: session.user.id },
  });

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="text-xl font-semibold mb-2">Portal Marca (placeholder)</h1>
      <p className="text-sm text-gray-600 mb-2">
        Sesión activa: <strong>{session.user.email}</strong>
      </p>
      <p className="text-sm text-gray-600 mb-6">
        Estado de tu marca:{" "}
        <strong>
          {brand?.status === "PENDING"
            ? "Pendiente de aprobación"
            : brand?.status ?? "—"}
        </strong>
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
