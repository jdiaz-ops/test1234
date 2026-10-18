import { rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { importShopifyCollections } from "@/server/services/shopify-collections-import-service";
import { importShopifyProducts } from "@/server/services/shopify-csv-import-service";
import { importShopifyPages } from "@/server/services/shopify-pages-import-service";
import {
  fallbackCollectionTarget,
  normalizeOldPath,
  oldCollectionTarget,
  oldPageTarget,
  oldPolicyTarget,
  resolveRedirect,
  saveRedirects,
} from "@/server/services/storefront-redirect-service";
import { createBrand, hasDb } from "./helpers";

function product(handle: string, name: string) {
  return {
    handle,
    name,
    description: "",
    price: 10000,
    compareAtPrice: null,
    images: [] as string[],
    sku: "",
    barcode: "",
    weight: null,
    weightUnit: "KG" as const,
    stock: null,
    status: "ACTIVE" as const,
    collectionName: null,
    hasVariants: false,
    optionNames: [] as string[],
    variants: [],
  };
}

describe("normalizeOldPath", () => {
  it("deja la ruta en minúsculas, sin query ni barra final", () => {
    expect(normalizeOldPath("/Collections/Gel-Polish/?sort=x")).toBe("/collections/gel-polish");
    expect(normalizeOldPath("collections//tips#a")).toBe("/collections/tips");
    expect(normalizeOldPath("/pages/qui%C3%A9nes-somos")).toBe("/pages/quiénes-somos");
    expect(normalizeOldPath("/")).toBe("/");
  });
});

describe.skipIf(!hasDb)("links viejos de la tienda anterior", () => {
  it("guarda y resuelve redirecciones sin repetir ni apuntar a sí mismas", async () => {
    const brand = await createBrand();
    const n = await saveRedirects(brand.id, [
      { fromPath: "/collections/azules", toPath: "/coleccion/gel-polish" },
      { fromPath: "/collections/azules/", toPath: "/coleccion/gel-polish" },
      { fromPath: "/", toPath: "/coleccion" },
      { fromPath: "/x", toPath: "/x" },
    ]);
    expect(n).toBe(1);
    expect(await resolveRedirect(brand.id, "/Collections/Azules?x=1")).toBe("/coleccion/gel-polish");
    expect(await resolveRedirect(brand.id, "/collections/otra")).toBeNull();
    await saveRedirects(brand.id, [{ fromPath: "/collections/azules", toPath: "/coleccion/otra" }]);
    expect(await resolveRedirect(brand.id, "/collections/azules")).toBe("/coleccion/otra");
  });

  it("la importación de colecciones deja redirecciones del handle y de las unidas", async () => {
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [product("gp-az", "Gel Polish Azules"), product("gp-rs", "Gel Polish Rosados")]);
    await importShopifyCollections(brand.id, {
      collections: [{ handle: "gel-polish", name: "Gel Polish", productHandles: ["gp-az", "gp-rs"] }],
      aliases: { "gel-polish": ["gel-polish-azules", "gel-polish-rosados"] },
    });
    expect(await oldCollectionTarget(brand.id, "gel-polish-azules")).toBe("/coleccion/gel-polish");
    expect(await oldCollectionTarget(brand.id, "gel-polish-rosados")).toBe("/coleccion/gel-polish");
    expect(await oldCollectionTarget(brand.id, "gel-polish")).toBe("/coleccion/gel-polish");
    // Sin fila: por slug, y de últimas la lista de colecciones.
    await prisma.storefrontRedirect.deleteMany({ where: { brandId: brand.id } });
    expect(await oldCollectionTarget(brand.id, "Gel-Polish")).toBe("/coleccion/gel-polish");
    expect(await oldCollectionTarget(brand.id, "no-existe")).toBe("/coleccion");
    expect(await oldCollectionTarget(brand.id, "all")).toBe("/coleccion");
  });

  it("páginas y políticas importadas conservan su link viejo", async () => {
    const brand = await createBrand();
    const result = await importShopifyPages(brand.id, [
      { handle: "quienes-somos", title: "Quiénes somos", body: "<p>Hola</p>", kind: "page" },
      { handle: "shipping-policy", title: "Política de envíos", body: "<p>Envíos</p>", kind: "policy" },
    ]);
    const slugs = Object.fromEntries(result.pages.map((p) => [p.handle, p.slug]));
    expect(await oldPageTarget(brand.id, "quienes-somos")).toBe(`/pagina/${slugs["quienes-somos"]}`);
    expect(await oldPolicyTarget(brand.id, "shipping-policy")).toBe(`/pagina/${slugs["shipping-policy"]}`);
    // Repetir la importación (página ya existente) mantiene la redirección.
    await prisma.storefrontRedirect.deleteMany({ where: { brandId: brand.id } });
    await importShopifyPages(brand.id, [{ handle: "quienes-somos", title: "Quiénes somos", body: "<p>Hola</p>", kind: "page" }]);
    expect(await oldPageTarget(brand.id, "quienes-somos")).toBe(`/pagina/${slugs["quienes-somos"]}`);
    // Sin fila: por slug o por el título de la política; si no, portada o privacidad.
    await prisma.storefrontRedirect.deleteMany({ where: { brandId: brand.id } });
    expect(await oldPageTarget(brand.id, slugs["quienes-somos"])).toBe(`/pagina/${slugs["quienes-somos"]}`);
    expect(await oldPolicyTarget(brand.id, "shipping-policy")).toBe(`/pagina/${slugs["shipping-policy"]}`);
    expect(await oldPageTarget(brand.id, "nada")).toBe("/");
    expect(await oldPolicyTarget(brand.id, "privacy-policy")).toBe("/politica-de-privacidad");
    expect(await oldPolicyTarget(brand.id, "refund-policy")).toBe("/");
  });

  it("las fotos dentro de la descripción de un producto también se copian a Marcolini", async () => {
    const { countExternalImages, rehostImages } = await import("@/server/services/image-rehost-service");
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [
      {
        ...product("desc-01", "Con foto en la descripción"),
        description: '<p>Mira:</p><img src="https://cdn.shopify.com/s/files/d.png" alt="x"><p>Fin</p>',
      },
    ]);
    expect(await countExternalImages(brand.id)).toEqual({ total: 1 });
    const PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    );
    const fakeFetch = async () => new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
    const result = await rehostImages(brand.id, { limit: 5 }, fakeFetch);
    expect(result.saved).toHaveLength(1);
    expect(result.remaining).toBe(0);
    const saved = await prisma.product.findFirstOrThrow({ where: { brandId: brand.id }, select: { description: true } });
    expect(saved.description).not.toContain("cdn.shopify.com");
    expect(saved.description).toMatch(/src="\/uploads\/marcas\/.+\/fotos\/[a-f0-9]+\.webp"/);
    await rm(path.join(process.cwd(), "public", result.saved[0].newUrl), { force: true });
  });
});

describe.skipIf(!hasDb)("colección que ya no tiene ese slug", () => {
  it("se resuelve por el redirect viejo, por nombre o por parecido, y si no, a todas las categorías", async () => {
    const brand = await createBrand();
    await prisma.brandCollection.createMany({
      data: [
        { brandId: brand.id, name: "Extensiones y tips", slug: "extensiones-y-tips", position: 0 },
        { brandId: brand.id, name: "Gel Polish", slug: "gel-polish", position: 1 },
      ],
    });
    // Nombre igual, slug distinto (la marca renombró el slug).
    expect(await fallbackCollectionTarget(brand.id, "gel-polish-2")).toBe("/coleccion/gel-polish");
    // Parecido: "extensiones" está dentro de "extensiones-y-tips".
    expect(await fallbackCollectionTarget(brand.id, "extensiones")).toBe("/coleccion/extensiones-y-tips");
    // Nada parecido: todas las categorías.
    expect(await fallbackCollectionTarget(brand.id, "pedicura")).toBe("/coleccion");
    // Un redirect guardado de la tienda anterior manda.
    await saveRedirects(brand.id, [{ fromPath: "/collections/pedicura", toPath: "/coleccion/gel-polish" }]);
    expect(await fallbackCollectionTarget(brand.id, "pedicura")).toBe("/coleccion/gel-polish");
    // Sin colecciones no hay a dónde mandar.
    const empty = await createBrand();
    expect(await fallbackCollectionTarget(empty.id, "extensiones")).toBeNull();
  });
});
