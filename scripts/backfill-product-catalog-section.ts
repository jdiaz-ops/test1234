/// Migración de datos — corre UNA VEZ tras convertir el catálogo de
/// productos en una sección más de Diseño → Página de inicio (antes vivía
/// fijo en el home, ver `src/app/t/[slug]/page.tsx`). Para cada marca que
/// todavía no tiene una sección PRODUCT_CATALOG, le crea una (habilitada,
/// al final del orden — mismo lugar donde se mostraba el catálogo antes)
/// para que su vitrina siga mostrando el catálogo exactamente igual que
/// antes del cambio. Ver conversación del 2026-09-15: "Quita todo eso. Que
/// el único sitio para poner o quitar elementos de la homepage sea desde
/// diseño, página inicio."
///
/// Uso: npx tsx scripts/backfill-product-catalog-section.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brandProfile.findMany({
    select: {
      id: true,
      companyName: true,
      _count: { select: { storefrontSections: true } },
      storefrontSections: {
        where: { type: "PRODUCT_CATALOG" },
        select: { id: true },
      },
    },
  });

  const candidates = brands.filter((b) => b.storefrontSections.length === 0);
  console.log(`${candidates.length} de ${brands.length} marca(s) sin sección PRODUCT_CATALOG.`);

  for (const brand of candidates) {
    await prisma.storefrontSection.create({
      data: {
        brandId: brand.id,
        type: "PRODUCT_CATALOG",
        config: { title: "" },
        position: brand._count.storefrontSections,
        enabled: true,
      },
    });
    console.log(`✓ ${brand.companyName} (${brand.id}) — sección creada al final (posición ${brand._count.storefrontSections}).`);
  }

  console.log("Listo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
