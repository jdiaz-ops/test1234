import { NextResponse } from "next/server";
import { requireAdmin, isOwner } from "@/lib/current-admin";
import { brandAccessLinkSchema } from "@/lib/validation/admin";
import {
  AdminBrandError,
  generateBrandAccessLink,
  revokeBrandAccessLink,
} from "@/server/services/admin-brand-service";

/// Link de acceso para una marca sin dueña (ver admin-brand-service.ts):
/// POST lo genera (o reemplaza), DELETE lo anula. Solo el Propietario,
/// igual que "Entrar como": quien tenga el link reclama la cuenta.
async function owner() {
  const admin = await requireAdmin();
  return admin && isOwner(admin.adminRole) ? admin : null;
}

export async function POST(req: Request) {
  if (!(await owner())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = brandAccessLinkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  try {
    const link = await generateBrandAccessLink(parsed.data.brandId);
    return NextResponse.json({ ok: true, url: link.url, expiresAt: link.expiresAt.toISOString() });
  } catch (err) {
    if (err instanceof AdminBrandError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}

export async function DELETE(req: Request) {
  if (!(await owner())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = brandAccessLinkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  await revokeBrandAccessLink(parsed.data.brandId);
  return NextResponse.json({ ok: true });
}
