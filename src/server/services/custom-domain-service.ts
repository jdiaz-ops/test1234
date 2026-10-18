import crypto from "crypto";
import dns from "node:dns/promises";
import { prisma } from "@/lib/prisma";
import { ROOT_DOMAIN } from "@/lib/subdomain";
import {
  addDomainToVercel,
  getVercelDomainStatus,
  recommendedDnsRecords,
  removeDomainFromVercel,
  vercelDomainsConfigured,
  type DnsRecord,
} from "@/server/integrations/vercel-domains";

/// Dominio propio de marca — gratis, verificado por DNS (registro TXT)
/// antes de que src/proxy.ts lo empiece a resolver como su tienda. Al
/// verificarlo, el dominio se registra en el proyecto de Vercel (ver
/// vercel-domains.ts; sin VERCEL_API_TOKEN sigue siendo un paso manual
/// del equipo) y la marca ve qué registro DNS poner para mover el tráfico
/// real. Ver conversación del 2026-10-18.

export class CustomDomainError extends Error {}

export type CustomDomainStatus = {
  domain: string | null;
  verified: boolean;
  vercel: {
    /// Marcolini registra el dominio en Vercel solo (hay token).
    automatic: boolean;
    registered: boolean;
    /// Si otra cuenta de Vercel tenía el dominio, Vercel pide este TXT.
    verification: DnsRecord[];
    /// El DNS ya apunta a Vercel.
    configured: boolean;
    /// Qué poner en el DNS.
    records: DnsRecord[];
    error: string | null;
  };
};

/// Registra el dominio en Vercel. Nunca frena la verificación: si falla,
/// el estado lo cuenta y el equipo lo termina a mano.
async function registerInVercel(domain: string): Promise<string | null> {
  if (!vercelDomainsConfigured()) return null;
  try {
    await addDomainToVercel(domain);
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar el dominio en Vercel.";
    console.error(`[dominio] ${domain}:`, message);
    return message;
  }
}

async function unregisterInVercel(domain: string | null) {
  if (!domain || !vercelDomainsConfigured()) return;
  try {
    await removeDomainFromVercel(domain);
  } catch (err) {
    console.error(`[dominio] quitar ${domain}:`, err instanceof Error ? err.message : err);
  }
}

export async function getCustomDomainStatus(brandId: string): Promise<CustomDomainStatus> {
  const brand = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: { customDomain: true, customDomainVerifiedAt: true },
  });
  const domain = brand.customDomain;
  const verified = Boolean(domain && brand.customDomainVerifiedAt);
  const automatic = vercelDomainsConfigured();
  const base: CustomDomainStatus["vercel"] = {
    automatic,
    registered: false,
    verification: [],
    configured: false,
    records: domain ? recommendedDnsRecords(domain, null, null) : [],
    error: null,
  };
  if (!domain || !verified || !automatic) return { domain, verified, vercel: base };
  try {
    const status = await getVercelDomainStatus(domain);
    return {
      domain,
      verified,
      vercel: { ...base, registered: status.registered, verification: status.verification, configured: status.configured, records: status.records },
    };
  } catch (err) {
    return { domain, verified, vercel: { ...base, error: err instanceof Error ? err.message : "No se pudo consultar Vercel." } };
  }
}

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

  const current = await prisma.brandProfile.findUnique({ where: { id: brandId }, select: { customDomain: true } });
  if (current?.customDomain && current.customDomain !== domain) await unregisterInVercel(current.customDomain);

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
  const current = await prisma.brandProfile.findUnique({ where: { id: brandId }, select: { customDomain: true } });
  await unregisterInVercel(current?.customDomain ?? null);
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

  const updated = await prisma.brandProfile.update({
    where: { id: brandId },
    data: { customDomainVerifiedAt: new Date() },
  });
  const vercelError = await registerInVercel(brand.customDomain);
  return { brand: updated, vercelError };
}
