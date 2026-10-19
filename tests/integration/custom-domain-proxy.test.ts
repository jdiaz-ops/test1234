import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Sin sesión: el enrutador solo necesita req.auth (null) para la vitrina.
vi.mock("@/auth", () => ({
  auth: (handler: (req: unknown, ctx: unknown) => unknown) => (req: object, ctx: unknown) => handler(Object.assign(req, { auth: null }), ctx),
}));
import { prisma } from "@/lib/prisma";
import proxy from "@/proxy";
import { createBrand, hasDb } from "./helpers";

type Handler = (req: NextRequest, ctx: unknown) => Promise<Response | undefined>;

async function visit(url: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(url, { headers: { host: new URL(url).host, ...headers } });
  return (await (proxy as unknown as Handler)(req, { params: Promise.resolve({}) })) as Response;
}

describe.skipIf(!hasDb)("dominio propio en el enrutador", () => {
  it("el subdominio lleva a la misma página en el dominio activo, con la atribución", async () => {
    const brand = await createBrand();
    const domain = `beauty-${randomUUID().slice(0, 8)}.com`;
    const sub = `https://${brand.storefrontSlug}.marcolini.lat`;

    // Solo verificado (todavía no abre): el subdominio sigue siendo la tienda.
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { customDomain: domain, customDomainVerifiedAt: new Date() } });
    const pending = await visit(`${sub}/esmalte-rojo`);
    expect(pending.headers.get("x-middleware-rewrite")).toContain(`/t/${brand.storefrontSlug}/esmalte-rojo`);

    // Activo: 308 a la misma página, con lo que traía la URL.
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { customDomainActiveAt: new Date() } });
    const moved = await visit(`${sub}/esmalte-rojo?color=rojo`);
    expect(moved.status).toBe(308);
    expect(moved.headers.get("location")).toBe(`https://${domain}/esmalte-rojo?color=rojo`);

    // La creadora con la que llegó el comprador viaja con él.
    const withRef = await visit(`${sub}/`, { cookie: "mkl_ref=LAURA10; mkl_ref_at=1792449527" });
    expect(withRef.headers.get("location")).toBe(`https://${domain}/?ref=LAURA10&ref_at=1792449527`);

    // En el dominio propio, la tienda abre y guarda la atribución.
    const there = await visit(`https://${domain}/?ref=LAURA10`);
    expect(there.headers.get("x-middleware-rewrite")).toContain(`/t/${brand.storefrontSlug}`);
    expect(there.headers.get("set-cookie")).toContain("mkl_ref=LAURA10");

    // www.{dominio} lleva al dominio que eligió la marca.
    const www = await visit(`https://www.${domain}/coleccion/unas`);
    expect(www.status).toBe(308);
    expect(www.headers.get("location")).toBe(`https://${domain}/coleccion/unas`);
  });

  it("un dominio sin verificar nunca abre una tienda", async () => {
    const brand = await createBrand();
    const domain = `ajeno-${randomUUID().slice(0, 8)}.com`;
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { customDomain: domain } });
    const res = await visit(`https://${domain}/`);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });
});
