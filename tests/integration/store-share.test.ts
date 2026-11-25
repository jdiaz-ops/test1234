import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

// Sin sesión: la tienda la mira solo para la vista previa del editor de
// Diseño (brand-theme-service), que aquí no se usa.
vi.mock("@/auth", () => ({ auth: async () => null }));
import { prisma } from "@/lib/prisma";
import { generateMetadata as storeLayout } from "@/app/t/[slug]/layout";
import { generateMetadata as storeHome } from "@/app/t/[slug]/page";
import { generateMetadata as productPage } from "@/app/t/[slug]/[productSlug]/page";
import { generateMetadata as collectionPage } from "@/app/t/[slug]/coleccion/[collectionSlug]/page";
import { generateMetadata as customPage } from "@/app/t/[slug]/pagina/[pageSlug]/page";
import { createBrand, createProduct, hasDb } from "./helpers";

const LOGO = "https://x.public.blob.vercel-storage.com/logo.png";
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });

/// El 2026-11-25 un anuncio de H la Cosedora que llevaba a su colección
/// Outlet salió con el texto de Marcolini ("Somos la plataforma…"): las
/// páginas sin openGraph propio heredaban el de src/app/layout.tsx.
describe.skipIf(!hasDb)("al compartir un link de la tienda o pautar con él", () => {
  it("cada página muestra la marca, nunca el texto de Marcolini", async () => {
    const created = await createBrand();
    const brand = await prisma.brandProfile.update({
      where: { id: created.id },
      data: { description: "Esmaltes y placas de stamping.", logoUrl: LOGO },
    });
    const slug = brand.storefrontSlug!;
    const product = await createProduct(brand.id, { name: "Esmalte Chicago", price: 4000, stock: 5 });
    await prisma.product.update({
      where: { id: product.id },
      data: { description: "<p>Tono <b>rojo</b> cereza.</p>", images: { create: [{ url: "https://x/chicago.jpg", position: 0 }] } },
    });
    await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Outlet", slug: "outlet", imageUrl: "https://x/outlet.jpg" } });
    await prisma.storePage.create({ data: { brandId: brand.id, title: "Envíos", slug: "envios", body: "<p>Enviamos a toda Colombia.</p>" } });

    const layout = await storeLayout(params({ slug }));
    const home = await storeHome(params({ slug }));
    const productMeta = await productPage(params({ slug, productSlug: product.slug! }));
    const outlet = await collectionPage(params({ slug, collectionSlug: "outlet" }));
    const envios = await customPage(params({ slug, pageSlug: "envios" }));

    const all: Metadata[] = [layout, home, productMeta, outlet, envios];
    for (const meta of all) {
      // Con openGraph propio, la página no hereda el de Marcolini.
      expect(meta.openGraph).toMatchObject({ siteName: brand.companyName, locale: "es_CO" });
      expect(JSON.stringify(meta)).not.toContain("Somos la plataforma");
    }
    // Lo que heredan las demás páginas de la tienda (carrito, búsqueda…).
    expect(layout).toMatchObject({
      description: "Esmaltes y placas de stamping.",
      openGraph: { title: brand.companyName, description: "Esmaltes y placas de stamping.", images: [{ url: LOGO }] },
    });
    expect(home.openGraph).toMatchObject({ title: brand.companyName, description: "Esmaltes y placas de stamping." });
    expect(productMeta.openGraph).toMatchObject({
      title: `Esmalte Chicago — ${brand.companyName}`,
      description: "Tono rojo cereza.",
      images: [{ url: "https://x/chicago.jpg" }],
    });
    // La colección de la pauta, sin descripción propia: la de la marca.
    expect(outlet.openGraph).toMatchObject({
      title: `Outlet — ${brand.companyName}`,
      description: "Esmaltes y placas de stamping.",
      images: [{ url: "https://x/outlet.jpg" }],
    });
    expect(envios.openGraph).toMatchObject({
      title: `Envíos — ${brand.companyName}`,
      description: "Enviamos a toda Colombia.",
      images: [{ url: LOGO }],
    });
  });
});
