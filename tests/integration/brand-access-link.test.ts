import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { isPlaceholderEmail } from "@/lib/email";
import {
  claimBrandAccess,
  createBrandManually,
  generateBrandAccessLink,
  getBrandByAccessToken,
  hashAccessToken,
  revokeBrandAccessLink,
} from "@/server/services/admin-brand-service";
import { hasDb } from "./helpers";

const tokenOf = (url: string) => new URL(url).searchParams.get("token")!;

describe.skipIf(!hasDb)("marca sin dueña y link de acceso", () => {
  it("crear sin correo deja una cuenta provisional a la que nadie puede entrar", async () => {
    const user = await createBrandManually({ companyName: "Marca Nueva" });
    expect(isPlaceholderEmail(user.email)).toBe(true);
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerified).toBeNull();
    expect(user.brandProfile).toMatchObject({ ownerPending: true, status: "APPROVED", companyName: "Marca Nueva" });
  });

  it("con correo funciona como antes: la cuenta nace con dueña", async () => {
    const email = `duena-${randomUUID().slice(0, 8)}@prueba.test`;
    const user = await createBrandManually({ email, companyName: "Con correo" });
    expect(user.email).toBe(email);
    expect(user.emailVerified).not.toBeNull();
    expect(user.brandProfile?.ownerPending).toBe(false);
    await expect(createBrandManually({ email, companyName: "Repetida" })).rejects.toThrow(/Ya existe una cuenta/);
  });

  it("el link reclama la marca una sola vez y liga correo y contraseña", async () => {
    const user = await createBrandManually({ companyName: "Para reclamar" });
    const brandId = user.brandProfile!.id;
    const { url, expiresAt } = await generateBrandAccessLink(brandId);
    expect(url).toMatch(/\/activar\?token=[a-f0-9]{64}$/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const token = tokenOf(url);
    const stored = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });
    expect(stored.accessTokenHash).toBe(hashAccessToken(token));
    expect(stored.accessLinkCreatedAt).not.toBeNull();
    expect(await getBrandByAccessToken(token)).toEqual({ id: brandId, companyName: "Para reclamar", logoUrl: null });
    expect(await getBrandByAccessToken("a".repeat(64))).toBeNull();
    expect(await getBrandByAccessToken("no-es-un-token")).toBeNull();

    const email = `duena-${randomUUID().slice(0, 8)}@prueba.test`;
    const result = await claimBrandAccess(token, { email: ` ${email.toUpperCase()} `, password: "Secreta123!" });
    expect(result).toEqual({ email, companyName: "Para reclamar" });
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(owner.email).toBe(email);
    expect(owner.emailVerified).not.toBeNull();
    expect(await bcrypt.compare("Secreta123!", owner.passwordHash!)).toBe(true);
    const after = await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } });
    expect(after).toMatchObject({ ownerPending: false, accessTokenHash: null, accessTokenExpiresAt: null });
    expect(after.claimedAt).not.toBeNull();

    // El mismo link ya no sirve, y una marca con dueña no genera más links.
    await expect(claimBrandAccess(token, { email: "otra@prueba.test", password: "Secreta123!" })).rejects.toThrow(/ya no sirve/);
    await expect(generateBrandAccessLink(brandId)).rejects.toThrow(/ya tiene dueña/);
  });

  it("un link vencido, reemplazado o anulado no sirve, y un correo ya usado se rechaza", async () => {
    const user = await createBrandManually({ companyName: "Vencida" });
    const brandId = user.brandProfile!.id;
    const first = tokenOf((await generateBrandAccessLink(brandId)).url);
    await prisma.brandProfile.update({ where: { id: brandId }, data: { accessTokenExpiresAt: new Date(Date.now() - 1000) } });
    expect(await getBrandByAccessToken(first)).toBeNull();
    await expect(claimBrandAccess(first, { email: "x@prueba.test", password: "Secreta123!" })).rejects.toThrow(/ya no sirve/);

    const second = tokenOf((await generateBrandAccessLink(brandId)).url);
    expect(await getBrandByAccessToken(first)).toBeNull();
    expect(await getBrandByAccessToken(second)).not.toBeNull();

    const other = await createBrandManually({ email: `ocupado-${randomUUID().slice(0, 8)}@prueba.test`, companyName: "Otra" });
    await expect(claimBrandAccess(second, { email: other.email, password: "Secreta123!" })).rejects.toThrow(/Ya existe una cuenta/);
    expect((await prisma.brandProfile.findUniqueOrThrow({ where: { id: brandId } })).ownerPending).toBe(true);

    await revokeBrandAccessLink(brandId);
    expect(await getBrandByAccessToken(second)).toBeNull();
  });
});
