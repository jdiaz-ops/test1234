import { lookup } from "dns/promises";
import { isIP } from "net";

/// fetch para URLs que escribe la marca (la tienda que quiere importar) y
/// las que salen de ahí (páginas, fotos). Como el servidor es quien hace
/// la petición, sin estos cuidados alguien podría usarlo para leer
/// direcciones internas (localhost, la red de Vercel, metadatos de la
/// nube). Por eso: solo http/https a IPs públicas, redirecciones
/// revisadas una por una, tiempo máximo y tope de tamaño.
export class SafeFetchError extends Error {}

const MAX_REDIRECTS = 5;
const USER_AGENT =
  "Mozilla/5.0 (compatible; MarcoliniImporter/1.0; +https://marcolini.lat) AppleWebKit/537.36 (KHTML, like Gecko)";

function isPrivateIpv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateIp(ip: string) {
  if (isIP(ip) === 4) return isPrivateIpv4(ip);
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") ||
    v6.startsWith("ff")
  );
}

async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("La dirección no es válida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SafeFetchError("Solo se aceptan direcciones http o https.");
  }
  if (url.username || url.password) throw new SafeFetchError("La dirección no es válida.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new SafeFetchError("Esa dirección no es pública.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new SafeFetchError(`No encontramos el sitio ${host}.`);
  if (addresses.some((a) => isPrivateIp(a.address))) {
    throw new SafeFetchError("Esa dirección no es pública.");
  }
  return url;
}

export type SafeResponse = {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
};

/// Hace la petición y devuelve el cuerpo completo (hasta `maxBytes`). Un
/// 404/500 no es error acá — quien llama decide qué hacer con el status.
export async function safeFetch(
  raw: string,
  { maxBytes = 5 * 1024 * 1024, timeoutMs = 15000, accept = "*/*" } = {},
): Promise<SafeResponse> {
  let current = raw;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "es-CO,es;q=0.9,en;q=0.8" },
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      throw new SafeFetchError(timedOut ? `${url.hostname} tardó demasiado en responder.` : `No pudimos conectar con ${url.hostname}.`);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, url).toString();
      await res.body?.cancel().catch(() => {});
      continue;
    }
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      await res.body?.cancel().catch(() => {});
      throw new SafeFetchError("El archivo es demasiado grande.");
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new SafeFetchError("El archivo es demasiado grande.");
        }
        chunks.push(value);
      }
    }
    return {
      url: url.toString(),
      status: res.status,
      contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase(),
      body: Buffer.concat(chunks),
    };
  }
  throw new SafeFetchError("La dirección redirige demasiadas veces.");
}

export async function safeFetchJson(raw: string, opts: { timeoutMs?: number; maxBytes?: number } = {}) {
  const res = await safeFetch(raw, { accept: "application/json", maxBytes: 15 * 1024 * 1024, ...opts });
  if (res.status !== 200) return null;
  try {
    return JSON.parse(res.body.toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function safeFetchText(raw: string, opts: { timeoutMs?: number; maxBytes?: number } = {}) {
  const res = await safeFetch(raw, { accept: "text/html,application/xml;q=0.9,*/*;q=0.8", ...opts });
  return { ...res, text: res.status === 200 ? res.body.toString("utf8") : null };
}
