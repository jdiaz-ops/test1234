import Papa from "papaparse";

/// Lee el CSV de clientes que exporta Shopify (Clientes → Exportar) para
/// importarlo en Mi tienda → Clientes. Corre en el navegador: el archivo
/// puede tener decenas de miles de filas y solo viajan al servidor los
/// datos ya limpios, por partes. Ver importStoreCustomers (2026-10-04).
///
/// Columnas que se usan:
///  - Email (obligatorio: sin correo no se importa — así identifica
///    Marcolini a cada cliente).
///  - First Name / Last Name → nombre.
///  - Phone o, si no hay, Default Address Phone → celular.
///  - Default Address Company → número de documento cuando son solo
///    números (las tiendas de Colombia lo usan para la cédula); si trae
///    letras se guarda como empresa.
///  - Dirección, ciudad, departamento (código de Shopify → nombre),
///    código postal y país.
///  - Accepts Email Marketing → suscrito a correos.
///  - Accepts SMS Marketing / Accepts WhatsApp Marketing → suscrito a SMS
///    y WhatsApp.
///  - Total Orders / Total Spent → historial de compras en Shopify.
///  - Tags → etiquetas (más "shopify").
///  - Fecha de nacimiento (metacampo) → en las notas.
/// No se usan: Tax Exempt, Note (viene vacía) ni el link de referidos de
/// Growave.

export type ImportCustomer = {
  email: string;
  name: string | null;
  phone: string | null;
  documentNumber: string | null;
  company: string | null;
  address: string | null;
  address2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  emailSubscribed: boolean;
  smsSubscribed: boolean;
  orderCount: number;
  spentCents: number;
  tags: string[];
  notes: string | null;
  shopifyCustomerId: string | null;
};

export type CustomersCsvStats = {
  rows: number;
  withEmail: number;
  withoutEmail: number;
  emailSubscribed: number;
  smsSubscribed: number;
  withOrders: number;
  withoutOrders: number;
};

/// Códigos de departamento de Shopify para Colombia → nombre de
/// COLOMBIA_REGIONS (el mismo que usa el checkout y los envíos).
const CO_PROVINCES: Record<string, string> = {
  AMA: "Amazonas",
  ANT: "Antioquia",
  ARA: "Arauca",
  ATL: "Atlántico",
  DC: "Bogotá D.C.",
  BOL: "Bolívar",
  BOY: "Boyacá",
  CAL: "Caldas",
  CAQ: "Caquetá",
  CAS: "Casanare",
  CAU: "Cauca",
  CES: "Cesar",
  CHO: "Chocó",
  COR: "Córdoba",
  CUN: "Cundinamarca",
  GUA: "Guainía",
  GUV: "Guaviare",
  HUI: "Huila",
  LAG: "La Guajira",
  MAG: "Magdalena",
  MET: "Meta",
  NAR: "Nariño",
  NSA: "Norte de Santander",
  PUT: "Putumayo",
  QUI: "Quindío",
  RIS: "Risaralda",
  SAP: "San Andrés y Providencia",
  SAN: "Santander",
  SUC: "Sucre",
  TOL: "Tolima",
  VAC: "Valle del Cauca",
  VAU: "Vaupés",
  VID: "Vichada",
};

type Row = Record<string, string>;

/// Shopify antepone un apóstrofo a teléfonos y fechas para que Excel no
/// los convierta en números ("'+573001234567").
function clean(value: string | undefined) {
  const v = (value ?? "").trim().replace(/^'/, "").trim();
  return v || null;
}

function yes(value: string | undefined) {
  return (value ?? "").trim().toLowerCase() === "yes";
}

function findColumn(row: Row, prefix: string) {
  const key = Object.keys(row).find((k) => k.startsWith(prefix));
  return key ? row[key] : undefined;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseShopifyCustomersCsv(text: string): {
  customers: ImportCustomer[];
  stats: CustomersCsvStats;
  error: string | null;
} {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const stats: CustomersCsvStats = {
    rows: rows.length,
    withEmail: 0,
    withoutEmail: 0,
    emailSubscribed: 0,
    smsSubscribed: 0,
    withOrders: 0,
    withoutOrders: 0,
  };
  if (rows.length === 0 || !("Email" in rows[0]) || !("Accepts Email Marketing" in rows[0])) {
    return {
      customers: [],
      stats,
      error: "Este no parece el archivo de clientes de Shopify. Expórtalo en Shopify → Clientes → Exportar (CSV).",
    };
  }

  // Si un correo se repite, queda la fila con más pedidos.
  const byEmail = new Map<string, ImportCustomer>();
  for (const row of rows) {
    const email = (row["Email"] ?? "").trim().toLowerCase();
    if (!email || !EMAIL.test(email)) {
      stats.withoutEmail++;
      continue;
    }

    const country = clean(row["Default Address Country Code"])?.toUpperCase() ?? null;
    const provinceCode = clean(row["Default Address Province Code"])?.toUpperCase() ?? null;
    const region =
      provinceCode && (country === "CO" || !country) && CO_PROVINCES[provinceCode]
        ? CO_PROVINCES[provinceCode]
        : provinceCode;

    const companyField = clean(row["Default Address Company"]);
    const looksLikeDocument = companyField ? /^[\d.\- ]{5,15}$/.test(companyField) : false;

    const spent = Number.parseFloat((row["Total Spent"] ?? "0").replace(/[^\d.]/g, "")) || 0;
    const orders = Number.parseInt(row["Total Orders"] ?? "0", 10) || 0;

    const birthDate = clean(findColumn(row, "Fecha de nacimiento"));
    const tags = (row["Tags"] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const name = [clean(row["First Name"]), clean(row["Last Name"])].filter(Boolean).join(" ") || null;

    const customer: ImportCustomer = {
      email,
      name,
      phone: clean(row["Phone"]) ?? clean(row["Default Address Phone"]),
      documentNumber: looksLikeDocument ? companyField!.replace(/[.\s]/g, "") : null,
      company: looksLikeDocument ? null : companyField,
      address: clean(row["Default Address Address1"]),
      address2: clean(row["Default Address Address2"]),
      city: clean(row["Default Address City"]),
      region,
      postalCode: clean(row["Default Address Zip"]),
      countryCode: country,
      emailSubscribed: yes(row["Accepts Email Marketing"]),
      smsSubscribed: yes(row["Accepts SMS Marketing"]) || yes(row["Accepts WhatsApp Marketing"]),
      orderCount: orders,
      spentCents: Math.round(spent * 100),
      tags: Array.from(new Set([...tags, "shopify"])),
      notes: birthDate ? `Cumpleaños: ${birthDate}` : null,
      shopifyCustomerId: clean(row["Customer ID"]),
    };

    const previous = byEmail.get(email);
    if (!previous || customer.orderCount > previous.orderCount) byEmail.set(email, customer);
  }

  const customers = Array.from(byEmail.values());
  stats.withEmail = customers.length;
  for (const c of customers) {
    if (c.emailSubscribed) stats.emailSubscribed++;
    if (c.smsSubscribed) stats.smsSubscribed++;
    if (c.orderCount > 0) stats.withOrders++;
    else stats.withoutOrders++;
  }
  return { customers, stats, error: null };
}
