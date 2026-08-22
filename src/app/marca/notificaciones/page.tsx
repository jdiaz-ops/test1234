import { redirect } from "next/navigation";

// Notificaciones ahora vive dentro de Cuenta (ver reorganización de navegación).
export default function MarcaNotificacionesRedirect() {
  redirect("/marca/cuenta");
}
