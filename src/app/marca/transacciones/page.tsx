import { redirect } from "next/navigation";

// Transacciones ahora vive dentro de Cuenta.
export default function MarcaTransaccionesRedirect() {
  redirect("/marca/cuenta?tab=transacciones");
}
