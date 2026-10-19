import { describe, expect, it } from "vitest";
import { toShopifyMenuHref, translateStoreMenu } from "@/server/services/storefront-menu-import-service";
import { buildMenuItems } from "@/server/services/shopify-collections-import-service";

const ORIGIN = "https://rumicol.com";
const PAGES = new Set(["semipermanente", "se-mayorista"]);

describe("traer el menú de la tienda original", () => {
  it("traduce los links de WooCommerce a la forma de Shopify y deja pasar los que ya lo están", () => {
    expect(toShopifyMenuHref("/categoria-producto/colecciones", ORIGIN, PAGES)).toBe("/collections/colecciones");
    expect(toShopifyMenuHref("/producto/capsula-de-moda", ORIGIN, PAGES)).toBe("/products/capsula-de-moda");
    expect(toShopifyMenuHref("/semipermanente", ORIGIN, PAGES)).toBe("/pages/semipermanente");
    expect(toShopifyMenuHref("/tutoriales", ORIGIN, PAGES)).toBeNull();
    expect(toShopifyMenuHref("#", ORIGIN, PAGES)).toBe("#");
    expect(toShopifyMenuHref("/", ORIGIN, PAGES)).toBe("/");
    expect(toShopifyMenuHref("/collections/soft-gel", ORIGIN, PAGES)).toBe("/collections/soft-gel");
    expect(toShopifyMenuHref("/pages/contacto", ORIGIN, PAGES)).toBe("/pages/contacto");
    expect(toShopifyMenuHref("https://instagram.com/rumi", ORIGIN, PAGES)).toBe("https://instagram.com/rumi");
  });

  it("traduce el árbol completo: un padre sin equivalente pero con submenú queda como '#'", () => {
    const tree = translateStoreMenu(
      [
        { label: "HOME", href: "/" },
        {
          label: "NUESTROS PRODUCTOS",
          href: "#",
          children: [
            { label: "Semipermanentes", href: "/semipermanente" },
            { label: "Colecciones", href: "/categoria-producto/colecciones", children: [{ label: "Cápsula", href: "/producto/capsula" }] },
            { label: "Blog", href: "/blog" },
          ],
        },
        { label: "TUTORIALES", href: "/tutoriales", children: [{ label: "Básico", href: "/tutoriales/basico" }] },
      ],
      ORIGIN,
      PAGES,
    );
    expect(tree).toEqual([
      { label: "HOME", href: "/" },
      {
        label: "NUESTROS PRODUCTOS",
        href: "#",
        children: [
          { label: "Semipermanentes", href: "/pages/semipermanente" },
          { label: "Colecciones", href: "/collections/colecciones", children: [{ label: "Cápsula", href: "/products/capsula" }] },
        ],
      },
    ]);
  });

  it("buildMenuItems apunta a la vitrina y devuelve lo que no tiene equivalente", () => {
    const maps = {
      collectionSlugByHandle: new Map([["colecciones", "colecciones"]]),
      productSlugByHandle: new Map([["capsula", "capsula-de-moda"]]),
      pageSlugByHandle: new Map([["semipermanente", "semipermanente"]]),
    };
    const { items, dropped } = buildMenuItems(
      [
        { label: "HOME", href: "/" },
        {
          label: "NUESTROS PRODUCTOS",
          href: "#",
          children: [
            { label: "Semipermanentes", href: "/pages/semipermanente" },
            { label: "Colecciones", href: "/collections/colecciones", children: [{ label: "Cápsula", href: "/products/capsula" }, { label: "No existe", href: "/products/nada" }] },
          ],
        },
        { label: "Vacío", href: "#", children: [{ label: "Nada", href: "/collections/nada" }] },
      ],
      maps,
    );
    expect(items).toEqual([
      { label: "HOME", url: "/", children: [] },
      {
        label: "NUESTROS PRODUCTOS",
        url: "#",
        children: [
          { label: "Semipermanentes", url: "/pagina/semipermanente", children: [] },
          { label: "Colecciones", url: "/coleccion/colecciones", children: [{ label: "Cápsula", url: "/capsula-de-moda", children: [] }] },
        ],
      },
    ]);
    expect(dropped).toEqual([
      { label: "No existe", href: "/products/nada" },
      { label: "Nada", href: "/collections/nada" },
      { label: "Vacío", href: "#" },
    ]);
  });
});
