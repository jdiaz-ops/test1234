/// El dominio propio de una marca, en Vercel.
///
/// Que la marca verifique su dominio (TXT) y apunte el DNS no basta:
/// Vercel solo sirve un dominio si está agregado al proyecto. Ese paso lo
/// hacía a mano el equipo de Marcolini en el panel de Vercel; acá se hace
/// con la API de Vercel apenas el dominio queda verificado (ver
/// custom-domain-service.ts). Necesita VERCEL_API_TOKEN (Account Settings
/// → Tokens, con alcance al equipo) y VERCEL_TEAM_ID (Team Settings →
/// General); VERCEL_PROJECT_ID lo pone Vercel solo en producción. Sin el
/// token no se llama a nada y conectar el dominio sigue siendo manual.
/// Ver conversación del 2026-10-18.

const API = "https://api.vercel.com";
/// Valores de siempre de Vercel, por si la API no manda los recomendados.
const DEFAULT_CNAME = "cname.vercel-dns.com";
const DEFAULT_IPV4 = "76.76.21.21";

export class VercelDomainError extends Error {}

export type DnsRecord = { type: "A" | "CNAME" | "TXT"; name: string; value: string };

export type VercelDomainStatus = {
  /// El dominio está agregado al proyecto.
  registered: boolean;
  /// Vercel ya aceptó el dominio como de esta cuenta. Si otra cuenta de
  /// Vercel lo tenía, pide un TXT más (`verification`).
  verified: boolean;
  verification: DnsRecord[];
  /// El DNS ya apunta a Vercel.
  configured: boolean;
  /// Qué poner en el DNS para que apunte a Marcolini.
  records: DnsRecord[];
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type ProjectDomain = {
  name: string;
  apexName?: string;
  verified?: boolean;
  verification?: { type: string; domain: string; value: string }[];
};

type DomainConfig = {
  misconfigured?: boolean;
  recommendedCNAME?: { rank: number; value: string }[];
  recommendedIPv4?: { rank: number; value: string[] }[];
};

function token() {
  return process.env.VERCEL_API_TOKEN ?? "";
}

function projectId() {
  return process.env.VERCEL_PROJECT_ID ?? "";
}

export function vercelDomainsConfigured() {
  return Boolean(token() && projectId());
}

function teamQuery() {
  const team = process.env.VERCEL_TEAM_ID;
  return team ? `?teamId=${encodeURIComponent(team)}` : "";
}

async function call(fetchImpl: FetchLike, method: string, path: string, body?: unknown) {
  const res = await fetchImpl(`${API}${path}${teamQuery()}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  return { status: res.status, json };
}

function errorMessage(json: { error?: { code?: string; message?: string } } | null, fallback: string) {
  return json?.error?.message ? `Vercel: ${json.error.message}` : fallback;
}

/// Los registros que la marca debe poner: un subdominio va con CNAME; el
/// dominio raíz, con un registro A.
export function recommendedDnsRecords(domain: string, apexName: string | null | undefined, config: DomainConfig | null): DnsRecord[] {
  const apex = (apexName || domain).toLowerCase();
  const name = domain.toLowerCase();
  if (name === apex) {
    const ip = config?.recommendedIPv4?.[0]?.value?.[0] || DEFAULT_IPV4;
    return [{ type: "A", name: "@", value: ip }];
  }
  const cname = config?.recommendedCNAME?.[0]?.value || DEFAULT_CNAME;
  const host = name.endsWith(`.${apex}`) ? name.slice(0, -(apex.length + 1)) : name;
  return [{ type: "CNAME", name: host, value: cname }];
}

function verificationRecords(domain: ProjectDomain | null): DnsRecord[] {
  return (domain?.verification ?? [])
    .filter((v) => v.type === "TXT")
    .map((v) => ({ type: "TXT" as const, name: v.domain, value: v.value }));
}

async function getProjectDomain(domain: string, fetchImpl: FetchLike): Promise<ProjectDomain | null> {
  const { status, json } = await call(fetchImpl, "GET", `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(domain)}`);
  if (status === 404) return null;
  if (status >= 400) throw new VercelDomainError(errorMessage(json, "No se pudo consultar el dominio en Vercel."));
  return json as unknown as ProjectDomain;
}

/// Agrega el dominio al proyecto (si ya estaba, no pasa nada).
export async function addDomainToVercel(domain: string, fetchImpl: FetchLike = fetch): Promise<ProjectDomain> {
  const existing = await getProjectDomain(domain, fetchImpl);
  if (existing) return existing;
  const { status, json } = await call(fetchImpl, "POST", `/v10/projects/${encodeURIComponent(projectId())}/domains`, { name: domain });
  if (status === 409 && json?.error?.code === "domain_already_in_use") {
    throw new VercelDomainError("Ese dominio está en uso en otro proyecto de Vercel.");
  }
  if (status >= 400) throw new VercelDomainError(errorMessage(json, "No se pudo registrar el dominio en Vercel."));
  return json as unknown as ProjectDomain;
}

export async function removeDomainFromVercel(domain: string, fetchImpl: FetchLike = fetch) {
  const { status, json } = await call(fetchImpl, "DELETE", `/v9/projects/${encodeURIComponent(projectId())}/domains/${encodeURIComponent(domain)}`);
  if (status === 404) return false;
  if (status >= 400) throw new VercelDomainError(errorMessage(json, "No se pudo quitar el dominio de Vercel."));
  return true;
}

export async function getVercelDomainStatus(domain: string, fetchImpl: FetchLike = fetch): Promise<VercelDomainStatus> {
  const project = await getProjectDomain(domain, fetchImpl);
  let config: DomainConfig | null = null;
  if (project) {
    const { status, json } = await call(fetchImpl, "GET", `/v6/domains/${encodeURIComponent(domain)}/config`);
    if (status < 400) config = json as unknown as DomainConfig;
  }
  return {
    registered: project !== null,
    verified: project?.verified !== false,
    verification: verificationRecords(project),
    configured: project !== null && config !== null && config.misconfigured === false,
    records: recommendedDnsRecords(domain, project?.apexName, config),
  };
}
