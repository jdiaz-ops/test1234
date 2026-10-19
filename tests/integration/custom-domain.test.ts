import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { publicStoreUrl } from "@/lib/store-url";
import {
  CustomDomainError,
  domainPingSignature,
  refreshCustomDomain,
  setCustomDomain,
  verifyCustomDomain,
} from "@/server/services/custom-domain-service";
import { GET as ping } from "@/app/api/dominio/ping/route";
import { createBrand, hasDb } from "./helpers";

// El TXT de la marca, sin DNS real.
const resolveTxt = vi.fn();
vi.mock("node:dns/promises", () => ({ default: { resolveTxt: (name: string) => resolveTxt(name) } }));

/// https://{dominio}/api/dominio/ping como lo contestaría Marcolini, o nada
/// (el DNS todavía no apunta).
function liveFetch(domain: string) {
  return async (url: string) =>
    url === `https://${domain}/api/dominio/ping`
      ? new Response(JSON.stringify({ ok: true, sig: domainPingSignature(domain) }), { status: 200 })
      : new Response("no", { status: 404 });
}
const deadFetch = async (): Promise<Response> => {
  throw new Error("getaddrinfo ENOTFOUND");
};
// Una página de parqueo del registrador también responde 200, pero sin la firma.
const parkedFetch = async () => new Response(JSON.stringify({ ok: true, sig: "x" }), { status: 200 });

const notices = (userId: string, type: string) => prisma.notification.findMany({ where: { userId, type } });

describe.skipIf(!hasDb)("dominio propio", () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.VERCEL_API_TOKEN;
    resolveTxt.mockReset();
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("verifica, espera el DNS y cambia los links solo cuando el dominio abre la tienda", async () => {
    const brand = await createBrand();
    const admin = await prisma.user.create({ data: { email: `admin-${randomUUID().slice(0, 8)}@prueba.test`, role: "ADMIN", adminRole: "OWNER" } });
    const domain = `tienda.beauty-${randomUUID().slice(0, 8)}.com`;

    const saved = await setCustomDomain(brand.id, `https://${domain.toUpperCase()}/productos`);
    expect(saved.customDomain).toBe(domain);
    resolveTxt.mockResolvedValue([[saved.customDomainVerificationToken!]]);

    // Ya es suyo, pero el DNS todavía no apunta: los links siguen en el subdominio.
    const verified = await verifyCustomDomain(brand.id, { fetchImpl: deadFetch, retryDelayMs: 0 });
    expect(verified.active).toBe(false);
    expect(verified.brand.customDomainVerifiedAt).not.toBeNull();
    expect(publicStoreUrl(verified.brand)).toBe(`https://${brand.storefrontSlug}.marcolini.lat`);
    expect(resolveTxt).toHaveBeenCalledWith(`_marcolini-verify.${domain}`);
    // Sin token de Vercel, el equipo lo agrega a mano: se le avisa.
    const [adminNotice] = await notices(admin.id, "CUSTOM_DOMAIN_ADMIN");
    expect(adminNotice.message).toContain(`${brand.companyName} verificó su dominio ${domain}.`);

    // Una página de parqueo no cuenta.
    expect((await refreshCustomDomain(brand.id, { fetchImpl: parkedFetch, retryDelayMs: 0 })).active).toBe(false);

    // Ya abre la tienda: activo, links al dominio y aviso a la marca (una vez).
    expect(await refreshCustomDomain(brand.id, { fetchImpl: liveFetch(domain), retryDelayMs: 0 })).toEqual({ active: true, changed: "activated" });
    expect(await refreshCustomDomain(brand.id, { fetchImpl: liveFetch(domain), retryDelayMs: 0 })).toEqual({ active: true, changed: null });
    const active = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(publicStoreUrl(active)).toBe(`https://${domain}`);
    const activeNotices = await notices(brand.userId, "CUSTOM_DOMAIN_ACTIVE");
    expect(activeNotices).toHaveLength(1);
    expect(activeNotices[0].message).toContain(`¡Tu dominio ${domain} ya está activo!`);

    // Deja de responder: de vuelta al subdominio, que nunca falla, y aviso.
    expect(await refreshCustomDomain(brand.id, { fetchImpl: deadFetch, retryDelayMs: 0 })).toEqual({ active: false, changed: "deactivated" });
    const down = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } });
    expect(publicStoreUrl(down)).toBe(`https://${brand.storefrontSlug}.marcolini.lat`);
    expect(down.customDomainCheckedAt).not.toBeNull();
    const [downNotice] = await notices(brand.userId, "CUSTOM_DOMAIN_DOWN");
    expect(downNotice.message).toContain(`${brand.storefrontSlug}.marcolini.lat`);

    // Cambiar de dominio borra la verificación y la activación.
    const changed = await setCustomDomain(brand.id, `otra-${domain}`);
    expect([changed.customDomainVerifiedAt, changed.customDomainActiveAt, changed.customDomainCheckedAt]).toEqual([null, null, null]);
  });

  it("el TXT tiene que traer el código que le dimos", async () => {
    const brand = await createBrand();
    await setCustomDomain(brand.id, `x-${randomUUID().slice(0, 8)}.com`);
    resolveTxt.mockResolvedValue([["otro-codigo"]]);
    await expect(verifyCustomDomain(brand.id, { fetchImpl: deadFetch, retryDelayMs: 0 })).rejects.toBeInstanceOf(CustomDomainError);
    resolveTxt.mockRejectedValue(new Error("ENODATA"));
    await expect(verifyCustomDomain(brand.id, { fetchImpl: deadFetch, retryDelayMs: 0 })).rejects.toThrow(/No encontramos el registro TXT/);
  });

  it("ni el dominio ni su www pueden ser de otra marca", async () => {
    const [a, b] = [await createBrand(), await createBrand()];
    const apex = `marca-${randomUUID().slice(0, 8)}.com.co`;
    await setCustomDomain(a.id, apex);
    await expect(setCustomDomain(b.id, `www.${apex}`)).rejects.toThrow("Ese dominio ya lo tiene otra marca.");
    await expect(setCustomDomain(b.id, "tienda.marcolini.lat")).rejects.toThrow(/es de Marcolini/);
  });

  it("el ping firma el dominio que le preguntaron", async () => {
    const res = await ping(new Request("https://tienda.beauty.com/api/dominio/ping", { headers: { host: "Tienda.Beauty.com" } }));
    expect(await res.json()).toEqual({ ok: true, sig: domainPingSignature("tienda.beauty.com") });
    expect(domainPingSignature("tienda.beauty.com")).not.toBe(domainPingSignature("otra.com"));
  });
});
