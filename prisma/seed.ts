// Seed mínimo: valores por defecto que la plataforma necesita para arrancar
// (configuración global editable desde el Panel Admin, y el vertical de
// lanzamiento "Uñas" con sus categorías iniciales).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.platformConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      defaultPlatformFeePercent: 5.0,
      vatPercent: 19.0,
      chargeDayOfMonth: 1,
      payoutDayOfMonth: 15,
      refundHoldDays: 15,
      instantPayoutFeePercent: 5.0,
    },
  });

  const unas = await prisma.vertical.upsert({
    where: { slug: "unas" },
    update: {},
    create: { name: "Uñas", slug: "unas" },
  });

  const categorias = [
    { name: "Esmaltes", slug: "esmaltes" },
    { name: "Semipermanentes", slug: "semipermanentes" },
    { name: "Herramientas", slug: "herramientas" },
    { name: "Extensiones y acrílico", slug: "extensiones-acrilico" },
    { name: "Decoración", slug: "decoracion" },
  ];

  for (const categoria of categorias) {
    await prisma.category.upsert({
      where: { verticalId_slug: { verticalId: unas.id, slug: categoria.slug } },
      update: {},
      create: { ...categoria, verticalId: unas.id },
    });
  }

  console.log("Seed completado: configuración global + vertical Uñas con categorías.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
