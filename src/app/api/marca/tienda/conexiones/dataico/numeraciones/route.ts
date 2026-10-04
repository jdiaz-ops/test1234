import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { dataicoAllowed } from "@/lib/features";
import { limitOrReject } from "@/lib/rate-limit";
import {
  DataicoError,
  fetchDataicoNumberings,
  getDataicoConnection,
} from "@/server/services/dataico-service";

/// "Probar conexión": con el token que se acaba de pegar (o el guardado)
/// trae las numeraciones de factura de la cuenta de Dataico.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!dataicoAllowed(profile)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const limited = await limitOrReject(req, `dataico-probar:${profile.id}`, 30, 3600);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as { authToken?: string } | null;
  const token = body?.authToken?.trim() || (await getDataicoConnection(profile.id))?.authToken;
  if (!token) return NextResponse.json({ error: "Pega el Auth Token de Dataico." }, { status: 400 });

  try {
    return NextResponse.json({ ok: true, numberings: await fetchDataicoNumberings(token) });
  } catch (err) {
    if (err instanceof DataicoError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
