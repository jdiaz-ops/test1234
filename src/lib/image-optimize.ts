import sharp from "sharp";

/// Comprime una foto al subirla: máximo 2000 px por lado, formato WebP,
/// calidad 82, girada según los datos de la cámara. Una foto de celular de
/// 4 MB queda en unos 200 a 400 KB sin diferencia visible en la tienda.
/// SVG y PDF pasan sin tocar. Si algo falla, se sube la original (nunca se
/// pierde una subida por esto). Ver conversación del 2026-10-01.
const RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIDE = 2000;

export async function optimizeImageUpload(file: File): Promise<File> {
  if (!RASTER_TYPES.has(file.type)) return file;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const output = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    if (output.length >= input.length && file.type === "image/webp") return file;
    const name = `${file.name.replace(/\.[^.]+$/, "") || "foto"}.webp`;
    return new File([new Uint8Array(output)], name, { type: "image/webp" });
  } catch (err) {
    console.error("[imagenes] no se pudo comprimir, se sube la original:", err);
    return file;
  }
}
