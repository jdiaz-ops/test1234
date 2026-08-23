/// Paletas y fuentes prearmadas para la vitrina pública del creador — a
/// propósito nunca se deja elegir color/fuente libres, siempre una
/// combinación ya diseñada, para que se vea bien sin importar cuál elijan.
/// Se usa tanto en el picker del wizard (src/components/portal/*) como en
/// el render de la página pública (/c/[slug]).

export type StorefrontPalette = {
  key: string;
  label: string;
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentSoft: string;
};

export const STOREFRONT_PALETTES: StorefrontPalette[] = [
  {
    key: "rosa-marcolini",
    label: "Rosa Marcolini",
    bg: "#fcf1ee",
    surface: "#ffffff",
    ink: "#2e1f22",
    inkSoft: "#8c6f74",
    accent: "#d1477b",
    accentSoft: "#f6dde7",
  },
  {
    key: "lavanda",
    label: "Lavanda",
    bg: "#f5f1fb",
    surface: "#ffffff",
    ink: "#2c2438",
    inkSoft: "#8378a0",
    accent: "#7c5cbf",
    accentSoft: "#e6ddf7",
  },
  {
    key: "coral",
    label: "Coral cálido",
    bg: "#fef2ec",
    surface: "#ffffff",
    ink: "#3a2318",
    inkSoft: "#a17a63",
    accent: "#e8703a",
    accentSoft: "#fbe0cf",
  },
  {
    key: "verde-salvia",
    label: "Verde salvia",
    bg: "#f2f5ef",
    surface: "#ffffff",
    ink: "#22291f",
    inkSoft: "#748069",
    accent: "#5c7a4f",
    accentSoft: "#dee8d6",
  },
  {
    key: "monocromo",
    label: "Negro y blanco",
    bg: "#f7f7f7",
    surface: "#ffffff",
    ink: "#161616",
    inkSoft: "#767676",
    accent: "#161616",
    accentSoft: "#e5e5e5",
  },
  {
    key: "dorado",
    label: "Dorado suave",
    bg: "#faf6ec",
    surface: "#ffffff",
    ink: "#332b18",
    inkSoft: "#8f7f52",
    accent: "#a9822f",
    accentSoft: "#f0e6c8",
  },
];

export type StorefrontFont = { key: string; label: string; stack: string };

export const STOREFRONT_FONTS: StorefrontFont[] = [
  { key: "clasica", label: "Clásica", stack: "var(--font-display), -apple-system, sans-serif" },
  { key: "moderna", label: "Moderna", stack: "-apple-system, 'Helvetica Neue', Arial, sans-serif" },
  { key: "editorial", label: "Editorial", stack: "Georgia, 'Times New Roman', serif" },
  { key: "redondeada", label: "Redondeada", stack: "ui-rounded, 'SF Pro Rounded', 'Segoe UI', sans-serif" },
];

export function getPalette(key: string): StorefrontPalette {
  return STOREFRONT_PALETTES.find((p) => p.key === key) ?? STOREFRONT_PALETTES[0];
}

export function getFont(key: string): StorefrontFont {
  return STOREFRONT_FONTS.find((f) => f.key === key) ?? STOREFRONT_FONTS[0];
}
