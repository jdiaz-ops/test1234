import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addDomainToVercel,
  checkVercelConnection,
  getVercelDomainStatus,
  recommendedDnsRecords,
  removeDomainFromVercel,
  vercelDomainsConfigured,
} from "@/server/integrations/vercel-domains";

type Call = { method: string; url: string; body: unknown };

function fakeApi(handlers: Record<string, (call: Call) => { status: number; json?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const call = { method: init?.method ?? "GET", url, body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const key = `${call.method} ${new URL(url).pathname}`;
    const handler = handlers[key];
    if (!handler) return new Response(JSON.stringify({ error: { code: "not_found", message: `sin handler ${key}` } }), { status: 404 });
    const { status, json } = handler(call);
    return new Response(JSON.stringify(json ?? {}), { status, headers: { "content-type": "application/json" } });
  };
  return { fetchImpl, calls };
}

describe("vercel-domains", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.VERCEL_API_TOKEN = "tok";
    process.env.VERCEL_PROJECT_ID = "prj_1";
    process.env.VERCEL_TEAM_ID = "team_1";
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("solo está configurado con token y proyecto", () => {
    expect(vercelDomainsConfigured()).toBe(true);
    delete process.env.VERCEL_API_TOKEN;
    expect(vercelDomainsConfigured()).toBe(false);
  });

  it("registros recomendados: CNAME para subdominio, A para el dominio raíz (con su www)", () => {
    const www = { type: "CNAME", name: "www", value: "cname.vercel-dns.com" };
    expect(recommendedDnsRecords("tienda.marca.com", "marca.com", null)).toEqual([{ type: "CNAME", name: "tienda", value: "cname.vercel-dns.com" }]);
    expect(recommendedDnsRecords("marca.com", "marca.com", null)).toEqual([{ type: "A", name: "@", value: "76.76.21.21" }, www]);
    expect(recommendedDnsRecords("marca.com", null, null)).toEqual([{ type: "A", name: "@", value: "76.76.21.21" }, www]);
    // Sin respuesta de Vercel, el dominio principal se calcula: antes un
    // subdominio salía como registro A en "@".
    expect(recommendedDnsRecords("tienda.marca.com", null, null)).toEqual([{ type: "CNAME", name: "tienda", value: "cname.vercel-dns.com" }]);
    expect(recommendedDnsRecords("tienda.marca.com.co", null, null)).toEqual([{ type: "CNAME", name: "tienda", value: "cname.vercel-dns.com" }]);
    expect(recommendedDnsRecords("www.marca.com.co", null, null)).toEqual([{ type: "A", name: "@", value: "76.76.21.21" }, www]);
    expect(
      recommendedDnsRecords("tienda.marca.com", "marca.com", { recommendedCNAME: [{ rank: 1, value: "abc.vercel-dns-017.com" }] }),
    ).toEqual([{ type: "CNAME", name: "tienda", value: "abc.vercel-dns-017.com" }]);
    expect(recommendedDnsRecords("marca.com", "marca.com", { recommendedIPv4: [{ rank: 1, value: ["216.198.79.1"] }] })).toEqual([
      { type: "A", name: "@", value: "216.198.79.1" },
      www,
    ]);
  });

  it("la www se agrega llevando al dominio principal", async () => {
    const api = fakeApi({
      "GET /v9/projects/prj_1/domains/www.marca.com": () => ({ status: 404 }),
      "POST /v10/projects/prj_1/domains": (call) => {
        expect(call.body).toEqual({ name: "www.marca.com", redirect: "marca.com", redirectStatusCode: 308 });
        return { status: 200, json: { name: "www.marca.com", apexName: "marca.com" } };
      },
    });
    await addDomainToVercel("www.marca.com", api.fetchImpl, "marca.com");
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("agrega el dominio al proyecto con el equipo y el token, y no lo repite si ya estaba", async () => {
    let added = false;
    const api = fakeApi({
      "GET /v9/projects/prj_1/domains/tienda.marca.com": () => (added ? { status: 200, json: { name: "tienda.marca.com", verified: true } } : { status: 404 }),
      "POST /v10/projects/prj_1/domains": (call) => {
        added = true;
        expect(call.body).toEqual({ name: "tienda.marca.com" });
        return { status: 200, json: { name: "tienda.marca.com", apexName: "marca.com", verified: true } };
      },
    });
    const first = await addDomainToVercel("tienda.marca.com", api.fetchImpl);
    expect(first.apexName).toBe("marca.com");
    expect(api.calls[1].url).toBe("https://api.vercel.com/v10/projects/prj_1/domains?teamId=team_1");
    await addDomainToVercel("tienda.marca.com", api.fetchImpl);
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });

  it("explica cuando el dominio está en otro proyecto o Vercel responde error", async () => {
    const api = fakeApi({
      "GET /v9/projects/prj_1/domains/x.com": () => ({ status: 404 }),
      "POST /v10/projects/prj_1/domains": () => ({ status: 409, json: { error: { code: "domain_already_in_use", message: "in use" } } }),
    });
    await expect(addDomainToVercel("x.com", api.fetchImpl)).rejects.toThrow(/otro proyecto de Vercel/);
    const api2 = fakeApi({
      "GET /v9/projects/prj_1/domains/x.com": () => ({ status: 404 }),
      "POST /v10/projects/prj_1/domains": () => ({ status: 403, json: { error: { code: "forbidden", message: "Not authorized" } } }),
    });
    await expect(addDomainToVercel("x.com", api2.fetchImpl)).rejects.toThrow("Vercel: Not authorized");
  });

  it("el estado dice si está registrado, si el DNS apunta y qué registros poner", async () => {
    const api = fakeApi({
      "GET /v9/projects/prj_1/domains/tienda.marca.com": () => ({
        status: 200,
        json: { name: "tienda.marca.com", apexName: "marca.com", verified: false, verification: [{ type: "TXT", domain: "_vercel.marca.com", value: "vc-domain-verify=abc" }] },
      }),
      "GET /v6/domains/tienda.marca.com/config": () => ({ status: 200, json: { misconfigured: true, recommendedCNAME: [{ rank: 1, value: "x.vercel-dns-017.com" }] } }),
    });
    expect(await getVercelDomainStatus("tienda.marca.com", api.fetchImpl)).toEqual({
      registered: true,
      verified: false,
      verification: [{ type: "TXT", name: "_vercel.marca.com", value: "vc-domain-verify=abc" }],
      configured: false,
      records: [{ type: "CNAME", name: "tienda", value: "x.vercel-dns-017.com" }],
    });
    const none = fakeApi({ "GET /v9/projects/prj_1/domains/nueva.com": () => ({ status: 404 }) });
    expect(await getVercelDomainStatus("nueva.com", none.fetchImpl)).toMatchObject({
      registered: false,
      configured: false,
      records: [
        { type: "A", name: "@", value: "76.76.21.21" },
        { type: "CNAME", name: "www", value: "cname.vercel-dns.com" },
      ],
    });
  });

  it("probar la conexión: token aceptado, rechazado o sin poner", async () => {
    const api = fakeApi({
      "GET /v9/projects/prj_1": () => ({ status: 200, json: { id: "prj_1", name: "test1234" } }),
      "GET /v9/projects/prj_1/domains": () => ({ status: 200, json: { domains: [{ name: "marcolini.lat" }, { name: "tienda.marca.com" }] } }),
    });
    expect(await checkVercelConnection(api.fetchImpl)).toMatchObject({
      ok: true,
      projectName: "test1234",
      domains: ["marcolini.lat", "tienda.marca.com"],
      error: null,
    });
    // Solo lee.
    expect(api.calls.every((c) => c.method === "GET")).toBe(true);

    const denied = fakeApi({ "GET /v9/projects/prj_1": () => ({ status: 403, json: { error: { code: "forbidden", message: "Not authorized" } } }) });
    expect(await checkVercelConnection(denied.fetchImpl)).toMatchObject({ ok: false, error: expect.stringMatching(/no aceptó el token/) });
    const hidden = fakeApi({ "GET /v9/projects/prj_1": () => ({ status: 404 }) });
    expect(await checkVercelConnection(hidden.fetchImpl)).toMatchObject({ ok: false, error: expect.stringMatching(/alcance marcolini1/) });

    delete process.env.VERCEL_API_TOKEN;
    const none = fakeApi({});
    expect(await checkVercelConnection(none.fetchImpl)).toMatchObject({ ok: false, token: false, error: expect.stringMatching(/VERCEL_API_TOKEN/) });
    expect(none.calls).toHaveLength(0);
  });

  it("quitar un dominio que no estaba no es error", async () => {
    const api = fakeApi({ "DELETE /v9/projects/prj_1/domains/x.com": () => ({ status: 404 }) });
    expect(await removeDomainFromVercel("x.com", api.fetchImpl)).toBe(false);
    const api2 = fakeApi({ "DELETE /v9/projects/prj_1/domains/x.com": () => ({ status: 200, json: {} }) });
    expect(await removeDomainFromVercel("x.com", api2.fetchImpl)).toBe(true);
  });
});
