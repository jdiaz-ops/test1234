import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { optimizeImageUpload } from "@/lib/image-optimize";

async function photo(width: number, height: number) {
  // Ruido de colores: se comprime mal, como una foto real.
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7919) % 251;
  const jpg = await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
  return new File([new Uint8Array(jpg)], "foto-celular.jpg", { type: "image/jpeg" });
}

describe("compresión de fotos al subir", () => {
  it("reduce una foto grande a WebP de máximo 2000 px y pesa mucho menos", async () => {
    const original = await photo(4000, 3000);
    const optimized = await optimizeImageUpload(original);
    const meta = await sharp(Buffer.from(await optimized.arrayBuffer())).metadata();
    expect(optimized.type).toBe("image/webp");
    expect(optimized.name).toBe("foto-celular.webp");
    expect(meta.width).toBe(2000);
    expect(meta.height).toBe(1500);
    expect(optimized.size).toBeLessThan(original.size / 2);
  });

  it("no agranda fotos pequeñas", async () => {
    const optimized = await optimizeImageUpload(await photo(800, 600));
    const meta = await sharp(Buffer.from(await optimized.arrayBuffer())).metadata();
    expect(meta.width).toBe(800);
  });

  it("deja pasar sin tocar lo que no es foto", async () => {
    const svg = new File(["<svg xmlns='http://www.w3.org/2000/svg'/>"], "logo.svg", { type: "image/svg+xml" });
    expect(await optimizeImageUpload(svg)).toBe(svg);
  });

  it("si el archivo está dañado, sube el original en vez de fallar", async () => {
    const broken = new File([new Uint8Array([1, 2, 3])], "rota.jpg", { type: "image/jpeg" });
    expect(await optimizeImageUpload(broken)).toBe(broken);
  });
});
