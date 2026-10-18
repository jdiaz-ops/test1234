/// La consulta mínima para pintar una tarjeta de producto (catálogo,
/// colección, relacionados, buscador) — todas pasan por toCardProduct en
/// product-card.tsx. Vive aparte de la tarjeta para que los servicios de
/// servidor no importen componentes.

export const CARD_VARIANT_SELECT = {
  id: true,
  option1Value: true,
  option2Value: true,
  option3Value: true,
  price: true,
  imageUrl: true,
  stock: true,
} as const;

export const cardProductSelect = {
  id: true,
  name: true,
  slug: true,
  imageUrl: true,
  price: true,
  compareAtPrice: true,
  stock: true,
  type: true,
  hasVariants: true,
  optionNames: true,
  attributes: true,
  variants: { select: CARD_VARIANT_SELECT, orderBy: { position: "asc" as const } },
} as const;
