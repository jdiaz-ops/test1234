import { ClasicaTemplate } from "./clasica";
import { MinimalTemplate } from "./minimal";
import { EditorialTemplate } from "./editorial";
import type { CatalogProduct } from "./types";

export type { CatalogProduct } from "./types";

const TEMPLATES = {
  CLASICA: ClasicaTemplate,
  MINIMAL: MinimalTemplate,
  EDITORIAL: EditorialTemplate,
} as const;

export type StorefrontTemplateKey = keyof typeof TEMPLATES;

export const STOREFRONT_TEMPLATE_OPTIONS: { key: StorefrontTemplateKey; label: string; description: string }[] = [
  { key: "CLASICA", label: "Clásica", description: "Grid parejo de tarjetas — el catálogo de siempre." },
  { key: "MINIMAL", label: "Minimalista", description: "Lista vertical, texto por delante, sin tarjetas." },
  { key: "EDITORIAL", label: "Editorial", description: "Hero grande para tu producto destacado + grid abajo." },
];

/// Elige y renderiza la plantilla del catálogo según lo que configuró la
/// marca — ver StorefrontTemplate en el schema. Cada una es un componente
/// distinto (no solo props de color), así que el cambio es de verdad
/// estructural, no cosmético.
export function CatalogTemplate({
  template,
  products,
  basePath,
}: {
  template: string;
  products: CatalogProduct[];
  basePath: string;
}) {
  const Template = TEMPLATES[template as StorefrontTemplateKey] ?? ClasicaTemplate;
  return <Template products={products} basePath={basePath} />;
}
