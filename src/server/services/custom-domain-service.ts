import crypto from "crypto";
import dns from "node:dns/promises";
import { prisma } from "@/lib/prisma";
import { ROOT_DOMAIN } from "@/lib/subdomain";

/// Dominio propio de marca — gratis, verificado por DNS (registro TXT)
/// antes de que src/proxy.ts lo empiece a resolver como su tienda. Mover
/// el tráfico real (apuntar el dominio a Marcolini con un CNAME) es un
/// paso aparte, que hace la marca en su propio proveedor de DNS después de
/// verificar — acá solo se prueba que es dueña del dominio.

export class CustomDomainError extends Error {}

function normalizeDomain(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function isValidDomain(domain: string) {
  // Nada exhaustivo — solo lo suficiente para no guardar basura: letras,
  // números y guiones por segmento, al menos un punto.
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain);
}

export async function setCustomDomain(brandId: string, rawDomain: string) {
  const domain = normalizeDomain(rawDomain);
  if (!isValidDomain(domain)) {
    throw new CustomDomainError("Ese no parece un dominio válido — ej. tienda.tumarca.com");
  }
  if (domain === ROOT_DOMAIN || domain.endsWith(`.${ROOT_DOMAIN}`)) {
    throw new CustomDomainError("Ese dominio es de Marcolini — usa el tuyo propio.");
  }

  const existing = await prisma.brandProfile.findUnique({ where: { customDomain: domain } });
  if (existing && existing.id !== brandId) {
    throw new CustomDomainError("Ese dominio ya lo tiene otra marca.");
  }

  const token = crypto.randomBytes(16).toString("hex");
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: {
      customDomain: domain,
      customDomainVerificationToken: token,
      // Cambió el dominio (o se está pidiendo de nuevo) — hay que
      // reverificar, nunca se hereda la verificación de un dominio previo.
      customDomainVerifiedAt: null,
    },
  });
}

export async function removeCustomDomain(brandId: string) {
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: { customDomain: null, customDomainVerificationToken: null, customDomainVerifiedAt: null },
  });
}

/// Busca el registro TXT en _marcolini-verify.{dominio} y confirma que
/// contiene el token que le dimos a la marca. No mueve tráfico ni activa
/// nada de pagos — solo prueba propiedad del dominio.
export async function verifyCustomDomain(brandId: string) {
  const brand = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });
  if (!brand.customDomain || !brand.customDomainVerificationToken) {
    throw new CustomDomainError("Primero configura un dominio.");
  }

  let records: string[][];
  try {
    records = await dns.resolveTxt(`_marcolini-verify.${brand.customDomain}`);
  } catch {
    throw new CustomDomainError(
      "No encontramos el registro TXT todavía — el DNS puede tardar unos minutos en propagarse. Intenta de nuevo en un rato.",
    );
  }

  const found = records.some((chunks) => chunks.join("") === brand.customDomainVerificationToken);
  if (!found) {
    throw new CustomDomainError("El registro TXT no tiene el código correcto — revísalo y vuelve a intentar.");
  }

  return prisma.brandProfile.update({
    where: { id: brandId },
    data: { customDomainVerifiedAt: new Date() },
  });
}
