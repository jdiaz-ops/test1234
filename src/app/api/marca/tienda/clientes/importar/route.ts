import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBrandProfile } from "@/lib/current-brand";
import { limitOrReject } from "@/lib/rate-limit";
import { importStoreCustomers } from "@/server/services/store-customer-service";

/// Un lote del importador de clientes de Shopify (el navegador lee el CSV y
/// manda los clientes de a MAX_BATCH). Ver importStoreCustomers.
const MAX_BATCH = 500;

const text = (max: number) => z.string().trim().max(max).nullable();

const rowSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: text(200),
  phone: text(40),
  documentNumber: text(30),
  company: text(200),
  address: text(300),
  address2: text(300),
  city: text(120),
  region: text(120),
  postalCode: text(20),
  countryCode: text(4),
  emailSubscribed: z.boolean(),
  smsSubscribed: z.boolean(),
  orderCount: z.number().int().min(0).max(1_000_000),
  spentCents: z.number().int().min(0).max(1e13),
  tags: z.array(z.string().trim().max(60)).max(30),
  notes: text(500),
  shopifyCustomerId: text(40),
});

const bodySchema = z.object({ customers: z.array(z.unknown()).min(1).max(MAX_BATCH) });

export async function POST(req: Request) {
  const profile = await requireBrandProfile();
  if (!profile) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const limited = await limitOrReject(req, `clientes-importar:${profile.id}`, 400, 3600);
  if (limited) return limited;

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Lote inválido." }, { status: 400 });

  // Una fila con algo raro (correo mal escrito, texto larguísimo) se salta
  // sola; no tumba el lote entero.
  const valid = [];
  let skipped = 0;
  for (const raw of body.data.customers) {
    const row = rowSchema.safeParse(raw);
    if (row.success) valid.push(row.data);
    else skipped++;
  }

  const result = valid.length ? await importStoreCustomers(profile.id, valid) : { created: 0, updated: 0 };
  return NextResponse.json({ ok: true, ...result, skipped });
}
