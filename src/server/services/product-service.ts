import { prisma } from "@/lib/prisma";

export class ProductError extends Error {}

const MAX_FEATURED_PER_BRAND = 3;

/// SOLO PARA PRUEBAS — catálogo de mentira para que el Propietario pueda
/// probar vitrina/colecciones sin depender de una tienda Shopify/WooCommerce
/// real conectada. Los precios y nombres son de esmaltes/manicure para que
/// calcen con el tipo de marca que usa Marcolini; las "fotos" son un SVG
/// generado al vuelo (ver placeholderImage) — a propósito, para no
/// depender de ningún servicio externo (nunca se rompen por un dominio
/// caído o bloqueado).
const TEST_PRODUCTS: Array<{
  handle: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  color: string;
  featured?: boolean;
}> = [
  { handle: "esmalte-rojo-pasion", name: "Esmalte Semipermanente Rojo Pasión", price: 45000, compareAtPrice: 55000, color: "#c62b3f", featured: true },
  { handle: "esmalte-nude-chic", name: "Esmalte Semipermanente Nude Chic", price: 42000, compareAtPrice: null, color: "#d8b49a" },
  { handle: "top-coat-sellador-uv", name: "Top Coat Sellador UV", price: 38000, compareAtPrice: null, color: "#bcd4e6" },
  { handle: "base-fortalecedora", name: "Base Fortalecedora Uñas Débiles", price: 35000, compareAtPrice: null, color: "#f2e0c9" },
  { handle: "kit-manicure-francesa", name: "Kit Manicure Francesa Completo", price: 89000, compareAtPrice: 110000, color: "#f6dde7", featured: true },
  { handle: "esmalte-rosa-bebe", name: "Esmalte Semipermanente Rosa Bebé", price: 42000, compareAtPrice: null, color: "#f3b8cc" },
  { handle: "removedor-sin-acetona", name: "Removedor de Esmalte Sin Acetona", price: 25000, compareAtPrice: null, color: "#cfe8d8" },
  { handle: "aceite-cuticulas", name: "Aceite Nutritivo para Cutículas", price: 28000, compareAtPrice: 32000, color: "#e8d28a" },
  { handle: "lampara-uv-led", name: "Lámpara UV/LED Portátil", price: 150000, compareAtPrice: 180000, color: "#c9b8e8", featured: true },
  { handle: "esmalte-negro-elegante", name: "Esmalte Semipermanente Negro Elegante", price: 42000, compareAtPrice: null, color: "#4a4a52" },
  { handle: "set-limas-pulidores", name: "Set de Limas y Pulidores x5", price: 32000, compareAtPrice: null, color: "#e3c6a8" },
  { handle: "esmalte-vino-tinto", name: "Esmalte Semipermanente Vino Tinto", price: 42000, compareAtPrice: 48000, color: "#722f42" },
];

/// SVG de 600x600 con fondo de color + el emoji 💅 centrado, codificado
/// como data: URI — se ve como una "foto de producto" en la grilla sin
/// depender de ningún servicio externo (un servicio de fotos caído o
/// bloqueado no puede romper esta demo).
function placeholderImage(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" fill="${color}" />
    <text x="300" y="330" font-size="220" text-anchor="middle" dominant-baseline="middle">💅</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/// SOLO PARA PRUEBAS — crea (o deja tal cual si ya existen) los 12
/// productos de mentira de arriba para esta marca, como si vinieran recién
/// sincronizados de su tienda Shopify/WooCommerce. Nunca se llama desde el
/// flujo real de sincronización (ver product-sync-service.ts).
export async function createTestProducts(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });
  const host = brand.storeUrl ? new URL(brand.storeUrl).host : "tienda-de-prueba.myshopify.com";

  const existing = await prisma.product.findMany({
    where: { brandId, externalId: { in: TEST_PRODUCTS.map((p) => `test-${p.handle}`) } },
    select: { externalId: true },
  });
  const existingIds = new Set(existing.map((e) => e.externalId));

  for (const p of TEST_PRODUCTS) {
    const externalId = `test-${p.handle}`;
    const data = {
      name: p.name,
      imageUrl: placeholderImage(p.color),
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      url: `https://${host}/products/${p.handle}`,
      available: true,
      featured: p.featured ?? false,
    };
    // `update: data` (no solo `{}`) a propósito — si ya existían con datos
    // de una versión anterior de este catálogo de prueba (ej. la imagen
    // apuntaba a un servicio externo), un segundo click los deja al día.
    await prisma.product.upsert({
      where: { brandId_externalId: { brandId, externalId } },
      update: data,
      create: { brandId, externalId, ...data },
    });
  }

  return { total: TEST_PRODUCTS.length, created: TEST_PRODUCTS.length - existingIds.size };
}

export async function listProductsForBrand(brandId: string) {
  return prisma.product.findMany({
    where: { brandId },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
  });
}

/// Hasta 3 productos destacados por marca — aparecen primero como
/// "sugeridos" cuando un creador arma una colección con productos de esta
/// marca (ver listSuggestedProductsForCreator).
export async function setProductFeatured(brandId: string, productId: string, featured: boolean) {
  const product = await prisma.product.findFirst({ where: { id: productId, brandId } });
  if (!product) throw new ProductError("Producto no encontrado.");

  if (featured && !product.featured) {
    const count = await prisma.product.count({ where: { brandId, featured: true } });
    if (count >= MAX_FEATURED_PER_BRAND) {
      throw new ProductError(`Ya tienes ${MAX_FEATURED_PER_BRAND} productos destacados — quita uno antes de agregar otro.`);
    }
  }

  return prisma.product.update({ where: { id: productId }, data: { featured } });
}

/// Productos disponibles de las marcas a las que el creador está ACTIVE —
/// es el universo del que puede elegir al armar una colección, nunca de
/// marcas a las que no se ha unido. `search` filtra por nombre o marca;
/// `brandId`/`category` acotan más — `category` solo tiene datos para
/// marcas WooCommerce por ahora (ver product-sync-service.ts).
export async function listProductsForCreator(
  creatorId: string,
  filters?: { search?: string; brandId?: string; category?: string }
) {
  const brandIds = await activeBrandIdsForCreator(creatorId);
  if (brandIds.length === 0) return [];
  // El filtro de marca nunca puede salirse del universo de marcas a las que
  // el creador está unido, aunque venga manipulado desde el cliente.
  if (filters?.brandId && !brandIds.includes(filters.brandId)) return [];

  return prisma.product.findMany({
    where: {
      brandId: filters?.brandId ? filters.brandId : { in: brandIds },
      available: true,
      ...(filters?.category ? { category: filters.category } : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { brand: { companyName: { contains: filters.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { brand: { select: { companyName: true, storeType: true } } },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    take: 60,
  });
}

/// Marcas y categorías disponibles para los filtros del buscador — solo de
/// las marcas a las que el creador ya está unido.
export async function listProductFiltersForCreator(creatorId: string) {
  const brandIds = await activeBrandIdsForCreator(creatorId);
  if (brandIds.length === 0) return { brands: [], categories: [] };

  const [brands, categories] = await Promise.all([
    prisma.brandProfile.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    prisma.product.findMany({
      where: { brandId: { in: brandIds }, available: true, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  return {
    brands,
    categories: categories.map((c) => c.category!).filter(Boolean),
  };
}

/// Los productos destacados por las marcas del creador — se muestran como
/// franja "Sugeridos" arriba del buscador al armar una colección.
export async function listSuggestedProductsForCreator(creatorId: string) {
  const brandIds = await activeBrandIdsForCreator(creatorId);
  if (brandIds.length === 0) return [];

  return prisma.product.findMany({
    where: { brandId: { in: brandIds }, available: true, featured: true },
    include: { brand: { select: { companyName: true, storeType: true } } },
    orderBy: { name: "asc" },
  });
}

async function activeBrandIdsForCreator(creatorId: string) {
  const enrollments = await prisma.creatorOfferEnrollment.findMany({
    where: { creatorId, status: "ACTIVE" },
    select: { offer: { select: { brandId: true } } },
  });
  return [...new Set(enrollments.map((e) => e.offer.brandId))];
}
