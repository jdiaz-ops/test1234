import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getPublishedTheme } from "@/server/services/brand-theme-store";
import { importShopifyProducts } from "@/server/services/shopify-csv-import-service";
import { applyMenuImport, previewMenuImport } from "@/server/services/storefront-menu-import-service";
import { listStorefrontMenuTree } from "@/server/services/store-page-service";
import { createBrand, hasDb } from "./helpers";

const product = (handle: string, name: string) => ({
  handle,
  name,
  description: "",
  price: 10000,
  compareAtPrice: null,
  images: [],
  sku: "",
  barcode: "",
  weight: null,
  weightUnit: "KG" as const,
  stock: null,
  status: "ACTIVE" as const,
  collectionName: null,
  hasVariants: false,
  optionNames: [],
  variants: [],
});

/// Lo que leería el encabezado de rumicol.com (WooCommerce), ya limpio.
const reader = async () => ({
  storeUrl: "https://rumicol.com/",
  theme: {
    menu: [
      { label: "HOME", href: "/" },
      {
        label: "NUESTROS PRODUCTOS",
        href: "#",
        children: [
          { label: "Semipermanentes", href: "/semipermanente" },
          {
            label: "Colecciones",
            href: "/categoria-producto/colecciones",
            children: [
              { label: "Colección cápsula", href: "/producto/capsula" },
              { label: "No existe", href: "/producto/no-existe" },
            ],
          },
          { label: "Blog", href: "/blog" },
        ],
      },
      { label: "LO NUEVO", href: "/categoria-producto/lo-nuevo" },
      { label: "DESCUENTOS", href: "/categoria-producto/colecciones-solas" },
    ],
  },
});

describe.skipIf(!hasDb)("traer el menú de la tienda original", () => {
  it("reemplaza el menú plano por el árbol, apuntando a lo que ya existe", async () => {
    const brand = await createBrand();
    await importShopifyProducts(brand.id, [product("capsula", "Colección cápsula")]);
    await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Colecciones", slug: "colecciones" } });
    await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Lo nuevo", slug: "lo-nuevo" } });
    // El menú viejo, plano.
    await prisma.storefrontMenuItem.createMany({
      data: [
        { brandId: brand.id, label: "HOME", url: "/", position: 0 },
        { brandId: brand.id, label: "Colección cápsula", url: "/capsula", position: 1 },
      ],
    });

    const preview = await previewMenuImport(brand.id, "rumicol.com", reader);
    expect(preview).toMatchObject({ storeUrl: "https://rumicol.com/", read: 9, current: 2 });
    expect(preview.items.map((i) => [i.label, i.url, i.children.length])).toEqual([
      ["HOME", "/", 0],
      ["NUESTROS PRODUCTOS", "#", 1],
      ["LO NUEVO", "/coleccion/lo-nuevo", 0],
    ]);
    // Sin equivalente: la página que no se importó, el blog, la categoría que no existe.
    expect(preview.dropped.map((d) => d.label)).toEqual(["Semipermanentes", "Blog", "No existe", "DESCUENTOS"]);
    // La vista previa no cambia nada.
    expect(await prisma.storefrontMenuItem.count({ where: { brandId: brand.id } })).toBe(2);

    const applied = await applyMenuImport(brand.id, "rumicol.com", reader);
    expect(applied.applied).toEqual({ items: 5, replaced: true });
    const tree = await listStorefrontMenuTree(brand.id);
    expect(tree.map((n) => [n.label, n.url, n.children.map((c) => [c.label, c.url, c.children.map((g) => [g.label, g.url])])])).toEqual([
      ["HOME", "/", []],
      ["NUESTROS PRODUCTOS", "#", [["Colecciones", "/coleccion/colecciones", [["Colección cápsula", "/capsula"]]]]],
      ["LO NUEVO", "/coleccion/lo-nuevo", []],
    ]);
    expect((await getPublishedTheme(brand.id)).header.mobile.menuStyle).toBe("hamburger");
  });

  it("sin menú en la tienda, avisa y no toca nada", async () => {
    const brand = await createBrand();
    await expect(applyMenuImport(brand.id, "x.com", async () => ({ storeUrl: "https://x.com/", theme: { menu: [] } }))).rejects.toThrow(/No se encontró un menú/);
  });
});
