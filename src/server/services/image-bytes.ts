import { readFile } from "fs/promises";
import path from "path";
import { downloadImage } from "@/server/services/shopify-design-import-service";
import type { FetchLike } from "@/server/services/shopify-store-reader";

/// Los bytes de una foto de la tienda: de internet con los mismos cuidados
/// que al importar (solo https público, formatos de imagen, tope de
/// tamaño) o, si es una subida local (/uploads/…, en desarrollo), del
/// disco. Lo usan las familias de color, la forma de las fotos y el logo
/// recortado.
export async function readImageBytes(url: string, maxBytes: number, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<Buffer> {
  if (url.startsWith("/uploads/")) {
    const root = path.join(process.cwd(), "public");
    const file = path.resolve(root, `.${url}`);
    if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Ruta inválida.");
    return readFile(file);
  }
  const file = await downloadImage(url, "foto", fetchImpl, maxBytes);
  return Buffer.from(await file.arrayBuffer());
}
