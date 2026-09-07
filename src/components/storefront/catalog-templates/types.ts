export type CatalogProduct = {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number | null;
  type: "PHYSICAL" | "SERVICE";
};

export function formatCOP(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
