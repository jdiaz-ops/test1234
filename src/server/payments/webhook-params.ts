/// Los avisos de PayU y ePayco llegan como formulario (POST
/// x-www-form-urlencoded), a veces como GET con query, y en pruebas como
/// JSON. Acá se leen todos igual: un mapa plano de strings.
export async function readWebhookParams(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URL(req.url).searchParams.entries()) if (!(k in out)) out[k] = v;
  if (req.method === "GET") return out;
  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = await req.json();
      if (body && typeof body === "object") {
        for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
          if (v !== null && v !== undefined && typeof v !== "object") out[k] = String(v);
        }
      }
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) if (typeof v === "string") out[k] = v;
    }
  } catch {
    // Cuerpo vacío o ilegible: lo que haya en la URL.
  }
  return out;
}
