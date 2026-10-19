import Papa from "papaparse";
import { COLOMBIA_REGIONS } from "@/lib/colombia-regions";

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

// ----------------------------------------------------------------------------
// Cualquier CSV de clientes (pedido del 2026-10-19: "quitar mención de
// Shopify, más bien importar CSV"). Si el archivo es el de Shopify, se lee
// con todo su detalle (arriba); si no, se buscan las columnas por su nombre
// más común en español o inglés. Nadie queda suscrito a correos o SMS si el
// archivo no lo dice: no se puede suponer el permiso.
// ----------------------------------------------------------------------------

/// "Correo electrónico:" → "correo electronico".
function headerKey(header: string) {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const COLUMNS = {
  email: ["email", "correo", "correo electronico", "e mail", "mail", "email address"],
  fullName: ["nombre completo", "nombre y apellido", "nombres y apellidos", "name", "full name", "cliente"],
  firstName: ["nombre", "nombres", "first name"],
  lastName: ["apellido", "apellidos", "last name"],
  phone: ["telefono", "celular", "movil", "whatsapp", "phone", "telefono celular", "numero de celular", "numero de telefono"],
  document: ["cedula", "documento", "numero de documento", "cc", "nit", "identificacion", "cedula o nit"],
  address: ["direccion", "address", "direccion de envio"],
  city: ["ciudad", "city", "municipio"],
  region: ["departamento", "region", "provincia", "state", "province"],
  emailConsent: ["acepta correos", "acepta marketing", "suscrito", "suscrita", "newsletter", "acepta email marketing"],
  smsConsent: ["acepta sms", "acepta whatsapp", "acepta sms o whatsapp"],
} as const;

const REGION_BY_KEY = new Map(COLOMBIA_REGIONS.map((r) => [headerKey(r), r]));

function affirmative(value: string | undefined) {
  return ["si", "yes", "true", "1", "x", "acepta"].includes(headerKey(value ?? ""));
}

export function parseCustomersCsv(text: string): {
  customers: ImportCustomer[];
  stats: CustomersCsvStats;
  error: string | null;
} {
  const parsed = Papa.parse<Row>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const headers = parsed.meta.fields ?? [];
  if (headers.includes("Email") && headers.includes("Accepts Email Marketing")) return parseShopifyCustomersCsv(text);

  const stats: CustomersCsvStats = { rows: rows.length, withEmail: 0, withoutEmail: 0, emailSubscribed: 0, smsSubscribed: 0, withOrders: 0, withoutOrders: 0 };
  const byKey = new Map(headers.map((h) => [headerKey(h), h]));
  const column = (names: readonly string[]) => names.map((n) => byKey.get(n)).find((h): h is string => Boolean(h));
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([k, names]) => [k, column(names)])) as Record<keyof typeof COLUMNS, string | undefined>;
  if (!col.email) {
    return { customers: [], stats, error: "El archivo necesita una columna con el correo de cada cliente (Email o Correo)." };
  }

  const byEmail = new Map<string, ImportCustomer>();
  for (const row of rows) {
    const email = (row[col.email] ?? "").trim().toLowerCase();
    if (!email || !EMAIL.test(email)) {
      stats.withoutEmail++;
      continue;
    }
    const get = (key: keyof typeof COLUMNS) => (col[key] ? clean(row[col[key]!]) : null);
    const name = get("fullName") ?? ([get("firstName"), get("lastName")].filter(Boolean).join(" ") || null);
    const document = get("document");
    const region = get("region");
    byEmail.set(email, {
      email,
      name,
      phone: get("phone"),
      documentNumber: document ? document.replace(/[.\s]/g, "") : null,
      company: null,
      address: get("address"),
      address2: null,
      city: get("city"),
      region: region ? (REGION_BY_KEY.get(headerKey(region)) ?? region) : null,
      postalCode: null,
      countryCode: null,
      emailSubscribed: col.emailConsent ? affirmative(row[col.emailConsent]) : false,
      smsSubscribed: col.smsConsent ? affirmative(row[col.smsConsent]) : false,
      orderCount: 0,
      spentCents: 0,
      tags: ["importado"],
      notes: null,
      shopifyCustomerId: null,
    });
  }
  const customers = Array.from(byEmail.values());
  stats.withEmail = customers.length;
  for (const c of customers) {
    if (c.emailSubscribed) stats.emailSubscribed++;
    if (c.smsSubscribed) stats.smsSubscribed++;
    stats.withoutOrders++;
  }
  return { customers, stats, error: null };
}
