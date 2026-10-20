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

import { apexOf, companionDomain } from "@/lib/custom-domain";

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
/// dominio raíz, con un registro A. Con el dominio raíz (o su www) van los
/// dos, para que tumarca.com y www.tumarca.com abran la tienda (ver
/// companionDomain). Sin respuesta de Vercel, el dominio principal se
/// calcula con apexOf.
export function recommendedDnsRecords(domain: string, apexName: string | null | undefined, config: DomainConfig | null): DnsRecord[] {
  const name = domain.toLowerCase();
  const apex = (apexName || apexOf(name)).toLowerCase();
  const ip = config?.recommendedIPv4?.[0]?.value?.[0] || DEFAULT_IPV4;
  const cname = config?.recommendedCNAME?.[0]?.value || DEFAULT_CNAME;
  const record = (host: string): DnsRecord =>
    host === apex
      ? { type: "A", name: "@", value: ip }
      : { type: "CNAME", name: host.endsWith(`.${apex}`) ? host.slice(0, -(apex.length + 1)) : host, value: cname };
  const companion = companionDomain(name);
  // El dominio raíz primero: es el que más se demora en los paneles.
  return companion ? [record(apex), record(`www.${apex}`)] : [record(name)];
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

/// Agrega el dominio al proyecto (si ya estaba, no pasa nada). Con
/// `redirectTo`, Vercel lo lleva a ese otro dominio (www.tumarca.com →
/// tumarca.com) sin pasar por Marcolini.
export async function addDomainToVercel(domain: string, fetchImpl: FetchLike = fetch, redirectTo?: string): Promise<ProjectDomain> {
  const existing = await getProjectDomain(domain, fetchImpl);
  if (existing) return existing;
  const body = redirectTo ? { name: domain, redirect: redirectTo, redirectStatusCode: 308 } : { name: domain };
  const { status, json } = await call(fetchImpl, "POST", `/v10/projects/${encodeURIComponent(projectId())}/domains`, body);
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

export type VercelConnectionStatus = {
  /// Lo que hay en este despliegue (sin mostrar los valores).
  token: boolean;
  project: boolean;
  team: boolean;
  ok: boolean;
  projectName: string | null;
  /// Los dominios que ya tiene el proyecto (los de Marcolini y los de las marcas).
  domains: string[] | null;
  error: string | null;
};

/// Admin → Configuración → "Probar conexión" de los dominios propios: si
/// el token y el proyecto están en este despliegue y Vercel los acepta.
/// Solo lee, no agrega ni quita nada (pedido del 2026-10-20: "¿cómo
/// probamos si funciona?").
export async function checkVercelConnection(fetchImpl: FetchLike = fetch): Promise<VercelConnectionStatus> {
  const base: VercelConnectionStatus = {
    token: Boolean(token()),
    project: Boolean(projectId()),
    team: Boolean(process.env.VERCEL_TEAM_ID),
    ok: false,
    projectName: null,
    domains: null,
    error: null,
  };
  if (!base.token) return { ...base, error: "Este despliegue no tiene VERCEL_API_TOKEN: agrégalo en Vercel y haz Redeploy." };
  if (!base.project) {
    return { ...base, error: "Falta VERCEL_PROJECT_ID: en Vercel, revisa que esté marcada «Automatically expose System Environment Variables»." };
  }
  try {
    const project = await call(fetchImpl, "GET", `/v9/projects/${encodeURIComponent(projectId())}`);
    if (project.status === 401 || project.status === 403) {
      return { ...base, error: "Vercel no aceptó el token: créalo de nuevo con el alcance marcolini1 y revisa que no esté vencido." };
    }
    if (project.status === 404) return { ...base, error: "Con ese token no se ve el proyecto: créalo con el alcance marcolini1." };
    if (project.status >= 400) return { ...base, error: errorMessage(project.json, "Vercel respondió con un error.") };
    const list = await call(fetchImpl, "GET", `/v9/projects/${encodeURIComponent(projectId())}/domains`);
    const domains = list.status < 400 ? ((list.json as { domains?: { name: string }[] } | null)?.domains ?? []).map((d) => d.name) : null;
    const projectName = (project.json as { name?: string } | null)?.name ?? null;
    return { ...base, ok: true, projectName, domains };
  } catch (err) {
    return { ...base, error: err instanceof Error ? `No se pudo hablar con Vercel (${err.message}).` : "No se pudo hablar con Vercel." };
  }
}
