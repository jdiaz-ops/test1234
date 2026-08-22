import { redirect } from "next/navigation";

// Facturación ahora vive dentro de Cuenta (ver reorganización de navegación).
export default function MarcaFacturacionRedirect() {
  redirect("/marca/cuenta");
}
