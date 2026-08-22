import Link from "next/link";

// Placeholder temporal — la Home real (con los 3 accesos: Soy Creador / Soy
// Marca / Ya tengo cuenta) se construye en la tarea de Home + Landing pages.
// Esto solo existe para poder navegar el flujo de autenticación mientras
// tanto.
export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Marcolini</h1>
      <div className="flex gap-4 text-sm">
        <Link href="/registro/creador" className="underline">
          Soy Creador
        </Link>
        <Link href="/registro/marca" className="underline">
          Soy Marca
        </Link>
        <Link href="/login" className="underline">
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  );
}
