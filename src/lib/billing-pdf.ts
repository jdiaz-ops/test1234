import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/// Genera el PDF del aviso de cobro mensual (el "corte") que ve la marca en
/// su dashboard y recibe por correo: desglose de lo que debe, instrucciones
/// de pago (transferencia directa — QR/Bre-B, sin procesador de por medio)
/// y la fecha límite antes del bloqueo. No es una factura electrónica DIAN
/// — eso, si aplica, lo sube el admin aparte en Facturación (ver
/// BrandInvoice) una vez que haya un proveedor de facturación conectado.
export async function generateBrandChargeDoc(params: {
  brandName: string;
  periodStart: Date;
  periodEnd: Date;
  commissionsTotal: number;
  platformFeeTotal: number;
  vatTotal: number;
  rewardsTotal: number;
  totalAmount: number;
  dueAt: Date;
  paymentInstructions: string | null;
  paymentQrImageUrl: string | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 56;
  let y = 780;
  const ink = rgb(0.11, 0.11, 0.11);
  const soft = rgb(0.45, 0.45, 0.45);
  const accent = rgb(0.55, 0.16, 0.16);

  function line(text: string, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb>; dy?: number } = {}) {
    const { size = 11, f = font, color = ink, dy = 18 } = opts;
    page.drawText(text, { x: margin, y, size, font: f, color });
    y -= dy;
  }

  function money(n: number) {
    return "$" + Math.round(n).toLocaleString("es-CO");
  }

  line("MARCOLINI", { size: 12, f: bold, color: accent, dy: 22 });
  line(`Aviso de cobro — ${params.brandName}`, { size: 16, f: bold, dy: 26 });
  line(
    `Período: ${params.periodStart.toLocaleDateString("es-CO")} al ${params.periodEnd.toLocaleDateString("es-CO")}`,
    { size: 10, color: soft, dy: 28 }
  );

  line("Desglose", { size: 12, f: bold, dy: 20 });
  line(`Comisión de creadores de contenido: ${money(params.commissionsTotal)}`);
  line(`Tarifa Marcolini: ${money(params.platformFeeTotal)}`);
  line(`IVA sobre la tarifa: ${money(params.vatTotal)}`);
  if (params.rewardsTotal > 0) line(`Premios de retos: ${money(params.rewardsTotal)}`);
  y -= 6;
  line(`Total a pagar: ${money(params.totalAmount)}`, { size: 14, f: bold, dy: 30 });

  line("Fecha límite de pago", { size: 12, f: bold, dy: 20 });
  line(
    `${params.dueAt.toLocaleDateString("es-CO")}, ${params.dueAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`,
    { dy: 16 }
  );
  line(
    "Si no se verifica el pago antes de esta fecha, tu marca se oculta del marketplace hasta regularizar la situación.",
    { size: 9, color: soft, dy: 28 }
  );

  line("Cómo pagar", { size: 12, f: bold, dy: 20 });
  const instructions = params.paymentInstructions || "Contacta a Marcolini para tus datos de pago.";
  for (const raw of instructions.split("\n")) {
    if (!raw.trim()) continue;
    line(raw.trim(), { size: 10, dy: 15 });
  }
  y -= 10;

  if (params.paymentQrImageUrl) {
    try {
      const bytes = await fetchLocalOrRemote(params.paymentQrImageUrl);
      const isPng = params.paymentQrImageUrl.toLowerCase().includes(".png");
      const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const size = 140;
      page.drawImage(image, { x: margin, y: y - size, width: size, height: size });
      y -= size + 16;
    } catch (err) {
      console.error("[billing-pdf] no se pudo incrustar el QR:", err);
    }
  }

  line(
    "Una vez pagues, sube el comprobante desde Cuenta → Pago en tu portal de Marcolini para que se verifique y se reactive tu marca.",
    { size: 9, color: soft, dy: 14 }
  );

  return doc.save();
}

async function fetchLocalOrRemote(url: string): Promise<Uint8Array> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se pudo descargar ${url} (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const { readFile } = await import("fs/promises");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  return new Uint8Array(await readFile(filePath));
}
