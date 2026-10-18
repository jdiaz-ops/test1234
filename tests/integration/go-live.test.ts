import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { applyExtractedProfile } from "@/server/services/brand-profile-import-service";
import { getGoLiveChecklist, setGoLiveCheck } from "@/server/services/go-live-service";
import { createBrand, createPendingOrder, createProduct, createSellingBrand, hasDb } from "./helpers";
import { GET as sitemap } from "@/app/t/[slug]/sitemap.xml/route";
import { GET as robots } from "@/app/t/[slug]/robots.txt/route";

describe.skipIf(!hasDb)("lo que falta para vender", () => {
  it("calcula cada paso y deja marcar los manuales", async () => {
    const brand = await createBrand();
    const first = (await getGoLiveChecklist(brand.id))!;
    expect(first.total).toBe(8);
    const byKey = Object.fromEntries(first.items.map((i) => [i.key, i]));
    expect(byKey.productos.done).toBe(false);
    expect(byKey.inventario.done).toBe(true);
    expect(byKey.pagos.done).toBe(false);
    expect(byKey.envios.done).toBe(false);
    expect(byKey.fotos.done).toBe(true);
    expect(byKey.legal.done).toBe(false);
    expect(byKey.dominio.done).toBe(false);
    expect(byKey.prueba.done).toBe(false);
    expect(first.storeUrl).toContain(brand.storefrontSlug);

    await createProduct(brand.id, { name: "Sin control", price: 9000, stock: null });
    await setGoLiveCheck(brand.id, "dominio", true);
    await expect(setGoLiveCheck(brand.id, "pagos" as never, true)).rejects.toThrow();
    const second = (await getGoLiveChecklist(brand.id))!;
    const k2 = Object.fromEntries(second.items.map((i) => [i.key, i]));
    expect(k2.inventario.done).toBe(false);
    expect(k2.inventario.detail).toContain("1 producto se vende sin control");
    expect(k2.dominio.done).toBe(true);
    await setGoLiveCheck(brand.id, "inventario", true);
    await setGoLiveCheck(brand.id, "productos", true);
    expect(Object.fromEntries((await getGoLiveChecklist(brand.id))!.items.map((i) => [i.key, i.done]))).toMatchObject({
      productos: true,
      inventario: true,
    });
  });

  it("pagos, envíos, datos legales y pedido de prueba se marcan solos", async () => {
    const brand = await createSellingBrand();
    const placa = await createProduct(brand.id, { name: "Placa", price: 15000, stock: 3 });
    await createPendingOrder(brand.id, [{ productId: placa.id, quantity: 1, unitPrice: 15000 }]);
    await prisma.brandProfile.update({
      where: { id: brand.id },
      data: {
        legalName: "Marca S.A.S.",
        taxId: "900111222-3",
        wompiPublicKeyProd: "pub_prod_x",
        wompiPrivateKeyProd: "prv_prod_x",
        wompiEventsKeyProd: "prod_events_x",
        wompiIntegrityKeyProd: "prod_integrity_x",
        paymentMode: "PRODUCTION",
      },
    });
    const list = (await getGoLiveChecklist(brand.id))!;
    const k = Object.fromEntries(list.items.map((i) => [i.key, i.done]));
    expect(k).toMatchObject({ pagos: true, envios: true, legal: true, prueba: true, inventario: true, fotos: true });
    expect(list.complete).toBe(false);
    await setGoLiveCheck(brand.id, "productos", true);
    await setGoLiveCheck(brand.id, "dominio", true);
    expect((await getGoLiveChecklist(brand.id))!.complete).toBe(true);
  });

  it("sin tienda no hay lista", async () => {
    const brand = await createBrand();
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { storefrontSlug: null } });
    expect(await getGoLiveChecklist(brand.id)).toBeNull();
  });
});

describe.skipIf(!hasDb)("datos del perfil desde la tienda anterior", () => {
  it("llena solo lo vacío y pone el sitio web de Marcolini", async () => {
    const brand = await createBrand();
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { city: "Cali", phone: "+573000000000" } });
    const result = await applyExtractedProfile(brand.id, {
      legalName: "Beauty S.A.S.",
      taxId: "901234567-8",
      fiscalAddress: "Carrera 43A # 1-50",
      city: "Medellín",
      email: "datos@beauty.co",
      phone: "+573001542560",
      description: "Productos para uñas hechos de manicurista a manicurista",
    });
    expect(result.filled.sort()).toEqual(["description", "fiscalAddress", "legalName", "taxId", "websiteUrl"]);
    const saved = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(saved).toMatchObject({ legalName: "Beauty S.A.S.", taxId: "901234567-8", city: "Cali", phone: "+573000000000" });
    expect(saved.websiteUrl).toContain(brand.storefrontSlug);
    expect((await applyExtractedProfile(brand.id, { legalName: "Otra", taxId: null, fiscalAddress: null, city: null, email: null, phone: null, description: null })).filled).toEqual([]);
  });
});

describe.skipIf(!hasDb)("sitemap y robots de la tienda", () => {
  it("lista portada, colecciones, productos activos y páginas con el link público", async () => {
    const brand = await createBrand();
    const activo = await createProduct(brand.id, { name: "Activo", price: 1000, stock: 1 });
    const borrador = await createProduct(brand.id, { name: "Borrador", price: 1000, stock: 1 });
    await prisma.product.update({ where: { id: borrador.id }, data: { status: "DRAFT" } });
    await prisma.brandCollection.create({ data: { brandId: brand.id, name: "Esmaltes", slug: "esmaltes" } });
    await prisma.storePage.create({ data: { brandId: brand.id, title: "Envíos", slug: "envios", body: "<p>x</p>" } });
    const params = Promise.resolve({ slug: brand.storefrontSlug! });
    const res = await sitemap(new Request("http://x/sitemap.xml"), { params });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    const base = `https://${brand.storefrontSlug}.marcolini.lat`;
    expect(xml).toContain(`<loc>${base}/</loc>`);
    expect(xml).toContain(`<loc>${base}/coleccion/esmaltes</loc>`);
    expect(xml).toContain(`<loc>${base}/${activo.slug}</loc>`);
    expect(xml).not.toContain(`/${borrador.slug}<`);
    expect(xml).toContain(`<loc>${base}/pagina/envios</loc>`);
    expect(xml).toContain(`<loc>${base}/politica-de-privacidad</loc>`);

    const robotsRes = await robots(new Request("http://x/robots.txt"), { params });
    const txt = await robotsRes.text();
    expect(txt).toContain("Allow: /");
    expect(txt).toContain("Disallow: /checkout");
    expect(txt).toContain(`Sitemap: ${base}/sitemap.xml`);
    expect((await sitemap(new Request("http://x/sitemap.xml"), { params: Promise.resolve({ slug: "no-existe-xyz" }) })).status).toBe(404);
  });
});
