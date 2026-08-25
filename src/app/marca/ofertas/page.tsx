import { redirect } from "next/navigation";

// Oferta y comisión ahora vive dentro de Cuenta.
export default function MarcaOfertasRedirect() {
  redirect("/marca/cuenta?tab=oferta");
}
