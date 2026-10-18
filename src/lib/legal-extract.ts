/// Datos del perfil de la marca sacados de los textos de su tienda
/// anterior (políticas, términos, contacto): razón social, NIT,
/// dirección, ciudad, correo, teléfono y una descripción corta. En
/// Colombia la política de privacidad casi siempre trae al responsable
/// con su NIT y dirección. Acá viven las reglas puras; la versión con IA
/// (brand-profile-extract-service.ts) las usa de respaldo campo por
/// campo. Ver conversación del 2026-10-18.

import { COLOMBIA_MUNICIPALITIES } from "@/lib/colombia-municipalities";

export type ExtractedProfile = {
  legalName: string | null;
  taxId: string | null;
  fiscalAddress: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
};

export const PROFILE_FIELD_LABELS: Record<keyof ExtractedProfile, string> = {
  legalName: "Razón social",
  taxId: "NIT",
  fiscalAddress: "Dirección",
  city: "Ciudad",
  email: "Correo",
  phone: "Teléfono",
  description: "Descripción corta",
};

export const MAX_DESCRIPTION = 150;

const EMPTY: ExtractedProfile = { legalName: null, taxId: null, fiscalAddress: null, city: null, email: null, phone: null, description: null };

function fold(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function squash(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

/// "MEDELLÍN" → "Medellín"; "BOGOTÁ, D.C." → "Bogotá".
function cityDisplay(name: string) {
  return name
    .replace(/,?\s*D\.?\s*C\.?$/i, "")
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((part) => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("")
    .trim();
}

/// Municipios que también son palabras o apellidos comunes: solo cuentan
/// si vienen con contexto ("ciudad de", "en", "Medellín, Colombia"…).
const AMBIGUOUS = new Set(
  ["bello", "soledad", "florida", "la paz", "paz", "victoria", "rosas", "belen", "carmen", "trinidad", "toledo", "sevilla", "genova", "marsella", "palestina", "salento", "caldas", "bolivar", "cordoba", "sucre", "narino", "sucre", "santander", "concepcion", "candelaria", "argentina", "colombia", "california", "barbosa", "restrepo", "mosquera", "madrid", "paris", "roma", "lebrija", "venecia", "america", "armenia", "union", "la union", "el retiro", "retiro", "granada", "guadalupe", "san jose", "san juan", "san pedro", "san luis", "santa rosa", "santa maria", "el paso", "la playa", "providencia", "libano", "pamplona", "zaragoza", "chile", "peru"].map(fold),
);

export function taxIdDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 11) return null;
  // Los 9 primeros son el NIT; si viene uno más, es el dígito de verificación.
  return digits.length >= 10 ? `${digits.slice(0, digits.length - 1)}-${digits.slice(-1)}` : digits;
}

export function findTaxId(text: string): string | null {
  const m = text.match(/\bN\.?\s?I\.?\s?T\.?\s*(?:No\.?|N[°º]\.?|número|:)?\s*[:.]?\s*((?:\d[\d.]{6,13})\s*-?\s*\d?)/i);
  if (!m) return null;
  return taxIdDigits(m[1]);
}

const COMPANY_SUFFIX = "(?:S\\.?\\s?A\\.?\\s?S\\.?|S\\s?A\\s?S|LTDA\\.?|S\\.?\\s?A\\.?|E\\.?\\s?U\\.?|S\\.?\\s?C\\.?\\s?A\\.?|S\\.?\\s?en\\s?C\\.?|BIC)";

export function findLegalName(text: string): string | null {
  // Sin distinguir mayúsculas: "Ltda." y "S.a.s." también se ven escritos así.
  const re = new RegExp(`([A-ZÁÉÍÓÚÑ][\\wÁÉÍÓÚÑáéíóúñ&'.-]*(?:\\s+[\\wÁÉÍÓÚÑáéíóúñ&'.-]+){0,7}?)\\s+${COMPANY_SUFFIX}(?![\\wÁÉÍÓÚÑáéíóúñ])`, "gi");
  const stop = /^(?:de|del|la|el|los|las|por|con|en|a|y|o|u|e|que|su|sus|tu|tus|al|un|una|es|son|como|para|sobre|según|segun|mediante|ante|entre|desde|hasta|sociedad|empresa|compañía|compania|marca|tienda|responsable|titular|nombre|razón|razon|social|identificada|identificado|denominada|denominado|llamada|llamado|la sociedad|la empresa)$/i;
  for (const m of text.matchAll(re)) {
    const words = m[1].split(/\s+/);
    // Se recortan las palabras de relleno al inicio ("...de la sociedad Beauty SAS").
    while (words.length > 0 && stop.test(words[0])) words.shift();
    while (words.length > 0 && /^[a-záéíóúñ]/.test(words[0]) && words.length > 1) words.shift();
    if (words.length === 0) continue;
    const suffix = m[0].slice(m[1].length).trim();
    const name = squash(`${words.join(" ")} ${suffix}`);
    if (name.length >= 6 && name.length <= 120) return name;
  }
  return null;
}

export function findEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (!m) return null;
  const email = m[0].toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(email) ? null : email.slice(0, 120);
}

export function findPhone(text: string): string | null {
  const m = text.match(/(?:\+?57[\s.-]?)?\(?3\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("57") ? digits.slice(2) : digits;
  return local.length === 10 ? `+57${local}` : null;
}

export function findAddress(text: string): string | null {
  const m = text.match(
    /\b(?:Calle|Cl\.?|Cll\.?|Carrera|Cra\.?|Cr\.?|Kr\.?|Kra\.?|Avenida|Av\.?|Ak\.?|Ac\.?|Diagonal|Dg\.?|Diag\.?|Transversal|Tv\.?|Tr\.?|Trans\.?)\s*\d{1,3}\s?[A-Za-z]?(?:\s?(?:Bis|bis|Sur|sur|Este|este|Norte|norte))?\s*(?:#|No\.?|N[°º]\.?|Nro\.?)\s*\d{1,3}\s?[A-Za-z]?(?:\s?(?:Bis|bis|Sur|sur|Este|este))?\s*-\s*\d{1,4}(?:[^.;\n]{0,60}?(?:Local|Oficina|Of\.|Bodega|Piso|Apto|Apartamento|Interior|Int\.|Torre)\s*[\w-]+)?/,
  );
  return m ? squash(m[0]).slice(0, 200) : null;
}

const MUNICIPALITY_KEYS = COLOMBIA_MUNICIPALITIES.map(([, name]) => ({ key: fold(name.replace(/,?\s*D\.?\s*C\.?$/i, "")), name }));

export function findCity(text: string): string | null {
  const folded = fold(text);
  let best: { index: number; name: string; length: number } | null = null;
  for (const { key, name } of MUNICIPALITY_KEYS) {
    if (key.length < 4) continue;
    const re = new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`);
    const m = re.exec(folded);
    if (!m) continue;
    const index = m.index + m[1].length;
    if (AMBIGUOUS.has(key)) {
      const before = folded.slice(Math.max(0, index - 25), index);
      const after = folded.slice(index + key.length, index + key.length + 25);
      if (!/(ciudad de|municipio de|en la ciudad|en|de|sede|ubicad[oa]s? en|domicili[oa]\w* en)\s*$/.test(before) && !/^\s*[,-]?\s*(colombia|d\.?c|antioquia|cundinamarca|valle|atlantico|santander|bolivar)/.test(after)) continue;
    }
    if (!best || index < best.index || (index === best.index && key.length > best.length)) best = { index, name, length: key.length };
  }
  return best ? cityDisplay(best.name) : null;
}

/// Texto de la propia tienda (botones, listas de productos, precios) que
/// WooCommerce suele poner como descripción de la página: no sirve de
/// descripción de la marca.
const STORE_UI_TEXT =
  /seleccionar opciones|a[ñn]adir al carrito|agregar al carrito|add to cart|leer m[aá]s|read more|m[uú]ltiples variantes|comprar ahora|ver producto|ver m[aá]s|\$\s?\d|\d[\d.,]*\s?(?:cop|usd)\b|en stock|agotado|iniciar sesi[oó]n|mi cuenta|carrito|checkout|env[ií]o gratis por compras/i;

export function shortDescription(text: string | null | undefined): string | null {
  const clean = squash((text ?? "").replace(/<[^>]+>/g, " "));
  if (clean.length < 20 || STORE_UI_TEXT.test(clean)) return null;
  if (clean.length <= MAX_DESCRIPTION) return clean;
  const cut = clean.slice(0, MAX_DESCRIPTION - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > 60 ? cut.slice(0, atWord) : cut).replace(/[,;:\s]+$/, "")}…`;
}

/// Reglas puras sobre los textos (políticas, términos, contacto…).
export function extractProfileByRules(input: { texts: string[]; metaDescription?: string | null }): ExtractedProfile {
  const text = input.texts.map(squash).join("\n");
  if (!text && !input.metaDescription) return { ...EMPTY };
  return {
    legalName: findLegalName(text),
    taxId: findTaxId(text),
    fiscalAddress: findAddress(text),
    city: findCity(text),
    email: findEmail(text),
    phone: findPhone(text),
    description: shortDescription(input.metaDescription),
  };
}

/// Deja cada campo limpio y acotado, venga de la IA o de las reglas.
export function sanitizeProfile(raw: Partial<Record<keyof ExtractedProfile, unknown>>): ExtractedProfile {
  const str = (v: unknown, max: number) => (typeof v === "string" && squash(v) ? squash(v).slice(0, max) : null);
  const taxId = typeof raw.taxId === "string" ? taxIdDigits(raw.taxId) : null;
  const emailRaw = str(raw.email, 120);
  const phoneRaw = str(raw.phone, 40);
  return {
    legalName: str(raw.legalName, 120),
    taxId,
    fiscalAddress: str(raw.fiscalAddress, 200),
    city: str(raw.city, 80),
    email: emailRaw ? findEmail(emailRaw) : null,
    phone: phoneRaw ? findPhone(phoneRaw) : null,
    description: shortDescription(str(raw.description, 400)),
  };
}

export function hasProfileData(profile: ExtractedProfile) {
  return Object.values(profile).some((v) => v !== null);
}
