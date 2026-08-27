import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/current-admin";
import { legalContentSchema } from "@/lib/validation/admin";
import { upsertLegalContent } from "@/server/services/admin-config-service";

/// /terminos y /privacidad son Server Components que solo leen la base de
/// datos (sin cookies/headers/searchParams) — Next.js los renderiza
/// estáticos y los deja en caché, así que un cambio acá no se ve reflejado
/// hasta forzar la revalidación de esa ruta puntual (o hasta el próximo
/// deploy). Sin esto, un admin podía guardar un cambio y verlo "no
/// aplicado" en el sitio público, aunque sí había quedado bien en la base
/// de datos.
const PATH_BY_KEY: Record<string, string> = {
  terms: "/terminos",
  privacy: "/privacidad",
};

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = legalContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  await upsertLegalContent(
    parsed.data.key,
    parsed.data.title,
    parsed.data.body,
  );

  const path = PATH_BY_KEY[parsed.data.key];
  if (path) revalidatePath(path);

  return NextResponse.json({ ok: true });
}
