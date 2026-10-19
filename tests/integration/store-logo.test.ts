import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { emailLogoSrc, storefrontLogoSrc } from "@/lib/logo-src";
import { GET } from "@/app/api/tienda/[slug]/logo/route";
import { createBrand, hasDb } from "./helpers";

const DIR = path.join(process.cwd(), "public", "uploads", "prueba-logo");

afterAll(async () => {
  await rm(DIR, { recursive: true, force: true });
});

describe("el logo del encabezado", () => {
  it("pasa por el recorte, salvo SVG y data:", () => {
    expect(storefrontLogoSrc("mi-tienda", "https://x.public.blob.vercel-storage.com/logo.png")).toMatch(/^\/api\/tienda\/mi-tienda\/logo\?v=[a-z0-9]+$/);
    expect(storefrontLogoSrc("mi-tienda", "https://x.com/logo.png")).not.toBe(storefrontLogoSrc("mi-tienda", "https://x.com/otro.png"));
    expect(storefrontLogoSrc("mi-tienda", "https://x.com/logo.svg")).toBe("https://x.com/logo.svg");
    expect(storefrontLogoSrc("mi-tienda", "data:image/png;base64,xx")).toBe("data:image/png;base64,xx");
    expect(storefrontLogoSrc("mi-tienda", null)).toBeNull();
  });

  it.skipIf(!hasDb)("le quita los bordes vacíos al logo de la marca", async () => {
    await mkdir(DIR, { recursive: true });
    // Una firma chiquita en un lienzo de 500 × 300, como el de Beauty Solution.
    await sharp({ create: { width: 500, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp({ create: { width: 300, height: 60, channels: 4, background: "#222222" } }).png().toBuffer(), left: 100, top: 120 }])
      .png()
      .toFile(path.join(DIR, "lienzo.png"));
    const brand = await createBrand();
    await prisma.brandProfile.update({ where: { id: brand.id }, data: { logoUrl: "/uploads/prueba-logo/lienzo.png" } });
    const res = await GET(new Request("https://x.marcolini.lat/api/tienda/x/logo"), { params: Promise.resolve({ slug: brand.storefrontSlug! }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([300, 60]);

    // En los correos: PNG sin transparencia (Gmail la pintaba de negro).
    const forEmail = emailLogoSrc("https://marcolini.lat", { storefrontSlug: brand.storefrontSlug, logoUrl: "/uploads/prueba-logo/lienzo.png" });
    expect(forEmail).toMatch(new RegExp(`^https://marcolini\\.lat/api/tienda/${brand.storefrontSlug}/logo\\?v=[a-z0-9]+&correo=1$`));
    const mail = await GET(new Request(forEmail!), { params: Promise.resolve({ slug: brand.storefrontSlug! }) });
    expect(mail.headers.get("content-type")).toBe("image/png");
    const mailMeta = await sharp(Buffer.from(await mail.arrayBuffer())).metadata();
    expect([mailMeta.width, mailMeta.height, mailMeta.hasAlpha]).toEqual([300, 60, false]);

    const missing = await GET(new Request("https://x.marcolini.lat/api/tienda/nada/logo"), { params: Promise.resolve({ slug: "no-existe-xyz" }) });
    expect(missing.status).toBe(404);
  });
});
