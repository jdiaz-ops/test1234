/// Atributos de un producto (Product.attributes, JSON) como un mapa plano
/// de textos — ignora cualquier cosa que no sea texto. Los llena "Separar
/// variantes en productos" ({ Grupo, Tono… }) y los leen los filtros de la
/// colección y los "otros tonos" de la página de producto.

export const GROUP_ATTRIBUTE = "Grupo";

export function readProductAttributes(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

/// El eje de la variante que dio origen al producto ("Tono", "Talla"…):
/// el primer atributo que no sea el grupo.
export function variantAxisOf(attributes: Record<string, string>): string | null {
  return Object.keys(attributes).find((k) => k !== GROUP_ATTRIBUTE) ?? null;
}

/// "Gel Polish Rosados – Princesa" → "Princesa" (lo que va después del
/// guion largo); si no hay guion, el nombre entero.
export function shortVariantName(name: string): string {
  const parts = name.split(/\s[–—-]\s/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : name.trim();
}
