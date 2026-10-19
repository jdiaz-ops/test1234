/// "Líneas" de productos por el nombre: los que se llaman "{línea} –
/// {referencia}" (así quedan al separar las variantes, ver
/// product-split-service.ts). Sirve para cambiar de una vez el comienzo del
/// nombre de toda una línea: "Gel Polish Blancos, Negros y Grises – SUPER
/// BLACK" → "Gel Polish – SUPER BLACK". Pedido del 2026-10-19: "el nombre
/// de los productos puede ser muy confuso… debería solo decir Gel Polish –
/// Nombre de la referencia".

export const LINE_SEPARATOR = " – ";

/// La línea y la referencia de un nombre (el último guion separado por
/// espacios: "–", "—" o "-"); null si el nombre no tiene esa forma.
export function splitLineName(name: string): { line: string; rest: string } | null {
  const matches = Array.from(name.matchAll(/\s[–—-]\s/g));
  const last = matches[matches.length - 1];
  if (!last || last.index === undefined) return null;
  const line = name.slice(0, last.index).trim();
  const rest = name.slice(last.index + last[0].length).trim();
  return line && rest ? { line, rest } : null;
}

export type ProductLine = { line: string; products: { id: string; name: string; rest: string }[] };

/// Las líneas con al menos dos productos, de la más grande a la más chica.
export function productLines(products: { id: string; name: string }[]): ProductLine[] {
  const byLine = new Map<string, ProductLine>();
  for (const p of products) {
    const parts = splitLineName(p.name);
    if (!parts) continue;
    const entry = byLine.get(parts.line) ?? { line: parts.line, products: [] };
    entry.products.push({ id: p.id, name: p.name, rest: parts.rest });
    byLine.set(parts.line, entry);
  }
  return Array.from(byLine.values())
    .filter((l) => l.products.length >= 2)
    .sort((a, b) => b.products.length - a.products.length || a.line.localeCompare(b.line, "es"));
}

const UNITS = new Set(["ml", "gr", "g", "kg", "oz", "und", "unds", "cc", "mm", "cm", "x"]);
const SMALL_WORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "con", "sin", "para", "por", "a", "en"]);

/// "SUPER BLACK" → "Super Black", "OJO DE GATO" → "Ojo de Gato"; los
/// números, tamaños y unidades quedan como están ("Acida 15 ml").
export function sentenceCaseReference(text: string) {
  let first = true;
  return text
    .split(/(\s+)/)
    .map((word) => {
      if (!word.trim()) return word;
      const isFirst = first;
      first = false;
      if (/\d/.test(word)) return word;
      const lower = word.toLocaleLowerCase("es");
      if (UNITS.has(lower) || (!isFirst && SMALL_WORDS.has(lower))) return lower;
      return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
    })
    .join("");
}

export function lineProductName(line: string, rest: string, titleCase: boolean) {
  return `${line.trim()}${LINE_SEPARATOR}${titleCase ? sentenceCaseReference(rest) : rest}`.slice(0, 255);
}
