import { COLOMBIA_MUNICIPALITIES } from "@/lib/colombia-municipalities";

/// Código DANE de cada departamento de COLOMBIA_REGIONS (el que elige el
/// comprador en el checkout).
export const REGION_DANE_CODE: Record<string, string> = {
  Amazonas: "91",
  Antioquia: "05",
  Arauca: "81",
  Atlántico: "08",
  "Bogotá D.C.": "11",
  Bolívar: "13",
  Boyacá: "15",
  Caldas: "17",
  Caquetá: "18",
  Casanare: "85",
  Cauca: "19",
  Cesar: "20",
  Chocó: "27",
  Córdoba: "23",
  Cundinamarca: "25",
  Guainía: "94",
  Guaviare: "95",
  Huila: "41",
  "La Guajira": "44",
  Magdalena: "47",
  Meta: "50",
  Nariño: "52",
  "Norte de Santander": "54",
  Putumayo: "86",
  Quindío: "63",
  Risaralda: "66",
  "San Andrés y Providencia": "88",
  Santander: "68",
  Sucre: "70",
  Tolima: "73",
  "Valle del Cauca": "76",
  Vaupés: "97",
  Vichada: "99",
};

/// "Bogotá, D.C." → "BOGOTA DC": sin tildes, mayúsculas, sin puntuación.
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOWERCASE_WORDS = new Set(["de", "del", "la", "las", "los", "el", "y", "d.c."]);

/// "SAN ANDRÉS DE TUMACO" → "San Andrés de Tumaco".
function titleCase(name: string) {
  return name
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && LOWERCASE_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace("d.c.", "D.C.");
}

/// Municipios de un departamento, para sugerir la ciudad en el checkout.
export function municipalitiesOf(region: string): string[] {
  const dept = REGION_DANE_CODE[region];
  if (!dept) return [];
  return COLOMBIA_MUNICIPALITIES.filter(([code]) => code.startsWith(dept))
    .map(([, name]) => titleCase(name))
    .sort((a, b) => a.localeCompare(b, "es"));
}

/// Departamento y ciudad en código DANE, como los pide Dataico ("05" y
/// "001" para Medellín). La ciudad la escribe el comprador a mano, así que
/// se compara sin tildes ni mayúsculas y se aceptan nombres cortos que solo
/// pueden ser un municipio del departamento ("Cartagena" → "Cartagena de
/// Indias", "Tumaco" → "San Andrés de Tumaco"). Si no hay una única
/// coincidencia devuelve null — mejor sin dirección que con una ciudad
/// equivocada en una factura ante la DIAN.
export function resolveDaneLocation(region: string | null | undefined, city: string | null | undefined) {
  const dept = region ? REGION_DANE_CODE[region] : undefined;
  if (!dept) return null;
  const inDept = COLOMBIA_MUNICIPALITIES.filter(([code]) => code.startsWith(dept));
  // Bogotá es un solo municipio: lo que hayan escrito en la ciudad da igual.
  if (inDept.length === 1) return { department: dept, city: inDept[0][0].slice(2) };

  const wanted = normalize(city ?? "");
  if (!wanted) return null;
  const named = inDept.map(([code, name]) => ({ code, name: normalize(name) }));
  const exact = named.filter((m) => m.name === wanted);
  const matches =
    exact.length > 0
      ? exact
      : named.filter(
          (m) => m.name.startsWith(`${wanted} `) || m.name.endsWith(` ${wanted}`) || wanted.startsWith(`${m.name} `),
        );
  if (matches.length !== 1) return null;
  return { department: dept, city: matches[0].code.slice(2) };
}
