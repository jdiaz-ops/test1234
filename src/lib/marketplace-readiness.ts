/// Qué le falta a una marca para salir en el marketplace de los creadores
/// — las mismas condiciones que listActiveOffers (marketplace-service.ts),
/// dichas en palabras para Admin → Marcas. Vacío = sale (en modo Auto).
/// Desde el 2026-10-19 son la aprobación, no estar desactivada y la lista
/// "Lo que falta para ser visible en el marketplace" del panel de la marca
/// (ver go-live-service.ts); `goLiveMissing` null = no tiene tienda.
export function marketplaceMissing(
  brand: { status: string },
  goLiveMissing: string[] | null,
  deactivated: boolean,
): string[] {
  const missing: string[] = [];
  if (brand.status !== "APPROVED") missing.push("aprobarla");
  if (goLiveMissing === null) missing.push("crear su tienda en Marcolini");
  else missing.push(...goLiveMissing.map((label) => label.charAt(0).toLowerCase() + label.slice(1)));
  if (deactivated) missing.push("pagar el corte (está desactivada)");
  return missing;
}
