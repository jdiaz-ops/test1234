import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  BrandStoreConfigError,
  resolveSlugRedirect,
  saveStorefrontSlug,
} from "@/server/services/brand-store-config-service";
import {
  BrandPaymentError,
  saveWompiCredentials,
  wompiStatus,
} from "@/server/services/brand-payment-service";
import { createBrand, hasDb } from "./helpers";

const slug = () => `tienda-${randomUUID().slice(0, 8)}`;

describe.skipIf(!hasDb)("link de la tienda", () => {
  it("la marca lo elige una vez; después solo Marcolini lo cambia y el viejo redirige", async () => {
    const brand = await createBrand();
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { storefrontSlug: null } });

    const first = slug();
    await saveStorefrontSlug(brand.id, first);
    await expect(saveStorefrontSlug(brand.id, slug())).rejects.toBeInstanceOf(BrandStoreConfigError);
    // Guardar el mismo no es un cambio.
    await expect(saveStorefrontSlug(brand.id, first)).resolves.toBeUndefined();

    const second = slug();
    await saveStorefrontSlug(brand.id, second, { byAdmin: true });
    expect((await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } })).storefrontSlug).toBe(second);
    expect(await resolveSlugRedirect(first)).toBe(second);

    // Otra marca no puede quedarse con el link viejo.
    const other = await createBrand();
    await expect(saveStorefrontSlug(other.id, first, { byAdmin: true })).rejects.toBeInstanceOf(BrandStoreConfigError);

    // Volver al link anterior: deja de ser redirección y el otro pasa a serlo.
    await saveStorefrontSlug(brand.id, first, { byAdmin: true });
    expect(await resolveSlugRedirect(first)).toBeNull();
    expect(await resolveSlugRedirect(second)).toBe(first);
  });
});

describe.skipIf(!hasDb)("llaves de Wompi", () => {
  it("conserva las llaves que no se mandan y no deja cobrar de verdad sin las de producción", async () => {
    const brand = await createBrand();
    await saveWompiCredentials(brand.userId, {
      paymentMode: "TEST",
      wompiPublicKeyTest: "pub_test_1",
      wompiPrivateKeyTest: "prv_test_1",
      wompiEventsKeyTest: "test_events_1",
      wompiIntegrityKeyTest: "test_integrity_1",
    });
    let profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(wompiStatus(profile)).toBe("TEST");

    // Cambia solo la pública: las secretas siguen ahí.
    await saveWompiCredentials(brand.userId, { paymentMode: "TEST", wompiPublicKeyTest: "pub_test_2" });
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.wompiPublicKeyTest).toBe("pub_test_2");
    expect(profile.wompiPrivateKeyTest).toBe("prv_test_1");

    await expect(
      saveWompiCredentials(brand.userId, { paymentMode: "PRODUCTION", wompiPublicKeyProd: "pub_prod_1" }),
    ).rejects.toBeInstanceOf(BrandPaymentError);
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(profile.paymentMode).toBe("TEST");

    await saveWompiCredentials(brand.userId, {
      paymentMode: "PRODUCTION",
      wompiPublicKeyProd: "pub_prod_1",
      wompiPrivateKeyProd: "prv_prod_1",
      wompiEventsKeyProd: "prod_events_1",
      wompiIntegrityKeyProd: "prod_integrity_1",
    });
    profile = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(wompiStatus(profile)).toBe("ACTIVE");
  });
});

describe.skipIf(!hasDb)("links de productos al elegir el link de la tienda", () => {
  it("los productos creados antes quedan con el link nuevo", async () => {
    const brand = await createBrand();
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { storefrontSlug: null } });
    const product = await prisma.product.create({
      data: {
        brandId: brand.id,
        externalId: `manual-${randomUUID().slice(0, 8)}`,
        manual: true,
        name: "Esmalte",
        price: 10000,
        url: "/t/mi-tienda/esmalte",
        slug: "esmalte",
      },
    });
    const nuevo = slug();
    await saveStorefrontSlug(brand.id, nuevo);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).url).toBe(`/t/${nuevo}/esmalte`);
  });
});
