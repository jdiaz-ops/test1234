// Seed mínimo: valores base que la plataforma necesita para arrancar
// (configuración global editable desde el Panel Admin, el vertical de
// lanzamiento "Uñas" con sus categorías, y la cuenta de admin). La lógica
// real vive en src/server/bootstrap.ts — este archivo es solo el punto de
// entrada para `npx prisma db seed`.

import { PrismaClient } from "@prisma/client";
import { seedPlatform } from "../src/server/bootstrap";

const prisma = new PrismaClient();

seedPlatform(prisma)
  .then((result) => {
    if (result.usedFallbackAdmin) {
      console.warn(
        "⚠️  ADMIN_EMAIL/ADMIN_PASSWORD no configurados — usando la cuenta de pruebas por defecto. Cámbiala apenas entres."
      );
    }
    console.log(
      `Seed completado: configuración global + vertical Uñas + admin (${result.adminEmail})` +
        (result.demoDataSeeded ? " + 2 marcas demo con oferta." : ".")
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
