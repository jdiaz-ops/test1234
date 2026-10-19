import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { gatewayCredentialsSchema } from "@/lib/validation/brand";
import { isPaymentProviderId } from "@/lib/payment-providers";
import { removeGatewayCredentials, saveGatewayCredentials, BrandPaymentError } from "@/server/services/brand-payment-service";

/// Guarda las llaves de la pasarela elegida y la deja activa (ver
/// saveGatewayCredentials). Las secretas que no cambiaron no viajan: la
/// página solo manda las que la marca escribió.
export async function PATCH(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = gatewayCredentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  try {
    await saveGatewayCredentials(profile.userId, parsed.data);
  } catch (err) {
    if (err instanceof BrandPaymentError)
      return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  return NextResponse.json({ ok: true });
}

/// DELETE ?provider=MERCADO_PAGO&mode=TEST → quita esas llaves (ver
/// removeGatewayCredentials).
export async function DELETE(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const provider = params.get("provider");
  const mode = params.get("mode");
  if (!isPaymentProviderId(provider) || (mode !== "TEST" && mode !== "PRODUCTION")) {
    return NextResponse.json({ error: "Pasarela o modo no válido" }, { status: 400 });
  }
  await removeGatewayCredentials(profile.userId, provider, mode);
  return NextResponse.json({ ok: true });
}
