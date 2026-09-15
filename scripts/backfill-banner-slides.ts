/// Migración de datos — corre UNA VEZ tras convertir la sección BANNER
/// de una sola imagen fija (`config.imageUrl`) a un carrusel de hasta 6
/// slides (`config.slides: [{ imageUrl, link }]`), cada una con su
/// propio link y con la opción de aspecto cuadrado además del
/// horizontal de siempre. Ver conversación del 2026-09-15: "El banner
/// que se sube en la página de inicio quiero que sea adaptable [...]
/// también puede tener la opción de subir varias imágenes y hacer un
/// carrusel y cada imagen se puede hacer clic para llevar a una URL."
///
/// A diferencia del backfill de PRODUCT_CATALOG (que crea filas nuevas),
/// acá se reescribe el `config` de las secciones BANNER que ya
/// existían con la forma vieja — ni la vitrina pública ni el editor del
/// portal vuelven a pasar `config` por el schema al leer (solo al
/// guardar), así que sin este script las banners existentes quedarían
/// con `slides: []` (imagen invisible) hasta que la marca la re-suba a
/// mano.
///
/// Uso: npx tsx scripts/backfill-banner-slides.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type OldBannerConfig = {
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonLink?: string;
  [key: string]: unknown;
};

async function main() {
  const sections = await prisma.storefrontSection.findMany({
    where: { type: "BANNER" },
    select: { id: true, brandId: true, config: true },
  });

  const candidates = sections.filter((s) => {
    const c = s.config as OldBannerConfig;
    return c && typeof c === "object" && !Array.isArray(c) && !("slides" in c);
  });

  console.log(`${candidates.length} de ${sections.length} sección(es) BANNER en formato viejo.`);

  for (const section of candidates) {
    const old = section.config as OldBannerConfig;
    const { imageUrl, ...rest } = old;
    const next = {
      aspectRatio: "horizontal",
      slides: imageUrl ? [{ imageUrl, link: "" }] : [],
      title: rest.title ?? "",
      subtitle: rest.subtitle ?? "",
      buttonText: rest.buttonText ?? "",
      buttonLink: rest.buttonLink ?? "",
    };
    await prisma.storefrontSection.update({
      where: { id: section.id },
      data: { config: next },
    });
    console.log(`✓ sección ${section.id} (marca ${section.brandId}) — ${imageUrl ? "1 imagen migrada a slides" : "sin imagen, solo texto"}.`);
  }

  console.log("Listo.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
