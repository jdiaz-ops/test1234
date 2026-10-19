/// Familias de color de los productos (esmaltes, geles, polvos…): la IA
/// mira la foto de cada producto y le pone una (ver
/// color-family-service.ts); se guarda como el atributo "Familia de color"
/// del producto y con eso la colección muestra sola el filtro — la
/// compradora entra a Builder Gel y filtra los nudes. Pedido del
/// 2026-10-19: "puede la ia analizar imágenes para crear grupos de
/// colores? … los verdes, los nudes, los azules".

export const COLOR_FAMILY_ATTRIBUTE = "Familia de color";
/// facetKey(COLOR_FAMILY_ATTRIBUTE), escrito acá para que collection-filters
/// pueda usar este archivo sin importarse en círculo.
export const COLOR_FAMILY_FACET = "familia de color";

/// En el orden en que se muestran en el filtro, cada una con el color de
/// su muestra (un punto al lado del nombre).
export const COLOR_FAMILIES = [
  { name: "Nudes", swatch: "#d9b99b" },
  { name: "Rosados", swatch: "#f2a7c3" },
  { name: "Rojos", swatch: "#c8102e" },
  { name: "Corales y naranjas", swatch: "#ff7f50" },
  { name: "Amarillos", swatch: "#f2c94c" },
  { name: "Verdes", swatch: "#3c9d5d" },
  { name: "Azules", swatch: "#2f6fd6" },
  { name: "Morados", swatch: "#8e5bd0" },
  { name: "Cafés", swatch: "#7b4a2e" },
  { name: "Grises", swatch: "#9a9a9a" },
  { name: "Negros", swatch: "#111111" },
  { name: "Blancos", swatch: "#ffffff" },
  { name: "Glitter", swatch: "linear-gradient(135deg, #f7e7a1, #c0c0c0 45%, #f5b5d4)" },
  { name: "Transparentes", swatch: "repeating-conic-gradient(#e5e5e5 0 25%, #ffffff 0 50%) 50% / 6px 6px" },
  { name: "Multicolor", swatch: "conic-gradient(#e63946, #f4a261, #e9c46a, #2a9d8f, #457b9d, #8e5bd0, #e63946)" },
] as const;

export type ColorFamily = (typeof COLOR_FAMILIES)[number]["name"];
export const COLOR_FAMILY_NAMES = COLOR_FAMILIES.map((f) => f.name) as ColorFamily[];
/// La respuesta de la IA cuando el producto no tiene un color propio
/// (una lima, una lámpara): no se guarda nada.
export const NO_COLOR = "No aplica";

export function isColorFamily(value: string): value is ColorFamily {
  return (COLOR_FAMILY_NAMES as string[]).includes(value);
}

export function colorFamilySwatch(value: string): string | null {
  return COLOR_FAMILIES.find((f) => f.name === value)?.swatch ?? null;
}

/// Orden del filtro: el de COLOR_FAMILIES; lo que no esté en la lista (una
/// familia escrita a mano), al final por nombre.
export function compareColorFamilies(a: string, b: string) {
  const ia = COLOR_FAMILY_NAMES.indexOf(a as ColorFamily);
  const ib = COLOR_FAMILY_NAMES.indexOf(b as ColorFamily);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a.localeCompare(b, "es");
}

/// Los atributos del producto con la familia puesta (o quitada con null),
/// sin tocar los demás (Grupo, Tono…).
export function withColorFamily(attributes: Record<string, string>, family: ColorFamily | null): Record<string, string> {
  const next = { ...attributes };
  if (family) next[COLOR_FAMILY_ATTRIBUTE] = family;
  else delete next[COLOR_FAMILY_ATTRIBUTE];
  return next;
}
