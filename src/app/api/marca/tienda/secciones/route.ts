import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import {
  createStorefrontSectionSchema,
  reorderStorefrontSectionsSchema,
} from "@/lib/validation/brand";
import {
  listStorefrontSections,
  createStorefrontSection,
  reorderStorefrontSections,
  StorefrontSectionError,
} from "@/server/services/storefront-section-service";
import { ZodError } from "zod";

export async function GET() {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sections = await listStorefrontSections(profile.id);
  return NextResponse.json({ sections });
}

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createStorefrontSectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    const section = await createStorefrontSection(profile.id, {
      type: parsed.data.type,
      config: parsed.data.config ?? {},
    });
    return NextResponse.json({ ok: true, section });
  } catch (err) {
    if (err instanceof StorefrontSectionError || err instanceof ZodError)
      return NextResponse.json({ error: "No se pudo crear la sección." }, { status: 400 });
    throw err;
  }
}

/// Reordena TODAS las secciones de la marca de una — ver
/// reorderStorefrontSections. Para editar una sola sección (config o
/// enabled) usa /api/marca/tienda/secciones/[id].
export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = reorderStorefrontSectionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await reorderStorefrontSections(profile.id, parsed.data.order);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof StorefrontSectionError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
