import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseThemeConfig } from "@/lib/brand-theme";
import { forgetPhotoShape, refreshPhotoShape, shapeFromRatios } from "@/server/services/photo-shape-service";
import { createBrand, createProduct, hasDb } from "./helpers";

const DIR = path.join(process.cwd(), "public", "uploads", "prueba-forma-fotos");

beforeAll(async () => {
  await mkdir(DIR, { recursive: true });
  await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#dfe0f5" } }).jpeg().toFile(path.join(DIR, "vertical.jpg"));
  await sharp({ create: { width: 800, height: 800, channels: 3, background: "#f2a7c3" } }).jpeg().toFile(path.join(DIR, "cuadrada.jpg"));
});

afterAll(async () => {
  await rm(DIR, { recursive: true, force: true });
});

describe("la forma de las tarjetas en Automática", () => {
  it("es vertical si al menos la mitad de las fotos lo son", () => {
    expect(shapeFromRatios([1.25, 1.25, 1])).toBe("portrait");
    expect(shapeFromRatios([1.25, 1, 1, 1])).toBe("square");
    expect(shapeFromRatios([1.33, 0.75, 1.25, 1])).toBe("portrait");
    expect(shapeFromRatios([1.25, 1.25])).toBeNull();
    // Lo que quedó guardado como "cada foto con su forma" pasa a Automática.
    expect(parseThemeConfig({ productListing: { imageRatio: "natural" } }).productListing.imageRatio).toBe("auto");
    expect(parseThemeConfig({}).productListing.imageRatio).toBe("auto");
  });

  it.skipIf(!hasDb)("mide las fotos de la tienda una vez y lo guarda", async () => {
    const brand = await createBrand();
    const photos = ["vertical", "vertical", "vertical", "cuadrada"];
    for (const [i, photo] of photos.entries()) {
      const p = await createProduct(brand.id, { name: `Gel ${i}`, price: 15900, stock: 5 });
      await prisma.product.update({ where: { id: p.id }, data: { imageUrl: `/uploads/prueba-forma-fotos/${photo}.jpg` } });
    }
    expect(await refreshPhotoShape(brand.id)).toBe("portrait");
    expect(await prisma.brandProfile.findUniqueOrThrow({ where: { id: brand.id } })).toMatchObject({ photoShape: "portrait" });
    // Recién medida: no se vuelve a medir.
    expect(await refreshPhotoShape(brand.id)).toBeNull();
    // Después de importar, sí.
    await forgetPhotoShape(brand.id);
    expect(await refreshPhotoShape(brand.id)).toBe("portrait");
  });
});
