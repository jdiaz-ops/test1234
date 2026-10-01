/// Qué le falta a una marca para salir en el marketplace de los creadores
/// — las mismas condiciones que listActiveOffers (marketplace-service.ts),
/// dichas en palabras para Admin → Marcas. Vacío = sale (en modo Auto).
export function marketplaceMissing(
  brand: {
    status: string;
    logoUrl: string | null;
    description: string | null;
    storefrontSlug: string | null;
    storeConnectionStatus: string;
    websiteUrl: string | null;
    billingAcknowledgedAt: Date | null;
  },
  activeOffers: number,
  deactivated: boolean,
): string[] {
  const missing: string[] = [];
  if (brand.status !== "APPROVED") missing.push("aprobarla");
  if (!brand.logoUrl) missing.push("logo");
  if (!brand.description) missing.push("descripción");
  const hasStore =
    Boolean(brand.storefrontSlug) || (brand.storeConnectionStatus === "CONNECTED" && Boolean(brand.websiteUrl));
  if (!hasStore) missing.push("link de su tienda");
  if (!brand.billingAcknowledgedAt) missing.push("aceptar \"Cómo te cobramos\"");
  if (activeOffers === 0) missing.push("un programa activo");
  if (deactivated) missing.push("pagar el corte (está desactivada)");
  return missing;
}
