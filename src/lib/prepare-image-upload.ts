/// Achica en el navegador una foto pesada ANTES de subirla. Vercel corta
/// cualquier subida de más de 4,5 MB, y una foto de celular suele pesar
/// eso o más: sin esto la subida fallaba. Solo actúa sobre JPG, PNG y WebP
/// de más de 1,5 MB; el servidor después la comprime del todo (ver
/// image-optimize.ts). Si el navegador no puede, sube la original. Ver
/// conversación del 2026-10-01.
const MAX_SIDE = 2400;
const THRESHOLD_BYTES = 1.5 * 1024 * 1024;

export async function prepareImageForUpload(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  if (file.size <= THRESHOLD_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const toBlob = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    let blob = await toBlob("image/webp", 0.86);
    // Algunos Safari no generan WebP y devuelven PNG: en ese caso JPG,
    // salvo que la foto original sea PNG (puede tener transparencia).
    if (!blob || blob.type !== "image/webp") {
      if (file.type === "image/png") return file;
      blob = await toBlob("image/jpeg", 0.86);
    }
    if (!blob || blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "foto"}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}
