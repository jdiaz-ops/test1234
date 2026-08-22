import { redirect } from "next/navigation";

// Conexión de tienda ahora vive dentro de Cuenta.
export default function MarcaTiendaRedirect() {
  redirect("/marca/cuenta");
}
