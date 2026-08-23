import { NextResponse } from "next/server";
import { requireBrandProfile } from "@/lib/current-brand";
import { uploadFile, FileUploadError } from "@/lib/file-upload";
import { submitPaymentProof, PaymentError } from "@/server/services/payment-service";

/// La marca sube el comprobante de su transferencia (QR/Bre-B) para el
/// corte activo — queda pendiente de verificación del admin. Todo dentro
/// de la plataforma, sin WhatsApp ni ningún canal aparte.
export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const chargeId = form.get("chargeId");
  const file = form.get("file");

  if (typeof chargeId !== "string" || !chargeId) {
    return NextResponse.json({ error: "Falta el corte a pagar" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecciona el comprobante" }, { status: 400 });
  }

  try {
    const url = await uploadFile(file, `comprobantes/${profile.id}`);
    await submitPaymentProof(profile.id, chargeId, url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof FileUploadError || err instanceof PaymentError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
