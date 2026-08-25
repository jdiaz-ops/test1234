import { redirect } from "next/navigation";

// Productos ahora vive dentro de Cuenta.
export default function MarcaProductosRedirect() {
  redirect("/marca/cuenta?tab=productos");
}
