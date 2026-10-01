import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { creatorVitrinaUrl, generateUniqueStorefrontSlug } from "@/lib/creator-identity";
import { BrandStoreConfigError, saveStorefrontSlug } from "@/server/services/brand-store-config-service";
import { buildProductLink } from "@/lib/brand-store-link";
import { ROOT_DOMAIN } from "@/lib/subdomain";
import { createBrand, hasDb } from "./helpers";

describe("links de producto desde la vitrina", () => {
  it("un producto de Mi tienda va a la tienda de la marca con el código", () => {
    expect(buildProductLink({ storeType: "OTHER" }, { url: "/t/hlacosedora/esmalte-rojo" }, "HEY12")).toBe(
      `https://hlacosedora.${ROOT_DOMAIN}/esmalte-rojo?ref=HEY12`,
    );
  });
});

describe.skipIf(!hasDb)("vitrina en subdominio", () => {
  it("marcas y creadores no comparten nombre", async () => {
    const name = `nombre-${randomUUID().slice(0, 6)}`;
    const brand = await createBrand();
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { storefrontSlug: name } });

    // Un creador nuevo con ese nombre recibe otro.
    expect(await generateUniqueStorefrontSlug(name)).toBe(`${name}-2`);
    // Y una marca no puede tomar el de un creador.
    const user = await prisma.user.create({ data: { email: `c-${randomUUID().slice(0, 8)}@prueba.test`, role: "CREATOR" } });
    const creatorSlug = `vitrina-${randomUUID().slice(0, 6)}`;
    await prisma.creatorProfile.create({
      data: { userId: user.id, displayName: "Vale", baseCode: `V${randomUUID().slice(0, 6)}`, storefrontSlug: creatorSlug },
    });
    const other = await createBrand();
    await prisma.brandProfile.update({ where: { id: other.id }, data: { storefrontSlug: null } });
    await expect(saveStorefrontSlug(other.id, creatorSlug)).rejects.toBeInstanceOf(BrandStoreConfigError);

    expect(await creatorVitrinaUrl(creatorSlug)).toBe(`https://${creatorSlug}.${ROOT_DOMAIN}`);
    // Choque de antes: la vitrina se queda en /c/.
    expect(await creatorVitrinaUrl(name)).toBe(`https://${ROOT_DOMAIN}/c/${name}`);
  });
});
