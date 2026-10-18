/// Lado del navegador de "Guardar las fotos en Marcolini": repite el POST
/// de alojar-fotos hasta que no quede ninguna foto externa, acumulando las
/// que fallaron para no pedirlas otra vez. Lo usan el importador de
/// Shopify (al terminar de traer productos) y el aviso en Productos.

export type RehostProgress = { done: number; total: number };
export type RehostSummary = { saved: number; failed: { url: string; error: string }[]; total: number };

const MAX_ROUNDS = 400;

export async function countExternalImages(): Promise<number> {
  const res = await fetch("/api/marca/tienda/productos/alojar-fotos");
  const body = await res.json().catch(() => null);
  return res.ok && body?.ok ? (body.total as number) : 0;
}

export async function rehostAllImages(onProgress?: (p: RehostProgress) => void): Promise<RehostSummary> {
  const total = await countExternalImages();
  const failed: RehostSummary["failed"] = [];
  let saved = 0;
  let remaining = total;
  onProgress?.({ done: 0, total });
  for (let round = 0; round < MAX_ROUNDS && remaining > 0; round++) {
    const res = await fetch("/api/marca/tienda/productos/alojar-fotos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 6, skip: failed.map((f) => f.url).slice(0, 500) }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) {
      throw new Error(body?.error ?? "No se pudieron guardar las fotos. Intenta de nuevo.");
    }
    saved += (body.saved as unknown[]).length;
    failed.push(...(body.failed as RehostSummary["failed"]));
    remaining = body.remaining as number;
    onProgress?.({ done: Math.min(total, saved + failed.length), total });
  }
  return { saved, failed, total };
}
