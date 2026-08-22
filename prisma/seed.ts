// Seed mínimo: valores por defecto que la plataforma necesita para arrancar
// (configuración global editable desde el Panel Admin, y el vertical de
// lanzamiento "Uñas" con sus categorías iniciales).

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  const semipermanentes = await prisma.category.findFirstOrThrow({
    where: { verticalId: unas.id, slug: "semipermanentes" },
  });
  const herramientas = await prisma.category.findFirstOrThrow({
    where: { verticalId: unas.id, slug: "herramientas" },
  });

  // Marcas de ejemplo (APROBADAS) con una oferta activa cada una — para poder
  // construir y probar el marketplace del Portal Creador con datos reales en
  // vez de un estado vacío. Nombres reales de la industria, investigados
  // durante el diseño (ninguna integración real con sus tiendas todavía).
  await prisma.user.upsert({
    where: { email: "demo-brand-latinnails@marcolini.co" },
    update: {},
    create: {
      email: "demo-brand-latinnails@marcolini.co",
      role: "BRAND",
      emailVerified: new Date(),
      brandProfile: {
        create: {
          companyName: "Latin Nails",
          city: "Medellín",
          status: "APPROVED",
          approvedAt: new Date(),
          termsAcceptedAt: new Date(),
          verticalId: unas.id,
          storeType: "SHOPIFY",
          storeUrl: "https://latinnailsofficial.com",
          offers: {
            create: {
              name: "Programa de embajadoras Latin Nails",
              description: "Esmaltes semipermanentes de alta rotación.",
              categoryId: semipermanentes.id,
              defaultCommissionPercent: 15,
              defaultDiscountPercent: 15,
              joinMode: "OPEN",
            },
          },
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "demo-brand-mixcoco@marcolini.co" },
    update: {},
    create: {
      email: "demo-brand-mixcoco@marcolini.co",
      role: "BRAND",
      emailVerified: new Date(),
      brandProfile: {
        create: {
          companyName: "Mixcoco",
          city: "Bogotá",
          status: "APPROVED",
          approvedAt: new Date(),
          termsAcceptedAt: new Date(),
          verticalId: unas.id,
          storeType: "WOOCOMMERCE",
          storeUrl: "https://mixcoco.co",
          offers: {
            create: {
              name: "Programa de embajadoras Mixcoco",
              description: "Herramientas profesionales para uñas.",
              categoryId: herramientas.id,
              defaultCommissionPercent: 12,
              defaultDiscountPercent: 10,
              joinMode: "APPROVAL",
            },
          },
        },
      },
    },
  });

  // Cuenta de administrador (Propietario) — no hay registro público para
  // admin, así que la primera cuenta se siembra directamente. Cambia esta
  // contraseña apenas entres la primera vez.
  const adminPasswordHash = await bcrypt.hash("marcolini-admin-2026", 10);
  await prisma.user.upsert({
    where: { email: "admin@marcolini.co" },
    update: {},
    create: {
      email: "admin@marcolini.co",
      role: "ADMIN",
      adminRole: "OWNER",
      emailVerified: new Date(),
      passwordHash: adminPasswordHash,
    },
  });

  await prisma.legalContent.upsert({
    where: { key: "terms" },
    update: {},
    create: {
      key: "terms",
      title: "Términos y Condiciones",
      body: "Contenido pendiente — edítalo desde el Panel Admin (Configuración > Contenido legal).",
    },
  });

  console.log("Seed completado: configuración global + vertical Uñas + 2 marcas demo con oferta + admin.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
