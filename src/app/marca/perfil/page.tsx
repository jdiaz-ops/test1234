import { redirect } from "next/navigation";

// Perfil ahora vive dentro de Cuenta (ver reorganización de navegación).
export default function MarcaPerfilRedirect() {
  redirect("/marca/cuenta");
}
