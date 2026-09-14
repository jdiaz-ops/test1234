/// Migración de datos (no de schema) — corre UNA VEZ tras desplegar el
/// cambio "envíos por zona obligatorio" (ver conversación del
/// 2026-09-14). Para cada marca que tenía BrandProfile.shippingFlatRate
/// configurado pero todavía no tiene ninguna ShippingZone, le crea una
/// zona catch-all "Resto de Colombia" que reproduce el mismo
/// comportamiento que tenía antes (tarifa fija, o gratis desde el umbral
/// configurado) — así ninguna tienda con productos físicos se queda sin
/// poder cobrar envío el día que el fallback deja de leerse en
/// createStoreOrder.
///
/// Uso: npx tsx scripts/backfill-shipping-zones.ts
import { PrismaClient } from "@prisma/client";
import { REST_OF_COUNTRY } from "../src/lib/colombia-regions";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.brandProfile.findMany({
    where: {
      shippingFlatRate: { not: null },
      shippingZones: { none: {} },
    },
    select: {
      id: true,
      companyName: true,
      shippingFlatRate: true,
      freeShippingThreshold: true,
    },
  });

  console.log(`${candidates.length} marca(s) con tarifa fija y sin zonas.`);

  for (const brand of candidates) {
    const flatRate = Number(brand.shippingFlatRate);
    const freeThreshold =
      brand.freeShippingThreshold != null ? Number(brand.freeShippingThreshold) : null;

    await prisma.shippingZone.create({
      data: {
        brandId: brand.id,
        name: "Resto de Colombia",
        regions: [REST_OF_COUNTRY],
        position: 0,
        rates: {
          create: [
            // Gratis desde el umbral — va primero porque pickShippingRate
            // elige la más barata entre las que aplican, así que el orden
            // acá no importa para el cálculo, pero lo deja legible.
            ...(freeThreshold != null
              ? [
                  {
                    name: "Envío gratis",
                    price: 0,
                    condition: "MIN_ORDER_AMOUNT" as const,
                    conditionValue: freeThreshold,
                    position: 0,
                  },
                ]
              : []),
            {
              name: "Envío estándar",
              price: flatRate,
              condition: "NONE" as const,
              position: freeThreshold != null ? 1 : 0,
            },
          ],
        },
      },
    });

    console.log(`✓ ${brand.companyName} (${brand.id}) — zona creada.`);
  }

  console.log("Listo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
