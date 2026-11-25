import type { Metadata } from "next";

type ShareBrand = { companyName: string; description: string | null; logoUrl: string | null };

/// Lo que muestran Facebook, Instagram o WhatsApp al compartir un link de
/// la tienda, y lo que Meta toma para un anuncio que lleva a ella: siempre
/// de la marca. Sin esto, las páginas de producto y de colección heredaban
/// el de Marcolini (src/app/layout.tsx), y el 2026-11-25 un anuncio de H la
/// Cosedora salió con el texto "Somos la plataforma que conecta marcas…".

export function storeDescription(brand: Pick<ShareBrand, "companyName" | "description">) {
  return brand.description?.trim() || `Compra directo con ${brand.companyName}.`;
}

/// Las redes cortan el texto largo; mejor cortarlo en una palabra.
function short(text: string, max = 200) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/// Open Graph de una página de la tienda. Sin título, descripción o foto
/// propios, van los de la marca (su nombre, su descripción, su logo).
export function storeShare(
  brand: ShareBrand,
  page: { title?: string; description?: string | null; image?: string | null } = {},
): NonNullable<Metadata["openGraph"]> {
  const image = page.image || brand.logoUrl;
  return {
    title: page.title ?? brand.companyName,
    description: short(page.description?.trim() || storeDescription(brand)),
    siteName: brand.companyName,
    locale: "es_CO",
    type: "website",
    ...(image ? { images: [{ url: image }] } : {}),
  };
}
