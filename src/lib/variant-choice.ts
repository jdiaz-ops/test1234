/// Lo que dice el botón de compra de un producto con variantes mientras
/// falta elegir: "Elige tu referencia" (si la opción se llama
/// "Referencias"), "Elige tu talla", "Elige tus opciones" si faltan varias.
/// Antes decía "Agotado" aunque hubiera unidades — pedido del 2026-10-19:
/// "dice agotado. No es verdad… ojo con el vocabulario".
export function chooseOptionLabel(optionNames: string[], selected: Record<number, string | undefined>) {
  const missing = optionNames.filter((_, idx) => !selected[idx]);
  if (missing.length !== 1) return "Elige tus opciones";
  const name = singularOptionName(missing[0]);
  return name ? `Elige tu ${name}` : "Elige una opción";
}

/// "Referencias" → "referencia", "Tonos" → "tono", "Talla" → "talla". Los
/// plurales en -es ("Colores", "Presentaciones") no se adivinan: null, y el
/// botón dice "Elige una opción". "tu" sirve para los dos géneros.
export function singularOptionName(name: string): string | null {
  const words = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const first = words[0];
  if (first.endsWith("s")) {
    if (first.length < 4 || !/[ao]s$/.test(first)) return null;
    words[0] = first.slice(0, -1);
  }
  return words.join(" ");
}
