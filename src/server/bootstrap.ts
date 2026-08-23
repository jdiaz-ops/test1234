import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/// Datos base que la plataforma necesita para arrancar: configuración
/// global, el vertical de lanzamiento "Uñas" con sus categorías, la cuenta
/// de admin, y el contenido legal por defecto. La usa tanto
/// `prisma/seed.ts` (CLI, `npx prisma db seed`) como la ruta
/// /api/admin/sembrar (para sembrar producción sin necesitar el CLI de
/// Vercel instalado localmente) — recibe el cliente de Prisma como
/// parámetro para que cada quien maneje su propia conexión.
export async function seedPlatform(prisma: PrismaClient) {
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

  // Marcolini solo opera en Uñas por ahora, pero el onboarding de creador
  // les pregunta categorías de interés (multi-selección, ver
  // CreatorInterest) para saber desde ya hacia dónde tiene sentido
  // expandir — estas categorías existen solo para eso, ninguna marca puede
  // publicarse en ellas todavía.
  const categoriasInteres = [
    { name: "Maquillaje", slug: "maquillaje" },
    { name: "Skincare", slug: "skincare" },
    { name: "Cabello", slug: "cabello" },
    { name: "Moda y ropa", slug: "moda-ropa" },
    { name: "Mascotas", slug: "mascotas" },
  ];
  for (const vertical of categoriasInteres) {
    await prisma.vertical.upsert({ where: { slug: vertical.slug }, update: {}, create: vertical });
  }

  // Marcas de ejemplo — solo para desarrollo/pruebas, nunca en la base
  // real. Se activan a propósito, con SEED_DEMO_DATA=true.
  if (process.env.SEED_DEMO_DATA === "true") {
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
  }

  // Cuenta de administrador (Propietario) — no hay registro público para
  // admin, así que la primera cuenta se siembra directamente. En
  // producción, ADMIN_EMAIL/ADMIN_PASSWORD deben apuntar a tus datos
  // reales; sin ellos cae al usuario de pruebas (nunca debería llegar así
  // a una base real).
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@marcolini.co";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "marcolini-admin-2026";
  const usedFallbackAdmin = !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD;

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
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

  return {
    adminEmail,
    usedFallbackAdmin,
    demoDataSeeded: process.env.SEED_DEMO_DATA === "true",
  };
}
