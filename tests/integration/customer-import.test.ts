import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  importStoreCustomers,
  listStoreCustomers,
  getStoreCustomerDetail,
  type ImportStoreCustomerRow,
} from "@/server/services/store-customer-service";
import { createBrand, hasDb } from "./helpers";

function row(email: string, extra: Partial<ImportStoreCustomerRow> = {}): ImportStoreCustomerRow {
  return {
    email,
    name: "Cliente Shopify",
    phone: "+573001112233",
    documentNumber: "1020304050",
    company: null,
    address: "Calle 1",
    address2: null,
    city: "Bogotá",
    region: "Bogotá D.C.",
    postalCode: null,
    countryCode: "CO",
    emailSubscribed: true,
    smsSubscribed: false,
    orderCount: 2,
    spentCents: 9_000_000,
    tags: ["shopify"],
    notes: null,
    shopifyCustomerId: "1",
    ...extra,
  };
}

describe.skipIf(!hasDb)("importar clientes de Shopify", () => {
  it("crea los nuevos, no duplica al repetir y se ven en la lista aunque no hayan comprado en Marcolini", async () => {
    const brand = await createBrand();
    const first = await importStoreCustomers(brand.id, [row("uno@prueba.test"), row("dos@prueba.test", { orderCount: 0, spentCents: 0 })]);
    expect(first).toEqual({ created: 2, updated: 0 });
    const again = await importStoreCustomers(brand.id, [row("uno@prueba.test", { emailSubscribed: false })]);
    expect(again).toEqual({ created: 0, updated: 1 });
    expect(await prisma.storeCustomer.count({ where: { brandId: brand.id } })).toBe(2);

    const list = await listStoreCustomers(brand.id);
    expect(list.total).toBe(2);
    expect(list.counts).toMatchObject({ "con-compras": 1, "sin-compras": 1, suscritos: 1 });
    // Una importación anterior se actualiza con el archivo nuevo.
    expect(list.customers.find((c) => c.email === "uno@prueba.test")).toMatchObject({ emailSubscribed: false, orderCount: 2 });

    const search = await listStoreCustomers(brand.id, { search: "1020304050" });
    expect(search.total).toBe(2);

    const detail = await getStoreCustomerDetail(brand.id, "dos@prueba.test");
    expect(detail).toMatchObject({ orderCount: 0, documentNumber: "1020304050", firstOrderAt: null });
  });

  it("a quien ya compró en Marcolini no le cambia la suscripción ni los datos que ya tenía", async () => {
    const brand = await createBrand();
    await prisma.storeCustomer.create({
      data: { brandId: brand.id, email: "marcolini@prueba.test", name: "Nombre Marcolini", emailSubscribed: false },
    });
    const result = await importStoreCustomers(brand.id, [row("marcolini@prueba.test", { emailSubscribed: true, tags: ["newsletter", "shopify"] })]);
    expect(result).toEqual({ created: 0, updated: 1 });
    const c = await prisma.storeCustomer.findUniqueOrThrow({
      where: { brandId_email: { brandId: brand.id, email: "marcolini@prueba.test" } },
    });
    expect(c).toMatchObject({
      name: "Nombre Marcolini",
      emailSubscribed: false,
      documentNumber: "1020304050",
      importedOrderCount: 2,
      importedAt: null,
    });
    expect(c.tags).toEqual(expect.arrayContaining(["newsletter", "shopify"]));
  });
});
