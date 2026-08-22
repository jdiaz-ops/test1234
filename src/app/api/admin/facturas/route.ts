import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/current-admin";
import { prisma } from "@/lib/prisma";
import { uploadFile, FileUploadError } from "@/lib/file-upload";

/// El PDF de la factura electrónica se genera por fuera (el proveedor de
/// facturación electrónica) — este endpoint solo registra ese PDF ya
/// generado para que la marca lo vea en su portal (Cuenta → Facturación).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await req.formData();
  const brandId = form.get("brandId");
  const period = form.get("period");
  const amount = form.get("amount");
  const note = form.get("note");
  const file = form.get("file");

  if (typeof brandId !== "string" || !brandId) {
    return NextResponse.json({ error: "Elige una marca" }, { status: 400 });
  }
  if (typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: "El período debe tener formato AAAA-MM" }, { status: 400 });
  }
  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    return NextResponse.json({ error: "Ingresa un monto válido" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Selecciona el PDF de la factura" }, { status: 400 });
  }

  const brand = await prisma.brandProfile.findUnique({ where: { id: brandId } });
  if (!brand) return NextResponse.json({ error: "Marca no encontrada" }, { status: 404 });

  try {
    const pdfUrl = await uploadFile(file, `facturas/${brandId}`);
    const invoice = await prisma.brandInvoice.create({
      data: {
        brandId,
        period,
        amount: amountNumber,
        pdfUrl,
        note: typeof note === "string" && note ? note : null,
        uploadedByUserId: admin.id,
      },
    });
    return NextResponse.json({ ok: true, invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof FileUploadError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
