import { describe, expect, it } from "vitest";
import { parseShopifyCustomersCsv } from "@/lib/shopify-customers-csv";

const HEADER =
  "Customer ID,First Name,Last Name,Email,Accepts Email Marketing,Default Address Company,Default Address Address1,Default Address Address2,Default Address City,Default Address Province Code,Default Address Country Code,Default Address Zip,Default Address Phone,Phone,Accepts SMS Marketing,Total Spent,Total Orders,Note,Tax Exempt,Tags,Accepts WhatsApp Marketing,Fecha de nacimiento (customer.metafields.facts.birth_date),GW Referral link (customer.metafields.growave.referral_link)";

const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("CSV de clientes de Shopify", () => {
  it("convierte cada columna a lo que guarda Marcolini", () => {
    const { customers, stats, error } = parseShopifyCustomersCsv(
      csv(
        "'111,Ana,Pérez,ANA@Correo.com,yes,1.020.304.050,Calle 1 # 2-3,Apto 4,Bogotá,DC,CO,110111,'+573001112233,,no,150000.00,3,,no,\"newsletter, gw_form\",no,'1990-05-02,",
      ),
    );
    expect(error).toBeNull();
    expect(stats).toMatchObject({ rows: 1, withEmail: 1, emailSubscribed: 1, smsSubscribed: 0, withOrders: 1 });
    expect(customers[0]).toEqual({
      email: "ana@correo.com",
      name: "Ana Pérez",
      phone: "+573001112233",
      documentNumber: "1020304050",
      company: null,
      address: "Calle 1 # 2-3",
      address2: "Apto 4",
      city: "Bogotá",
      region: "Bogotá D.C.",
      postalCode: "110111",
      countryCode: "CO",
      emailSubscribed: true,
      smsSubscribed: false,
      orderCount: 3,
      spentCents: 15_000_000,
      tags: ["newsletter", "gw_form", "shopify"],
      notes: "Cumpleaños: 1990-05-02",
      shopifyCustomerId: "111",
    });
  });

  it("empresa con letras va como empresa; SMS o WhatsApp cuentan como SMS; sin correo se omite", () => {
    const { customers, stats } = parseShopifyCustomersCsv(
      csv(
        "1,Sal,Ón,salon@uñas.co,no,Salón Bella SAS,,,Medellín,ANT,CO,,,'+573000000000,yes,0.00,0,,no,,no,,",
        "2,Sin,Correo,,yes,,,,Cali,VAC,CO,,,'+573009999999,no,10.00,1,,no,,no,,",
      ),
    );
    expect(stats).toMatchObject({ rows: 2, withEmail: 1, withoutEmail: 1, smsSubscribed: 1, withoutOrders: 1 });
    expect(customers[0]).toMatchObject({ company: "Salón Bella SAS", documentNumber: null, region: "Antioquia", smsSubscribed: true });
  });

  it("un archivo que no es de clientes se rechaza con un mensaje claro", () => {
    expect(parseShopifyCustomersCsv("Handle,Title\nplaca,Placa").error).toMatch(/clientes de Shopify/);
  });
});
