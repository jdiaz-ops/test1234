import { redirect } from "next/navigation";
import { STORE_CONNECTION_ENABLED } from "@/lib/features";

// Productos sincronizados vive dentro de Cuenta; mientras la conexión con
// Shopify/WooCommerce esté apagada (ver src/lib/features.ts) esa pestaña
// no existe, así que va a los productos de Mi tienda.
export default function MarcaProductosRedirect() {
  redirect(STORE_CONNECTION_ENABLED ? "/marca/cuenta?tab=productos" : "/marca/tienda/productos");
}
