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

/// Palabras de color (sin tildes, en minúscula) que suelen ir al final de
/// una línea agrupada por color: "Gel Polish Cafés y Nudes".
const COLOR_WORDS = new Set(
  (
    "nude nudes rosa rosas rosado rosados rojo rojos coral corales naranja naranjas anaranjados amarillo amarillos " +
    "verde verdes azul azules morado morados lila lilas violeta violetas purpura purpuras cafe cafes marron marrones " +
    "chocolate chocolates gris grises negro negros blanco blancos glitter glitters escarchados transparente transparentes " +
    "multicolor multicolores dorado dorados plateado plateados metalicos metalizados neon neones pastel pasteles beige beiges " +
    "terracota terracotas tierra tierras vinotinto vinotintos vino fucsia fucsias turquesa turquesas mostaza ocre ocres " +
    "crema cremas neutro neutros oscuro oscuros claro claros tono tonos color colores salmon salmones durazno duraznos " +
    "melon melones menta lavanda magenta borgona ciruela berenjena oliva militar esmeralda celeste celestes aqua cielo " +
    "marino marinos arena canela caramelo mocca kaki hueso marfil perla perlas nacar plata oro bronce cobre champana " +
    "rubi cereza cerezas mora moras uva pistacho fluorescente fluorescentes fluor metalico holograficos"
  ).split(" "),
);
const COLOR_CONNECTORS = new Set(["y", "e", "o", "&", "/", "+", "-"]);

function bareWord(word: string) {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[,.;:]+$/, "");
}

/// El comienzo corto que se le propone a una línea: sin lo que va después
/// de una barra ("Gel Polish Platinum | Platinum Gel Profesional" → "Gel
/// Polish Platinum") y sin los colores del final ("Gel Polish Blancos,
/// Negros y Grises" → "Gel Polish"). Null si no hay nada que acortar.
export function suggestLineName(line: string): string | null {
  const words = line.split(/\s+\|\s+/)[0].trim().split(/\s+/);
  let end = words.length;
  let colors = 0;
  while (end > 1) {
    const word = bareWord(words[end - 1]);
    if (COLOR_WORDS.has(word)) colors++;
    else if (!COLOR_CONNECTORS.has(word) && word !== "") break;
    end--;
  }
  const kept = (colors > 0 ? words.slice(0, end) : words).join(" ").replace(/[\s,;:|/&+-]+$/, "");
  return kept.length >= 2 && kept !== line.trim() ? kept : null;
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
