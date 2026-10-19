import crypto from "crypto";
import dns from "node:dns/promises";
import { prisma } from "@/lib/prisma";
import { ROOT_DOMAIN } from "@/lib/subdomain";
import { companionDomain } from "@/lib/custom-domain";
import { createNotification } from "@/server/services/notification-service";
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
/// del equipo, y se le avisa) y la marca ve qué registro DNS poner para
/// mover el tráfico real. Ver conversación del 2026-10-18.
///
/// Que sea de la marca no basta para cambiar los links: solo cuando
/// https://{dominio} de verdad abre Marcolini (checkCustomDomainLive) queda
/// activo (customDomainActiveAt) y recién ahí los links, correos, pagos y el
/// mapa del sitio pasan al dominio, y el subdominio redirige a la misma
/// página allá (pedido del 2026-10-19: "que no se rompa ninguna URL"). Si
/// después deja de responder, vuelve al subdominio y se le avisa a la marca.

export class CustomDomainError extends Error {}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type CustomDomainStatus = {
  domain: string | null;
  verified: boolean;
  /// Ya abre la tienda: los links usan el dominio propio.
  active: boolean;
  checkedAt: string | null;
  /// La otra forma del dominio que también abre la tienda (www).
  companion: string | null;
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

function storeSubdomain(slug: string | null) {
  return slug ? `${slug}.${ROOT_DOMAIN}` : ROOT_DOMAIN;
}

async function notify(userId: string, type: string, content: Record<string, string>) {
  try {
    await createNotification(userId, type, content);
  } catch (err) {
    console.error(`[dominio] no se pudo avisar (${type}):`, err);
  }
}

/// Cuando el dominio necesita que alguien de Marcolini lo agregue en Vercel
/// (no hay token, o la API falló): a los Propietarios, como los demás
/// avisos de admin.
async function notifyAdmins(brand: { companyName: string }, domain: string, detail: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", adminRole: "OWNER" }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, "CUSTOM_DOMAIN_ADMIN", { marca: brand.companyName, dominio: domain, detalle: detail })));
}

/// Registra el dominio en Vercel (y su www, que lleva al principal). Nunca
/// frena la verificación: si falla, el estado lo cuenta y el equipo lo
/// termina a mano.
async function registerInVercel(domain: string, fetchImpl?: FetchLike): Promise<string | null> {
  if (!vercelDomainsConfigured()) return null;
  try {
    await addDomainToVercel(domain, fetchImpl);
    const companion = companionDomain(domain);
    if (companion) await addDomainToVercel(companion, fetchImpl, domain);
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo registrar el dominio en Vercel.";
    console.error(`[dominio] ${domain}:`, message);
    return message;
  }
}

async function unregisterInVercel(domain: string | null) {
  if (!domain || !vercelDomainsConfigured()) return;
  for (const name of [domain, companionDomain(domain)]) {
    if (!name) continue;
    try {
      await removeDomainFromVercel(name);
    } catch (err) {
      console.error(`[dominio] quitar ${name}:`, err instanceof Error ? err.message : err);
    }
  }
}

/// Firma que responde /api/dominio/ping: prueba que quien contesta en ese
/// dominio es Marcolini (y no una página de parqueo del registrador).
export function domainPingSignature(host: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "marcolini";
  return crypto.createHmac("sha256", secret).update(`dominio:${host.toLowerCase()}`).digest("hex").slice(0, 32);
}

type CheckDeps = { fetchImpl?: FetchLike; now?: Date; retryDelayMs?: number; attempts?: number };

/// Si https://{dominio} ya abre Marcolini: el DNS apunta, el certificado
/// está listo y la petición llega a esta app. Dos intentos por defecto,
/// para que un tropiezo de la red no cambie los links.
export async function checkCustomDomainLive(domain: string, deps: CheckDeps = {}): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  for (let attempt = 0; attempt < (deps.attempts ?? 2); attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, deps.retryDelayMs ?? 3000));
    try {
      const res = await fetchImpl(`https://${domain}/api/dominio/ping`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { sig?: string } | null;
        if (body?.sig === domainPingSignature(domain)) return true;
      }
    } catch {
      // Sin DNS, sin certificado todavía o sin respuesta: se intenta de nuevo.
    }
  }
  return false;
}

/// Revisa el dominio de una marca y lo activa o desactiva. Lo llaman la
/// verificación, Configuración (al abrir y con "Revisar conexión") y el
/// cron diario. Si Vercel tiene token y el dominio todavía no está
/// registrado (ej. el token se puso después), lo registra.
export async function refreshCustomDomain(
  brandId: string,
  deps: CheckDeps = {},
): Promise<{ active: boolean; changed: "activated" | "deactivated" | null }> {
  const brand = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: { userId: true, storefrontSlug: true, customDomain: true, customDomainVerifiedAt: true, customDomainActiveAt: true },
  });
  const domain = brand.customDomain;
  if (!domain || !brand.customDomainVerifiedAt) return { active: false, changed: null };
  const now = deps.now ?? new Date();

  // (Si falla, queda en el log: el aviso al equipo ya salió al verificar.)
  if (!brand.customDomainActiveAt && vercelDomainsConfigured()) {
    const status = await getVercelDomainStatus(domain, deps.fetchImpl).catch(() => null);
    if (status && !status.registered) await registerInVercel(domain, deps.fetchImpl);
  }

  const live = await checkCustomDomainLive(domain, deps);
  const subdominio = storeSubdomain(brand.storefrontSlug);
  if (live) {
    const activated = !brand.customDomainActiveAt;
    await prisma.brandProfile.update({
      where: { id: brandId },
      data: { customDomainActiveAt: brand.customDomainActiveAt ?? now, customDomainCheckedAt: now },
    });
    if (activated) await notify(brand.userId, "CUSTOM_DOMAIN_ACTIVE", { dominio: domain, subdominio });
    return { active: true, changed: activated ? "activated" : null };
  }

  // Dejó de abrir la tienda: de vuelta al subdominio, que nunca deja de
  // funcionar, para no mandar compradores a un dominio caído.
  const deactivated = Boolean(brand.customDomainActiveAt);
  await prisma.brandProfile.update({
    where: { id: brandId },
    data: { customDomainActiveAt: null, customDomainCheckedAt: now },
  });
  if (deactivated) await notify(brand.userId, "CUSTOM_DOMAIN_DOWN", { dominio: domain, subdominio });
  return { active: false, changed: deactivated ? "deactivated" : null };
}

/// Cron diario (ver /api/cron/dominios): todos los dominios verificados,
/// los que esperan el DNS y los que ya están activos. De a 5 a la vez: uno
/// que no responde tarda unos segundos.
export async function refreshAllCustomDomains(deps: CheckDeps = {}) {
  const brands = await prisma.brandProfile.findMany({
    where: { customDomain: { not: null }, customDomainVerifiedAt: { not: null } },
    select: { id: true },
    orderBy: { customDomainCheckedAt: { sort: "asc", nulls: "first" } },
    take: 300,
  });
  const result = { checked: 0, active: 0, activated: 0, deactivated: 0 };
  const queue = brands.map((b) => b.id);
  async function worker() {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        const r = await refreshCustomDomain(id, deps);
        result.checked++;
        if (r.active) result.active++;
        if (r.changed === "activated") result.activated++;
        if (r.changed === "deactivated") result.deactivated++;
      } catch (err) {
        console.error(`[dominio] revisar ${id}:`, err);
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  return result;
}

export async function getCustomDomainStatus(brandId: string, deps: { fetchImpl?: FetchLike } = {}): Promise<CustomDomainStatus> {
  const brand = await prisma.brandProfile.findUniqueOrThrow({
    where: { id: brandId },
    select: { customDomain: true, customDomainVerifiedAt: true, customDomainActiveAt: true, customDomainCheckedAt: true },
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
  const status = {
    domain,
    verified,
    active: Boolean(domain && brand.customDomainActiveAt),
    checkedAt: brand.customDomainCheckedAt?.toISOString() ?? null,
    companion: domain ? companionDomain(domain) : null,
  };
  if (!domain || !verified || !automatic) return { ...status, vercel: base };
  try {
    const v = await getVercelDomainStatus(domain, deps.fetchImpl);
    return {
      ...status,
      vercel: { ...base, registered: v.registered, verification: v.verification, configured: v.configured, records: v.records },
    };
  } catch (err) {
    return { ...status, vercel: { ...base, error: err instanceof Error ? err.message : "No se pudo consultar Vercel." } };
  }
}

function normalizeDomain(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
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

  // Ni el mismo dominio ni su otra forma (www) pueden ser de otra marca.
  const companion = companionDomain(domain);
  const taken = await prisma.brandProfile.findFirst({
    where: { id: { not: brandId }, customDomain: { in: companion ? [domain, companion] : [domain] } },
    select: { id: true },
  });
  if (taken) {
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
      customDomainActiveAt: null,
      customDomainCheckedAt: null,
    },
  });
}

export async function removeCustomDomain(brandId: string) {
  const current = await prisma.brandProfile.findUnique({ where: { id: brandId }, select: { customDomain: true } });
  await unregisterInVercel(current?.customDomain ?? null);
  return prisma.brandProfile.update({
    where: { id: brandId },
    data: { customDomain: null, customDomainVerificationToken: null, customDomainVerifiedAt: null, customDomainActiveAt: null, customDomainCheckedAt: null },
  });
}

/// Busca el registro TXT en _marcolini-verify.{dominio} y confirma que
/// contiene el token que le dimos a la marca — eso prueba que el dominio es
/// suyo. Después lo registra en Vercel (o le avisa al equipo para que lo
/// haga a mano) y revisa de una vez si ya abre la tienda: si el DNS ya
/// apuntaba, queda activo ahí mismo.
export async function verifyCustomDomain(brandId: string, deps: CheckDeps = {}) {
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

  await prisma.brandProfile.update({
    where: { id: brandId },
    data: { customDomainVerifiedAt: new Date() },
  });
  const domain = brand.customDomain;
  const vercelError = await registerInVercel(domain, deps.fetchImpl);
  if (!vercelDomainsConfigured()) {
    const companion = companionDomain(domain);
    await notifyAdmins(
      brand,
      domain,
      `Agrégalo en Vercel → el proyecto → Settings → Domains${companion ? ` (y también ${companion}, llevando a ${domain})` : ""}. Con VERCEL_API_TOKEN y VERCEL_TEAM_ID puestos, Marcolini lo hace solo.`,
    );
  } else if (vercelError) {
    await notifyAdmins(brand, domain, `No se pudo registrar solo (${vercelError}). Agrégalo a mano en Vercel → el proyecto → Settings → Domains.`);
  }
  // Un solo intento: si todavía no abre, queda esperando el DNS sin demorar
  // la respuesta (lo vuelven a revisar Configuración y el cron).
  const { active } = await refreshCustomDomain(brandId, { attempts: 1, ...deps });
  const updated = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });
  return { brand: updated, vercelError, active };
}
